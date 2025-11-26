import { createGrokClient } from './grokClient.js';
import { calculateApiCost } from './apiCost.js';
import { extractTextFromAIResponse, parseJsonSafe, stripCodeFence } from '../utils/parsers.js';

/**
 * Placement test generation service using Grok AI.
 * Orchestrates test generation, validation, and persistence.
 * 
 * Flow:
 * 1. Build structured prompt from onboarding inputs
 * 2. Call Grok; retry with JSON-enforced format if parsing fails
 * 3. Validate and normalize questions
 * 4. Persist to database with API usage tracking
 */
const GROK_MODEL = 'grok-4-fast-reasoning';
const grokClient = createGrokClient({ model: GROK_MODEL });

/**
 * Generate a placement test via Grok, persist it, and return metadata for downstream usage.
 */
// Entry point: generate a placement test, persist it, and return metadata
export async function generateAndStorePlacementTest({ runQuery, userId, topicId, topic, goal, experience }) {
  if (typeof runQuery !== 'function') throw new Error('runQuery helper required.');
  if (!userId) throw new Error('userId is required for API usage tracking.');

  const basePrompt = buildPlacementPrompt({ topic, goal, experience });
  const attempts = [basePrompt, `${basePrompt}

IMPORTANT: Return only valid JSON that matches the OUTPUT FORMAT exactly. No commentary.`];

  let placementTest = null;
  let grokResponse = null;
  let totalResponseTimeMs = 0;
  let lastRaw = '';

  // Try the base prompt, then a JSON-enforced variant if parsing fails.
  for (let index = 0; index < attempts.length; index += 1) {
    const { response, rawContent, parsed, durationMs } = await requestPlacementTest({
      prompt: attempts[index],
      enforceJson: index > 0,
    });

    grokResponse = response;
    totalResponseTimeMs += durationMs;
    lastRaw = rawContent;

    if (isValidPlacement(parsed)) {
      placementTest = normalizePlacement(parsed, topic);
      break;
    }
  }

  if (!placementTest) {
    console.warn('[placementTestService] Failed to parse Grok response:', truncate(lastRaw));
    throw new Error('Placement test generation returned an empty result.');
  }

  // Clean and validate each question before persisting to the database.
  const questionTransforms = (placementTest.questions || [])
    .map((question, index) => transformQuestion(question, index))
    .filter(Boolean);

  console.log('[DEBUG] Placement test generation:', {
    raw_questions_from_ai: placementTest.questions?.length || 0,
    validated_questions: questionTransforms.length,
    filtered_out: (placementTest.questions?.length || 0) - questionTransforms.length
  });

  if (questionTransforms.length === 0) {
    throw new Error('Placement test has no usable questions.');
  }

  // Defer attaching questions until we have database IDs.
  placementTest.total_questions = questionTransforms.length;
  placementTest.goal = goal || null;
  placementTest.experience_level = experience || null;
  placementTest.model_used = GROK_MODEL;

  // Persist the placement test so child rows can reference it.
  const sessionInsert = await runQuery(
    `INSERT INTO test_sessions (student_id, topic, goal, experience_level, model_used, total_questions)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id` ,
    [
      userId,
      placementTest.topic,
      placementTest.goal,
      placementTest.experience_level,
      placementTest.model_used,
      placementTest.total_questions,
    ]
  );
  const placementTestId = sessionInsert[0].id;

  const persistedQuestions = await persistPlacementQuestions(runQuery, placementTestId, questionTransforms);

  console.log('[DEBUG] Placement test persistence:', {
    test_id: placementTestId,
    persisted_count: persistedQuestions.length,
    expected_count: questionTransforms.length
  });

  // Attach DB question IDs so the client can submit answers against the correct rows.
  placementTest.questions = persistedQuestions.map(({ sanitized, dbId }) => ({
    ...sanitized,
    question_id: dbId,
  }));

  const usage = grokResponse?.usage || {};
  const tokensInput = usage.prompt_tokens ?? usage.promptTokens ?? 0;
  const tokensOutput = usage.completion_tokens ?? usage.completionTokens ?? 0;
  const costUsd = calculateApiCost({
    model: GROK_MODEL,
    tokensInput,
    tokensOutput,
    cached: Boolean(usage.prompt_tokens_cached ?? usage.promptTokensCached),
  });

  const apiUsageInsert = await runQuery(
    `INSERT INTO api_usage (user_id, endpoint, model_used, request_id, tokens_input, tokens_output, cost_usd, response_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id` ,
    [
      userId,
      '/onboarding/placement-test',
      GROK_MODEL,
      grokResponse?.id || null,
      tokensInput,
      tokensOutput,
      costUsd,
      totalResponseTimeMs,
    ]
  );

  return {
    placementTestId,
    placementTest,
    apiUsageId: apiUsageInsert[0].id,
    metadata: {
      requestId: grokResponse?.id || null,
      tokensInput,
      tokensOutput,
      costUsd,
      responseTimeMs: totalResponseTimeMs,
      topicId,
      placementAttemptId: placementTestId,
    },
  };
}

// Call Grok, extract text, and attempt to parse JSON.
/**
 * Request placement test generation from Grok AI.
 * 
 * @param {Object} params - Request parameters
 * @param {string} params.prompt - Test generation prompt
 * @param {boolean} params.enforceJson - Whether to enforce JSON response format
 * @returns {Promise<Object>} Response with parsed content and metadata
 */
async function requestPlacementTest({ prompt, enforceJson }) {
  const startedAt = Date.now();
  try {
    const payload = {
      messages: [
        { role: 'system', content: 'You are an expert assessment designer and learning scientist.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
      max_output_tokens: 2000,
      web_search: { enable: true, max_results: 5, sources: [{ type: 'web' }] },
    };

    if (enforceJson) payload.response_format = { type: 'json_object' };

    const response = await grokClient.generateCompletion(payload);
    const rawContent = extractTextFromAIResponse(response);
    return {
      response,
      rawContent,
      parsed: parseJsonSafe(rawContent),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error?.response?.data?.error || error.message || 'Unknown Grok error';
    throw new Error(`Placement test generation failed: ${message}`);
  }
}

function buildPlacementPrompt({ goal, experience }) {
  const safeGoal = goal || 'Clarify learner goal';
  const safeExperience = experience || 'No experience provided';

  // Prompt describes formatting and pedagogy expectations for the Grok model.
  return `You are an expert math assessment designer.

Your task: Generate a math placement test that determines a learner’s true understanding of math topics, all derived from their goal and current stated experience.

-------------------------------------
CONTEXT
Goal (target qualification or level): ${safeGoal}
Learner’s stated experience: ${safeExperience}
-------------------------------------

OBJECTIVE
1. Create a test to gain a good understanding of a learner’s true understanding of math topics, and what prerequisite topics that they don't understand.
2. Create the perfect number of questions to cover all prerequisite topics, test their stated math experience, and determine exactly what they know.

-------------------------------------
SCOPE & BOUNDARY RULES
- The test must **never include content beyond the users goal**.
  - Example: If the users goal = “GCSE Mathematics,” do NOT include calculus, matrices, or other post-GCSE material, even if the learner mentions them in their stated experience: ${safeExperience}.
- The highest difficulty level allowed is the **upper limit of the users stated goal**.
- Use the users stated experience only to anchor the starting point and calibrate mid-range difficulty, not to expand beyond the goal.
- If the learner’s stated experience exceeds the users goal, treat it as potential over-estimation and still cap question difficulty at the goal level.
- Only create questions if they can be best displayed only using bare text (no graphs or images).
- Always write questions in an easy to understand way, just like on the real exam or assessment.

-------------------------------------
TEST DESIGN LOGIC
- **Foundation check:** Begin !slightly! below the users stated experience to verify mastery.
- **Goal coverage:** Include questions spanning the prerequisite structure required for the users goal.
- **Balanced breadth:** Cover all key strands leading up to the users goal as long as it is around the level of the users experience.
- **Stretch within goal:** The hardest questions should sit slightly beyond the users experience but never beyond the users goal.
- **Avoid redundancy:** Do not repeat the same topics more the twice.

-------------------------------------
ADAPTIVE LENGTH GUIDE
Estimate the gap between the users stated experience and goal and create a test with the perfect number of questions to cover everything necessary. below is a rough guide :

• Small gap (e.g. Year 9 → Year 10): 25->30 questions  
• Moderate gap (e.g. Year 8 → GCSE): 30–>40 questions  
• Large gap (e.g. Year 3 → A-Level): 40–>50 questions  

-------------------------------------
DIFFICULTY CALIBRATION
- 20–30% of questions: slightly below this level (confirm mastery).  
- 50%: aligned with the users experience but on other topics required to achieve the users goal.  
- 20–30%: very slight stretch beyond the users experience towards their goal. e.g. if the user says they know derivatives but not integration, then integration questions should be included but only 1 or 2.
- Do not label question levels.  
- Exclude trivial or off-topic content.
- Mix the questions randomly.

-------------------------------------
QUESTION DESIGN RULES
Each question must:
- Test one clear mathematical concept.
- Use either "multiple_choice" (exactly 4 options A–D) or "text" (open-ended).
- Include:
  • "correct_answer": "A"–"D" or null for open-ended  
  • "explanation": rationale + marking note + diagnostic insight  
  • "assesses": the specific subskill or concept tested  
- only create "text" (open-ended) questions if the question is actually open ended and a multiple choice question is not possible.
- only 10-15% of questions should be "text" (open-ended).
- Only create questions if they can be best displayed only using bare text (no graphs or images).
- Always write questions in an easy to understand way, just like on the real exam or assessment.
- Do not ever show the correct answer or the multiple choice options in the question.
- Do not display duplicates of the same multiple choice answer
- Do not write things like (give your answer in cm^2) if it is a multiple choice question.

-------------------------------------
OUTPUT FORMAT (strict JSON)
{
  "topic": "...",
  "prerequisites": ["...", "..."],
  "questions": [
    {
      "id": 1,
      "question": "...",
      "type": "multiple_choice" | "text",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "A" | "B" | "C" | "D" | null,
      "explanation": "...",
      "assesses": "..."
    }
  ],
  "notes": "(any short notes about questions)"
}

-------------------------------------
REASONING EXPECTATIONS
- Derive prerequisite structure from the users experience, curriculum and progression map, but do stretch }too far from the users experience.  
- Calibrate difficulty using verified national or equivalent standards.  
- Ensure every question fits under the scope of the users goal.  
- Maintain balanced coverage and accuracy.
- Only create questions if they can be best displayed only using bare text (no graphs or images).
- Always write questions in an easy to understand way, just like on the real exam or assessment.

-------------------------------------
WEB SEARCH POLICY
Use up to 10 factual searches (max 10 domains) to verify skill expectations for the users experience and goal.  

-------------------------------------
CONSTRAINTS
- Plain ASCII only.  
- Exactly 4 options for each multiple-choice question.  
- Output JSON only — no commentary or notes outside the JSON.  
- Ensure question order is mixed randomly, but always stay below the level of the users goal.

`;
}

// Parsing utilities moved to utils/parsers.js

// Ensure the parsed payload at least contains a non-empty question list.
function isValidPlacement(candidate) {
  return (
    candidate &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length > 0
  );
}

// Normalize optional fields from the Grok payload so downstream DB inserts succeed.
function normalizePlacement(candidate, fallbackTopic) {
  const topic = candidate.topic || fallbackTopic || 'Unknown topic';
  const marking = candidate.marking_scheme || '1 mark per correct answer; partial credit for reasoned short answers.';
  const questions = Array.isArray(candidate.questions)
    ? candidate.questions.map((question, index) => ({
        id: question?.id ?? index + 1,
        ...question,
      }))
    : [];

  return {
    ...candidate,
    topic,
    marking_scheme: marking,
    questions,
  };
}

const ALLOWED_TYPES = new Set(['multiple_choice', 'text', 'scenario']);

// Convert free-form answers into null where appropriate to keep DB rows tidy.
function normalizeCorrectAnswer(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'n/a' || lower === 'none') return null;
  return trimmed;
}

// Sanitize each question from Grok so only supported types/options are persisted.
function transformQuestion(question, index) {
  if (!question) return null;

  const rawType = String(question.type || '').toLowerCase();

  const normalizedOptions = Array.isArray(question.options)
    ? question.options
        .map((option) => (typeof option === 'string' ? option.trim() : ''))
        .filter((option) => option.length > 0)
    : [];

  const normalizedAnswer = normalizeCorrectAnswer(question.correct_answer);

  let type = 'text';
  if (rawType === 'scenario') {
    type = 'scenario';
  } else if (rawType === 'multiple_choice' && normalizedOptions.length >= 2 && normalizedAnswer) {
    type = 'multiple_choice';
  }

  if (!ALLOWED_TYPES.has(type)) {
    type = 'text';
  }

  const sanitized = {
    id: question.id ?? index + 1,
    question: (question.question || '').trim(),
    type,
    options: type === 'multiple_choice' ? normalizedOptions : undefined,
    correct_answer: type === 'multiple_choice' ? normalizedAnswer : null,
    explanation: (question.explanation || '').trim(),
    assesses: (question.assesses || null) ?? null,
  };

  const record = {
    conceptTag: sanitized.assesses,
    questionText: sanitized.question,
    type,
    options: type === 'multiple_choice' ? normalizedOptions : null,
    correctAnswer: sanitized.correct_answer,
    explanation: sanitized.explanation || null,
  };

  if (!record.questionText) {
    return null;
  }

  return { sanitized, record };
}

// Helper ensures questions are written in order and returns their DB IDs for client usage.
async function persistPlacementQuestions(runQuery, sessionId, questionTransforms) {
  const results = [];

  for (const transform of questionTransforms) {
    const { sanitized, record } = transform;
    // Store the DB row so we can capture the generated question ID.
    const insertResult = await runQuery(
      `INSERT INTO test_questions (session_id, concept_tag, question_text, type, options, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id` ,
      [
        sessionId,
        record.conceptTag,
        record.questionText,
        record.type,
        record.options ? JSON.stringify(record.options) : null,
        record.correctAnswer,
        record.explanation,
      ]
    );

    results.push({ sanitized, record, dbId: insertResult[0].id });
  }

  return results;
}

function truncate(text, limit = 220) {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`;
}
