// Pricing configuration for supported AI models.
// Costs are expressed in USD per 1,000 tokens.
export const MODEL_PRICING = {
  'gpt-5': {
    input: 0.00125,
    output: 0.01,
  },
  'grok-4-fast-reasoning-fixed': {
    input: 0.003,
    output: 0.015,
    cachedInput: 0.00075,
  },
  'grok-4-fast-reasoning': {
    input: 0.003,
    output: 0.015,
    cachedInput: 0.00075,
  },
  'gemini-2.5-flash-lite': {
    input: 0.0001,
    output: 0.0004,
  },
};

/**
 * Computes the dollar cost for an API call given token usage and model pricing.
 *
 * @param {Object} params - Cost calculation inputs.
 * @param {string} params.model - Model identifier (case insensitive).
 * @param {number} [params.tokensInput=0] - Prompt/input tokens consumed.
 * @param {number} [params.tokensOutput=0] - Completion/output tokens consumed.
 * @param {boolean} [params.cached=false] - Whether the input tokens were served from cache.
 * @returns {number} Cost in USD rounded to 5 decimal places.
 */
export function calculateApiCost({ model, tokensInput = 0, tokensOutput = 0, cached = false }) {
  if (!model) {
    return 0;
  }

  const normalizedModel = model.toLowerCase();
  const pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    return 0;
  }

  const inputRate = cached && pricing.cachedInput != null ? pricing.cachedInput : pricing.input;
  const outputRate = pricing.output;

  const cost = ((tokensInput / 1000) * (inputRate || 0)) + ((tokensOutput / 1000) * (outputRate || 0));
  return Number.isFinite(cost) ? Number(cost.toFixed(5)) : 0;
}
