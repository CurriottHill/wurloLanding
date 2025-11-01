import axios from 'axios';

/**
 * Factory for interacting with Google Gemini models.
 * @param {Object} options
 * @param {string} [options.apiKey=process.env.GEMINI_API_KEY] - API key used for authentication.
 * @param {string} options.model - Gemini model identifier, e.g. "gemini-1.5-flash".
 */
export function createGeminiClient({ apiKey = process.env.GEMINI_API_KEY, model }) {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Set GEMINI_API_KEY in the environment.');
  }
  if (!model) {
    throw new Error('A Gemini model name must be provided.');
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const client = axios.create({
    baseURL: baseUrl,
    params: { key: apiKey },
  });

  /**
   * Sends a prompt to Gemini and returns the API response.
   * @param {Array} contents - Array following Gemini generateContent structure.
   */
  async function generateContent(contents, extraPayload = {}) {
    if (!Array.isArray(contents) || contents.length === 0) {
      throw new Error('Gemini generateContent requires a non-empty contents array.');
    }

    const payload = { contents };
    if (extraPayload && typeof extraPayload === 'object') {
      Object.assign(payload, extraPayload);
    }

    try {
      const response = await client.post('', payload);
      return response.data;
    } catch (error) {
      const code = error?.code;
      const rawMessage = error?.message;
      const message = String(rawMessage || '').toLowerCase();
      if (code === 'ECONNRESET' || code === 'ECONNABORTED') {
        throw new Error('Gemini connection error. Please try again.');
      }
      if (message.includes('network') || message.includes('socket')) {
        throw new Error('Gemini network error. Please try again.');
      }
      const apiError = error?.response?.data?.error ?? error?.response?.data;
      if (apiError) {
        throw new Error(formatGeminiError(apiError));
      }
      throw new Error(rawMessage || 'Gemini request failed.');
    }
  }

  function formatGeminiError(err) {
    if (!err) return 'Gemini request failed.';
    if (typeof err === 'string') return err;
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return { generateContent };
}
