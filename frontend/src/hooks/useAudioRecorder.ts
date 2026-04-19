import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}

export interface UseAudioRecorderOptions {
  chunkDurationMs: number;
  onChunk: (blob: Blob) => void | Promise<void>;
}

export function useAudioRecorder({ chunkDurationMs, onChunk }: UseAudioRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onChunkRef = useRef(onChunk);
  const rotateTimerRef = useRef<number | null>(null);
  const shouldRecordRef = useRef(false);

  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  const clearRotateTimer = useCallback(() => {
    if (rotateTimerRef.current !== null) {
      window.clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    clearRotateTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [clearRotateTimer]);

  const scheduleRotate = useCallback(
    (recorder: MediaRecorder, durationMs: number) => {
      clearRotateTimer();
      rotateTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") {
          try {
            recorder.stop();
          } catch {
            /* ignore */
          }
        }
      }, durationMs);
    },
    [clearRotateTimer]
  );

  const createRecorder = useCallback(
    (stream: MediaStream, durationMs: number) => {
      const mimeType = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        setMicError("MediaRecorder is not supported in this browser.");
        cleanupStream();
        return null;
      }

      recorder.ondataavailable = async (ev) => {
        const source = ev.data;
        const blob =
          !source.type && recorder.mimeType
            ? new Blob([source], { type: recorder.mimeType })
            : source;
        // Very tiny blobs are often invalid container fragments.
        if (!blob || blob.size < 2048) return;
        await Promise.resolve(onChunkRef.current(blob));
      };

      recorder.onerror = () => {
        setMicError("Recording error. Try stopping and starting again.");
      };

      recorder.onstop = () => {
        recorderRef.current = null;
        if (!shouldRecordRef.current) {
          cleanupStream();
          return;
        }
        const next = createRecorder(stream, durationMs);
        if (!next) return;
        recorderRef.current = next;
        next.start();
        scheduleRotate(next, durationMs);
      };

      return recorder;
    },
    [cleanupStream, scheduleRotate]
  );

  const stop = useCallback(() => {
    shouldRecordRef.current = false;
    clearRotateTimer();
    const recorder = recorderRef.current;
    if (!recorder) {
      cleanupStream();
      setRecording(false);
      return;
    }

    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupStream();
      }
    } else {
      cleanupStream();
    }
    setRecording(false);
  }, [cleanupStream, clearRotateTimer]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    setMicError(null);
    stop();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch {
      setMicError("Microphone permission denied or unavailable.");
      return;
    }

    streamRef.current = stream;
    const slice = Math.max(3000, chunkDurationMs);
    shouldRecordRef.current = true;
    const recorder = createRecorder(stream, slice);
    if (!recorder) return;
    recorder.start();
    scheduleRotate(recorder, slice);
    recorderRef.current = recorder;
    setRecording(true);
  }, [chunkDurationMs, createRecorder, scheduleRotate, stop]);

  return { recording, micError, start, stop };
}
