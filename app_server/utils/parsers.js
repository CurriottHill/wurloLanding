/**
 * Consolidated parsing utilities for AI model responses.
 * Eliminates duplication across service files.
 */

/**
 * Strip markdown code fences from text.
 * 
 * @param {string} text - Raw text potentially wrapped in ```json...```
 * @returns {string} Clean text without fences
 */
export function stripCodeFence(text) {
  if (!text) return '';
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const clean = fence ? fence[1] : text;
  return clean.replace(/[\uFEFF\u200B]+/g, ''); // Remove zero-width characters
}

/**
 * Parse JSON from text that may contain code fences or extra content.
 * Falls back to extracting first {...} block if direct parse fails.
 * 
 * @param {string} rawText - Raw text containing JSON
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
export function parseJsonSafe(rawText) {
  if (!rawText) return null;
  
  const stripped = stripCodeFence(rawText.trim());
  if (!stripped) return null;

  try {
    return JSON.parse(stripped);
  } catch {
    // Try to extract first JSON object
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Parse JSON and separate it from trailing reasoning text.
 * Common pattern in AI responses that include both structured data and explanation.
 * 
 * @param {string} rawText - Text containing JSON followed by reasoning
 * @returns {Object} Object with { json, reasoning } properties
 */
export function parseJsonAndReasoning(rawText) {
  if (!rawText) return { json: null, reasoning: '' };
  
  const stripped = stripCodeFence(rawText.trim());
  if (!stripped) return { json: null, reasoning: '' };

  try {
    const firstBrace = stripped.indexOf('{');
    if (firstBrace === -1) return { json: null, reasoning: stripped };

    let depth = 0;
    let end = -1;

    for (let i = firstBrace; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end === -1) return { json: null, reasoning: stripped };

    const jsonSlice = stripped.slice(firstBrace, end);
    const parsed = JSON.parse(jsonSlice);
    const reasoning = stripped.slice(end).trim();

    return { json: parsed, reasoning };
  } catch {
    // Fallback to regex extraction
    try {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) return { json: null, reasoning: stripped };

      const parsed = JSON.parse(match[0]);
      const idx = stripped.indexOf(match[0]);
      const reasoning = idx >= 0 ? stripped.slice(idx + match[0].length).trim() : '';

      return { json: parsed, reasoning };
    } catch {
      return { json: null, reasoning: stripped };
    }
  }
}

/**
 * Extract text content from various AI response structures.
 * Handles Grok, Gemini, and OpenAI response formats.
 * 
 * @param {Object} response - AI API response object
 * @returns {string} Extracted text content
 */
export function extractTextFromAIResponse(response) {
  // Grok/OpenAI format
  const choice = Array.isArray(response?.choices) ? response.choices[0] : null;
  if (choice) {
    if (typeof choice.text === 'string') return choice.text;
    if (choice.message?.content) return flattenContent(choice.message.content);
    if (typeof choice.message === 'string') return choice.message;
  }

  // Gemini format
  const candidate = response?.candidates?.[0];
  if (candidate) {
    const parts = candidate.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((part) => typeof part.text === 'string');
      if (textPart) return textPart.text;
    }
    if (typeof candidate.text === 'string') return candidate.text;
    if (typeof candidate.output === 'string') return candidate.output;
  }

  return '';
}

/**
 * Flatten nested content structures into a single string.
 * 
 * @param {any} content - Content to flatten
 * @returns {string} Flattened text
 */
function flattenContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(flattenContent).join('\n');
  if (typeof content === 'object') return Object.values(content).map(flattenContent).join('\n');
  return '';
}
