import { groqAudioTranscription } from "../utils/groqClient.js";

/**
 * Transcribe a single audio chunk via Groq Whisper Large V3.
 */
export async function transcribeChunk({ apiKey, buffer, filename, mimeType }) {
  return groqAudioTranscription({
    apiKey,
    buffer,
    filename,
    contentType: mimeType,
  });
}
