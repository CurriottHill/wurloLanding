/**
 * Shared helpers for working with Gemini responses across services.
 * These utilities do not change any behavior; they centralize parsing logic
 * and add clear inline documentation for maintainability.
 */

/**
 * Extract the first text chunk from a Gemini generateContent response.
 * Handles multiple possible shapes that appear in SDKs.
 */
export function extractFirstTextFromGemini(response) {
  const c = response?.candidates?.[0];
  if (!c) return null;
  const parts = c.content?.parts;
  if (Array.isArray(parts)) {
    const p = parts.find((part) => typeof part.text === 'string');
    if (p) return p.text;
  }
  if (typeof c.text === 'string') return c.text;
  if (typeof c.output === 'string') return c.output; // fallback seen in some libs
  return null;
}

/**
 * Given raw text from Gemini, strip optional ```json fences and try to parse JSON.
 * Falls back to extracting the first {...} block if present.
 */
export function parseGeminiJsonText(rawText) {
  if (!rawText) return null;
  const clean = String(rawText).trim().replace(/```json\s*([\s\S]*?)```/i, '$1').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

/**
 * Convenience: directly parse a Gemini response object into JSON if possible.
 */
export function parseGeminiResponseToJson(response) {
  const text = extractFirstTextFromGemini(response);
  if (!text) return null;
  return parseGeminiJsonText(text);
}
