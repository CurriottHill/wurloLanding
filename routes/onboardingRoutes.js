import { Router } from 'express';
import { createGeminiClient } from '../services/geminiClient.js';
import { parseGeminiJsonText } from '../services/geminiUtils.js';
import { summarizePlacementResults } from '../services/placementSummaryService.js';
import { query, transaction } from '../database/service.js';
import { generateAndStorePlacementTest } from '../services/placementTestService.js';
import { evaluateTextAnswer } from '../services/textAnswerEvaluator.js';

const router = Router();

// Shared Gemini client configured with the requested default model
const geminiClient = createGeminiClient({ model: 'gemini-2.5-flash' });

/**
 * POST /onboarding/moderate
 * Checks onboarding responses for inappropriate content using Gemini.
 * Returns { approved: boolean, message: string } or 4xx/5xx with { error }.
 */

router.post('/moderate', async (req, res) => {
  let sanitizedAnswers;
  try {
    sanitizedAnswers = sanitizeOnboardingAnswers(req.body || {});
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message });
  }

  try {
    const moderationResult = await moderateSanitizedAnswers(sanitizedAnswers);
    return res.json(moderationResult);
  } catch (error) {
    console.error('Onboarding moderation failed:', error);
    const message = error.message || 'Gemini moderation is currently unavailable.';
    return res.status(502).json({ error: message });
  }
});

router.post('/submit', async (req, res) => {
  const { user_id: userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'A valid user_id is required.' });
  }

  let sanitizedAnswers;
  try {
    sanitizedAnswers = sanitizeOnboardingAnswers(req.body || {});
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message });
  }

  try {
    const moderationResult = await moderateSanitizedAnswers(sanitizedAnswers);
    if (!moderationResult.approved) {
      const moderationMessage = moderationResult.message || 'Responses require updates before continuing.';
      return res.status(422).json({
        error: moderationMessage,
        approved: false,
        message: moderationMessage,
      });
    }

    let placementTestResult;

    try {
      const onboardingEntries = [
        { question_type: 'goal', answer: { goal: sanitizedAnswers.goal } },
        { question_type: 'prior_knowledge', answer: { experience: sanitizedAnswers.experience } },
        { question_type: 'preference', answer: { format: sanitizedAnswers.format } }
      ];

      for (const entry of onboardingEntries) {
        await query(
          'INSERT INTO user_onboarding (user_id, question_type, answer) VALUES (?, ?, ?::jsonb)',
          [userId, entry.question_type, JSON.stringify(entry.answer)]
        );
      }

      const runQuery = query;

      placementTestResult = await generateAndStorePlacementTest({
        runQuery,
        userId,
        goal: sanitizedAnswers.goal,
        experience: sanitizedAnswers.experience,
      });
    } catch (error) {
      console.error('Onboarding submission failed:', error);
      throw error;
    }

    return res.json({
      approved: true,
      message: moderationResult.message || 'Onboarding saved successfully.',
      placementTest: placementTestResult?.placementTest || null,
      placement_test_id: placementTestResult?.placementTestId || null,
      api_usage_id: placementTestResult?.apiUsageId || null,
      api_metadata: placementTestResult?.metadata || null,
    });
  } catch (error) {
    const message = error.message || 'Unable to process onboarding submission.';
    return res.status(502).json({ error: message });
  }
});

router.post('/answer', async (req, res) => {
  const {
    user_id: userId,
    attempt_id: attemptId,
    question_id: questionId,
    response,
    skip,
  } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'A valid user_id is required.' });
  }

  const numericAttemptId = Number(attemptId);
  if (!attemptId || !Number.isFinite(numericAttemptId)) {
    return res.status(400).json({ error: 'A valid attempt_id is required.' });
  }

  const numericQuestionId = Number(questionId);
  if (!questionId || !Number.isFinite(numericQuestionId)) {
    return res.status(400).json({ error: 'A valid question_id is required.' });
  }

  const isSkip = Boolean(skip);
  const hasTypedResponse = response !== undefined && response !== null && String(response).trim() !== '';
  if (!isSkip && !hasTypedResponse) {
    return res.status(400).json({ error: 'Response is required when not skipping.' });
  }

  const runQuery = query;

  const normalizeChoiceLetter = (value) => {
    const raw = String(value ?? '').trim();
    const letterMatch = raw.match(/^[A-D]/i) || raw.match(/([A-D])/i);
    if (!letterMatch) return raw.charAt(0).toUpperCase();
    return letterMatch[0].toUpperCase();
  };

  try {
    const attemptRows = await runQuery(
      'SELECT id, user_id, test_id, completed FROM placement_attempts WHERE id = ? LIMIT 1',
      [numericAttemptId]
    );
    if (attemptRows.length === 0) {
      return res.status(404).json({ error: 'Placement attempt not found.' });
    }

    const attempt = attemptRows[0];
    if (attempt.user_id !== userId) {
      return res.status(403).json({ error: 'User does not own this attempt.' });
    }

    const questionRows = await runQuery(
      'SELECT id, test_id, type, correct_answer, question_text, explanation FROM placement_questions WHERE id = ? LIMIT 1',
      [numericQuestionId]
    );
    if (questionRows.length === 0) {
      return res.status(404).json({ error: 'Placement question not found.' });
    }

    const question = questionRows[0];
    if (question.test_id !== attempt.test_id) {
      return res.status(400).json({ error: 'Question does not belong to this test.' });
    }

    let userResponse = null;
    let isCorrect = null;
    let evaluationIdealAnswer = null;
    let evaluationFeedback = null;
    if (!isSkip) {
      if (question.type === 'multiple_choice') {
        const choice = normalizeChoiceLetter(response);
        userResponse = ['A', 'B', 'C', 'D'].includes(choice) ? choice : null;
        isCorrect = question.correct_answer ? userResponse === question.correct_answer : null;
      } else {
        userResponse = String(response).trim();
        const evaluation = await evaluateTextAnswer({
          questionText: question.question_text,
          referenceAnswer: question.correct_answer,
          explanation: question.explanation,
          userAnswer: userResponse,
        });

        if (evaluation) {
          isCorrect = typeof evaluation.isCorrect === 'boolean' ? evaluation.isCorrect : false;
          evaluationIdealAnswer = evaluation.idealAnswer ?? null;
          evaluationFeedback = evaluation.feedback ?? null;
        } else {
          isCorrect = false;
        }

        if (
          evaluationIdealAnswer &&
          (!question.correct_answer || !String(question.correct_answer).trim())
        ) {
          await runQuery('UPDATE placement_questions SET correct_answer = ? WHERE id = ?', [evaluationIdealAnswer, numericQuestionId]);
          question.correct_answer = evaluationIdealAnswer;
        }
      }
    } else {
      userResponse = null;
      isCorrect = false;
    }

    if (question.type === 'text') {
      await ensureTextEvaluationColumns(runQuery);
    }

    const existingAnswerRows = await runQuery(
      'SELECT id FROM placement_attempt_questions WHERE attempt_id = ? AND question_id = ? LIMIT 1',
      [numericAttemptId, numericQuestionId]
    );

    if (existingAnswerRows.length > 0) {
      const params = [userResponse, isCorrect, existingAnswerRows[0].id];
      if (question.type === 'text') {
        await runQuery(
          'UPDATE placement_attempt_questions SET user_response = ?, is_correct = ?, ideal_answer = ?, evaluation_feedback = ? WHERE id = ?',
          [userResponse, isCorrect, evaluationIdealAnswer, evaluationFeedback, existingAnswerRows[0].id]
        );
      } else {
        await runQuery(
          'UPDATE placement_attempt_questions SET user_response = ?, is_correct = ? WHERE id = ?',
          params
        );
      }
    } else {
      if (question.type === 'text') {
        await runQuery(
          'INSERT INTO placement_attempt_questions (attempt_id, user_id, question_id, user_response, is_correct, ideal_answer, evaluation_feedback) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [numericAttemptId, userId, numericQuestionId, userResponse, isCorrect, evaluationIdealAnswer, evaluationFeedback]
        );
      } else {
        await runQuery(
          'INSERT INTO placement_attempt_questions (attempt_id, user_id, question_id, user_response, is_correct) VALUES (?, ?, ?, ?, ?)',
          [numericAttemptId, userId, numericQuestionId, userResponse, isCorrect]
        );
      }
    }

    const totalQuestionRows = await runQuery(
      'SELECT COUNT(*) AS total FROM placement_questions WHERE test_id = ?',
      [attempt.test_id]
    );
    const answeredQuestionRows = await runQuery(
      'SELECT COUNT(*) AS answered FROM placement_attempt_questions WHERE attempt_id = ?',
      [numericAttemptId]
    );

    const total = totalQuestionRows[0]?.total ?? 0;
    const answered = answeredQuestionRows[0]?.answered ?? 0;
    const completed = total > 0 && answered >= total;

    if (completed && !attempt.completed) {
      await runQuery('UPDATE placement_attempts SET completed = true, end_time = CURRENT_TIMESTAMP WHERE id = ?', [numericAttemptId]);
    }

    let results = null;
    let placementSummary = null;
    if (completed) {
      const summaryRows = await runQuery(
        `SELECT pq.id AS question_id,
                pq.question_text,
                pq.type,
                pq.correct_answer,
                paq.user_response,
                paq.is_correct,
                paq.ideal_answer,
                paq.evaluation_feedback
         FROM placement_questions pq
         LEFT JOIN placement_attempt_questions paq
           ON paq.question_id = pq.id AND paq.attempt_id = ?
         WHERE pq.test_id = ?
         ORDER BY pq.id`,
        [numericAttemptId, attempt.test_id]
      );

      results = summaryRows.map((row) => ({
        question_id: row.question_id,
        question_text: row.question_text,
        type: row.type,
        correct_answer: row.correct_answer,
        user_response: row.user_response,
        is_correct: row.is_correct,
        ideal_answer: row.ideal_answer,
        evaluation_feedback: row.evaluation_feedback,
      }));

      // Build a placement summary using Gemini based on the test results
      try {
        const testInfoRows = await runQuery(
          'SELECT topic, goal, experience_level FROM placement_tests WHERE id = ? LIMIT 1',
          [attempt.test_id]
        );
        const testInfo = testInfoRows[0] || {};
        placementSummary = await summarizePlacementResults({
          topic: testInfo.topic,
          goal: testInfo.goal,
          experience: testInfo.experience_level,
          testResponses: results,
        });
      } catch (e) {
        console.warn('[onboardingRoutes] Failed to build placement summary:', e?.message || e);
        placementSummary = null;
      }
    }

    return res.json({
      ok: true,
      is_correct: isCorrect,
      completed,
      answered,
      total,
      // Provide both, but clients should prefer placement_summary for UX
      results,
      placement_summary: placementSummary,
      evaluation_feedback: evaluationFeedback,
      evaluation_ideal_answer: evaluationIdealAnswer,
    });
  } catch (error) {
    console.error('Answer submission failed:', error);
    return res.status(502).json({ error: error.message || 'Unable to submit answer.' });
  }
});

async function ensureTextEvaluationColumns(runQuery) {
  const idealColumn = await runQuery(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'placement_attempt_questions' AND column_name = 'ideal_answer'`
  );
  if (idealColumn.length === 0) {
    await runQuery('ALTER TABLE placement_attempt_questions ADD COLUMN ideal_answer TEXT NULL');
  }

  const feedbackColumn = await runQuery(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'placement_attempt_questions' AND column_name = 'evaluation_feedback'`
  );
  if (feedbackColumn.length === 0) {
    await runQuery('ALTER TABLE placement_attempt_questions ADD COLUMN evaluation_feedback TEXT NULL');
  }
}

function sanitizeOnboardingAnswers({ goal, experience }) {
  return {
    goal: sanitizeInput(goal ?? ''),
    experience: sanitizeInput(experience ?? '')
  };
}

// Query Gemini to review the learner responses and return a compact decision payload.
async function moderateSanitizedAnswers({ goal, experience }) {
  const moderationPrompt = `You are a strict content and subject reviewer for math-only learning topics.
Analyse the learner onboarding responses below.
Return ONLY a compact JSON object with the following shape:
{
  "approved": true | false,
  "message": "Short friendly sentence explaining the decision"
}

Rules !important:

Approve only if the inputs are math-related

Set "approved": false if the topic or goal contains or promotes:
• Hate, violence, discrimination, or harassment
• Sexual, explicit, or adult material
• Self-harm, suicide, or dangerous acts
• Illegal activity or weapons
• Misinformation, conspiracy theories, or extremist ideology
• Medical, psychological, or pseudoscientific content (e.g. astrology, energy healing)
• Manipulative or unethical skills (e.g. scams, hacking, persuasion tactics)

// super important! set "approved": false if the topic is not math-related and if
• The topic is trivial or non-educational (e.g. “count to 10”, “how to smile”)
• The responses are unclear, joke-like, or nonsensical

set "approved": false if the users goal or experience make no sense or are not math-related, or give a good understanding for generating a placement test.

When rejecting, give a polite short message asking for a clear math-related educational topic.

When approving, just set approved: true and message: "Approved".

Learner responses to moderate:

1) the users math goal: ${goal}

2) the users math experience: ${experience}

`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: moderationPrompt }],
    },
  ];

  const data = await geminiClient.generateContent(contents);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const parsed = parseModerationJson(text);
  const approved = Boolean(parsed.approved);
  const message = (parsed.message ?? text ?? '').trim();

  return { approved, message };
}

// Backwards-friendly wrapper: now delegates to shared util for consistency.
function parseModerationJson(rawText) {
  return parseGeminiJsonText(rawText) || {};
}

function sanitizeInput(value) {
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>`$]/g, '')
    .trim();
}

export default router;
