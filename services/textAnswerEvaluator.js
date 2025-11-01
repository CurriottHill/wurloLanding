import { createGeminiClient } from './geminiClient.js';
// Shared Gemini helpers to avoid duplicated parsing code across services.
import { parseGeminiResponseToJson } from './geminiUtils.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const geminiClient = createGeminiClient({ model: GEMINI_MODEL });

/**
 * Use Gemini to evaluate a free-text learner response.
 * Returns { isCorrect, idealAnswer, feedback } where:
 *  - isCorrect: boolean | null (null when evaluation failed)
 *  - idealAnswer: string | null (model's reference answer suggestion)
 *  - feedback: string | null (brief explanation)
 */
// Evaluate a free-text answer using Gemini and return a compact result object.
export async function evaluateTextAnswer({ questionText, referenceAnswer, explanation, userAnswer }) {
  const prompt = buildPrompt({ questionText, referenceAnswer, explanation, userAnswer });

  try {
    const response = await geminiClient.generateContent([
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ]);

    // Parse Gemini -> JSON using shared utility for consistency.
    const parsed = parseGeminiResponse(response);
    if (!parsed) {
      return { isCorrect: null, idealAnswer: referenceAnswer ?? null, feedback: null };
    }

    const isCorrect = typeof parsed.is_correct === 'boolean' ? parsed.is_correct : null;
    const idealAnswer = sanitizeString(parsed.ideal_answer) ?? referenceAnswer ?? null;
    const feedback = sanitizeString(parsed.feedback);

    return { isCorrect, idealAnswer, feedback };
  } catch (error) {
    console.error('[textAnswerEvaluator] Gemini evaluation failed:', error?.message || error);
    return { isCorrect: null, idealAnswer: referenceAnswer ?? null, feedback: null };
  }
}

function buildPrompt({ questionText, referenceAnswer, explanation, userAnswer }) {
  const reference = referenceAnswer || 'N/A';
  const rationale = explanation || 'N/A';

  return `You are evaluating a learner's free-text answer.
Return a strict JSON object with the keys: is_correct (boolean), ideal_answer (string), feedback (string).
Use this rubric:
- is_correct should be true only if the learner answer demonstrates the essential knowledge described in the ideal answer. (not word for word)
- ideal_answer must be a concise, high-quality answer that could be stored as the reference correct answer for the question.
- feedback should be short (max 2 sentences) explaining the judgement.

Question: ${questionText}
Diagnostic explanation: ${rationale}
Learner answer: ${userAnswer}
`;
}

// Backwards-friendly wrapper: delegate to centralized parser.
// This wrapper preserves the original behavior while deduplicating code.
function parseGeminiResponse(response) {
  return parseGeminiResponseToJson(response);
}

// Removed bespoke extractor in favor of centralized helper inside parseGeminiResponseToJson.

// Trim a possibly-nullish string and coerce empty results to null.
function sanitizeString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}
