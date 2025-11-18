import axios from 'axios';

/**
 * Factory for interacting with X.ai (Grok) models.
 * @param {Object} options
 * @param {string} [options.apiKey=process.env.XAI_API_KEY] - API key for authentication.
 * @param {string} options.model - Grok model identifier.
 */
export function createGrokClient({ apiKey = process.env.XAI_API_KEY, model }) {
  if (!apiKey) {
    throw new Error('Grok API key is required. Set XAI_API_KEY in the environment.');
  }
  if (!model) {
    throw new Error('A Grok model name must be provided.');
  }

  const client = axios.create({
    baseURL: 'https://api.x.ai/v1',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  /**
   * Sends a prompt payload to Grok and returns the response.
   * @param {Object} payload - Request body following the Grok API specification.
   */
  async function generateCompletion(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Grok generateCompletion requires a payload object.');
    }

    try {
      const response = await client.post('/chat/completions', {
        model,
        ...payload,
      });
      return response.data;
    } catch (error) {
      const code = error?.code;
      const message = String(error?.message || '').toLowerCase();
      if (code === 'ECONNRESET' || code === 'ECONNABORTED') {
        throw new Error('Grok connection error. Please try again.');
      }
      if (message.includes('network') || message.includes('socket')) {
        throw new Error('Grok network error. Please try again.');
      }
      throw new Error(error?.response?.data?.error || error.message || 'Grok request failed.');
    }
  }

  async function generateImages(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Grok generateImages requires a payload object.');
    }

    try {
      const response = await client.post('/images/generations', {
        model,
        ...payload,
      });
      return response.data;
    } catch (error) {
      const code = error?.code;
      const message = String(error?.message || '').toLowerCase();
      if (code === 'ECONNRESET' || code === 'ECONNABORTED') {
        throw new Error('Grok image connection error. Please try again.');
      }
      if (message.includes('network') || message.includes('socket')) {
        throw new Error('Grok image network error. Please try again.');
      }
      throw new Error(error?.response?.data?.error || error.message || 'Grok image request failed.');
    }
  }

  return { generateCompletion, generateImages };
}
