import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import PdfPrinter from 'pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';
import { createGrokClient } from './grokClient.js';
import { extractTextFromAIResponse, parseJsonSafe } from '../utils/parsers.js';

const GROK_MODEL = 'grok-4-fast-reasoning';
const grokClient = createGrokClient({ model: GROK_MODEL });

const BRAND_PRIMARY = '#5B21B6';
const BRAND_ACCENT = '#14B8A6';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfFonts = {
  NotoSans: {
    normal: path.join(__dirname, '../fonts/NotoSans-VariableFont_wdth,wght.ttf'),
    bold: path.join(__dirname, '../fonts/NotoSans-VariableFont_wdth,wght.ttf'),
    italics: path.join(__dirname, '../fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf'),
    bolditalics: path.join(__dirname, '../fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf'),
  },
};

const pdfPrinter = new PdfPrinter(pdfFonts);
const prompt1 = ({ topic, goal, experience, testResponses }) => {
  const safeTopic = stringOr(topic, 'Mathematics');
  const safeGoal = stringOr(goal, 'Clarify learner goal');
  const safeExperience = stringOr(experience, 'Not provided');
  const responses = Array.isArray(testResponses) ? testResponses : [];

  const responseDigest = responses
    .map((item) => {
      const status = item.is_correct === true ? 'correct' : item.is_correct === false ? 'incorrect' : 'pending';
      return `Q${item.order}: ${status}`;
    })
    .join(', ');

  const correctCount = responses.filter((item) => item.is_correct === true).length;
  const totalCount = responses.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  let estimatedDuration = '12 weeks';
  if (scorePercent < 30) estimatedDuration = '16-20 weeks';
  else if (scorePercent < 60) estimatedDuration = '12-16 weeks';
  else estimatedDuration = '8-12 weeks';

  const studyTime = '5-7 hours/week';

  const conceptPerformanceData = testResponses
    .map((item, index) => {
      const baseLabel = (item.concept || item.question || `Question ${item.order}`).replace(/\s+/g, ' ').trim();
      const shortenedLabel = baseLabel.length > 70 ? `${baseLabel.slice(0, 67)}...` : baseLabel;
      const statusLabel = item.is_correct === true ? 'Secure' : item.is_correct === false ? 'Gap' : 'Pending';
      const answerDetail = item.user_response ? `, answer: ${item.user_response}` : '';
      const correctDetail = item.correct_answer ? `, correct: ${item.correct_answer}` : '';
      return `${index + 1}. ${shortenedLabel} — ${statusLabel}${answerDetail}${correctDetail}`;
    })
    .join('\n') || 'No diagnostic responses yet.';

  return `You an AI education designer specialized in personalized math learning plans.
Keep output clean, short, and bullet-based so it can drop straight into a PDF. and be easy to read

--------------------------
TONE & FORMAT RULES
--------------------------
- Use bullet lists for every section (max 4 bullets).
- Keep each bullet under 14 words.
- Reference real frameworks only once where needed.
- Avoid paragraphs longer than two sentences.
- Leave all placeholders in the following format alone for now: {{placeholder}} (just return as is)

--------------------------
USER SNAPSHOT
--------------------------
Name: Learner
Current Level: '${safeExperience}'
Goal: '${safeGoal}'
Placement Test Results (each question with answer): '${responseDigest}'

--------------------------
OUTPUT FORMAT (follow headings exactly)
--------------------------

## 🧮 Personalized Math Mastery Plan
**Your Goal:** "${safeGoal}"

## 📖 Table of Contents
<ul class="toc-list">
  <li><span class="toc-dot"></span><span class="toc-index">1.</span><span class="toc-label">Learning Strategy Overview</span></li>
  <li><span class="toc-dot"></span><span class="toc-index">2.</span><span class="toc-label">Diagnostic Summary</span></li>
  <li><span class="toc-dot"></span><span class="toc-index">3.</span><span class="toc-label">Learning Plan <span class="toc-note">(placeholder)</span></span></li>
  <li><span class="toc-dot"></span><span class="toc-index">4.</span><span class="toc-label">AI Tutor Insights</span></li>
  <li><span class="toc-dot"></span><span class="toc-index">5.</span><span class="toc-label">Review & Reinforcement Plan</span></li>
  <li><span class="toc-dot"></span><span class="toc-index">6.</span><span class="toc-label">Completion & Endnote</span></li>
</ul>

## 🧠 1. Learning Strategy Overview
- use simple bullet points with short bursts of text for easy readability.
- Explain to the user the most efficient way and learning techniques to achieve their goal: '${safeGoal}' based off the their current experience: '${safeExperience}'.

## 📊 2. Diagnostic Summary
- use simple bullet points with short bursts of text for easy readability.
- create a simple summary of the users current math understanding based of the following data:'${conceptPerformanceData}'.


## 📚 3. Learning Plan
{{learning_plan_placeholder}}


## 💬 4. AI Tutor Insights
- Provide five short coaching tips.

## 📊 5. Review & Reinforcement Plan
- use simple bullet points with short bursts of text for easy readability.
- create a simple summary of the users current math understanding based of the following data:'${conceptPerformanceData}'.

## 🏁 6. Completion & Endnote
- Finish with one uplifting closing bullet.

Output only the formatted document text—no JSON, no extra commentary.`;
};

const prompt2 = ({ userInputs, testResponses }) => {
  const currentLevel = userInputs?.currentLevel ?? 'Not provided';
  const goalLevel = userInputs?.goalLevel ?? 'Clarify learner goal';

  const conceptPerformanceData = testResponses
    .map((item, index) => {
      const baseLabel = (item.concept || item.question || `Question ${item.order}`).replace(/\s+/g, ' ').trim();
      const shortenedLabel = baseLabel.length > 70 ? `${baseLabel.slice(0, 67)}...` : baseLabel;
      const statusLabel = item.is_correct === true ? 'Secure' : item.is_correct === false ? 'Gap' : 'Pending';
      const answerDetail = item.user_response ? `, answer: ${item.user_response}` : '';
      const correctDetail = item.correct_answer ? `, correct: ${item.correct_answer}` : '';
      return `${index + 1}. ${shortenedLabel} — ${statusLabel}${answerDetail}${correctDetail}`;
    })
    .join('\n') || 'No diagnostic responses yet.';

  const testResultsDigest = testResponses
    .map((item, idx) => {
      const status = item.is_correct === true ? '✓ CORRECT' : item.is_correct === false ? '✗ WRONG' : '? PENDING';
      const conceptInfo = item.concept ? ` (Concept: ${item.concept})` : '';
      return `Q${idx + 1}: ${item.question}${conceptInfo}\n   User Answer: ${item.user_response ?? 'No answer'}\n   Correct Answer: ${item.correct_answer ?? 'N/A'}\n   Result: ${status}`;
    })
    .join('\n\n');

  const correctCount = testResponses.filter((item) => item.is_correct === true).length;
  const totalCount = testResponses.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const strengths = testResponses
    .filter((item) => item.is_correct === true && item.concept)
    .map((item) => item.concept)
    .join(', ') || 'None identified';

  const weakSpots = testResponses
    .filter((item) => item.is_correct === false && item.concept)
    .map((item) => item.concept)
    .join(', ') || 'None identified';

  return `You are an expert math course designer.

Your task: Build a **personalized, perfectly ordered learning plan** that bridges the learner's **true current level (detected from placement test results)** to their **goal level**, without going beyond it.

for now we are only creating the empty modules.

This plan must automatically adjust its **length** depending on how far the learner's current experience taken from the (placement test results) is from their stated goal: '${goalLevel}':
- For small gaps (e.g., Year 8 → Year 9), create concise courses (≈ 15–20 modules).
- For medium gaps (e.g., Year 6 → Year 9), create concise courses (≈ 25-50 modules).
- For large gaps (e.g., Year 3 → Year 9), create concise courses (≈ 50-70 modules).
- For extra large gaps (e.g., Year 3 → A-Level), expand the plan into a complete long-term pathway (≈ 100+ modules).

Generate the high-level module structure organized into phases. Keep module titles specific (not calculus, split into derivatives and integrals).

Use up to **7 targeted web searches** to confirm the correct modern sequencing, terminology, checking links, or specification for the given subject and goal.

---

### INPUTS
Goal: '${goalLevel}'

Placement Test Results: '${conceptPerformanceData}'

Strengths (from test): '${strengths}'
Weak-spots (from test): '${weakSpots}'

---

### REASONING INSTRUCTIONS
1. **Detect the users true current math understand**
   Analyse the placement test results, strengths and weak-spots to determine what the learner actually understands.

2. **Define the goal boundary**
   Identify precisely what the learner must know to reach their goal.
   This defines the *highest allowed level* — stop there.

3. **Build a complete prerequisite chain**
   Map every single concept from their current understanding (based of test results, strengths and weak-spots) to the goal: '${goalLevel}'.
   Ensure every skill required for the goal appears in the plan if they have not proven mastery of it in the placement test.
   Each new module must build on previously introduced concepts.
   Do not skip anything or add a module with a skill that was not previously introduced in a previous module.
   - if a concept around the users current level is not in the placement test, add it to the plan.

4. **Adapt to learner profile**
   Expand and scaffold weak areas from the placement test; don't recap any skills that the learner has proven mastery of.

5. **Organize into logical phases**
   Group modules into phases for each topic e.g. (Algebra, Pythagros Theroem, Differential Calculus, etc)
   Each phase should have a clear title explaining its purpose in the learning journey.

6. **Use web search wisely (≤10)**
   Only when confirming curriculum order, updated specifications, or technical accuracy.

7. **Stop exactly at goal level**
   Do not include topics that belong to levels above the goal.

---

###MODULE GRANULARITY EXAMPLES
NOT “Pythagorean Theorem” BUT:

NOT “Fractions” BUT:
- Module 8: Adding fractions with the same denominator
- Module 9: Finding and using common denominators
- Module 10: Adding fractions with different denominators
- Module 11: Subtracting fractions
- Module 12: Multiplying fractions

---

### OUTPUT FORMAT

## 📚 3. Learning Plan

### 📖 Phase 1: [Phase Title]
*[Brief overview of what this phase covers - one sentence]*

#### 📝 Module 1: [specific skill (remember this is a learning plan not a course)]
{{details_to_be_filled}}

#### 📝 Module 2: [specific skill (remember this is a learning plan not a course)]
{{details_to_be_filled}}

### 📖 Phase 2: [Phase Title]
*[Brief overview - one sentence]*

#### 📝 Module N: [specific skill (remember this is a learning plan not a course)]
{{details_to_be_filled}}

[Continue through all phases]

---

### CRITICAL RULES
- Auto-scale module count based on gap (15-20 for small, 25-50 for medium, 50-70 for large, 100+ for extra large)
- Organize into phases that represent topics
- Each module title ultra-specific (not "algebra" but "solving one-step addition equations")
- Perfect dependency order (Module N requires Module N-1)
- Use web search to verify curriculum progressions
- {{details_to_be_filled}} for all module content
- Return ONLY the learning plan section (no JSON, no extra commentary)`;
};

const prompt3 = ({ stage2Structure, userInputs, testResponses }) => {
  const currentLevel = userInputs?.currentLevel ?? 'Not provided';
  const goalLevel = userInputs?.goalLevel ?? 'Clarify learner goal';

  const conceptPerformanceData = testResponses
    .map((item, index) => {
      const baseLabel = (item.concept || item.question || `Question ${item.order}`).replace(/\s+/g, ' ').trim();
      const shortenedLabel = baseLabel.length > 70 ? `${baseLabel.slice(0, 67)}...` : baseLabel;
      const statusLabel = item.is_correct === true ? 'Secure' : item.is_correct === false ? 'Gap' : 'Pending';
      const answerDetail = item.user_response ? `, answer: ${item.user_response}` : '';
      const correctDetail = item.correct_answer ? `, correct: ${item.correct_answer}` : '';
      return `${index + 1}. ${shortenedLabel} — ${statusLabel}${answerDetail}${correctDetail}`;
    })
    .join('\n') || 'No diagnostic responses yet.';

  const testResultsDigest = testResponses
    .map((item, idx) => {
      const status = item.is_correct === true ? '✓ CORRECT' : item.is_correct === false ? '✗ WRONG' : '? PENDING';
      const conceptInfo = item.concept ? ` (Concept: ${item.concept})` : '';
      return `Q${idx + 1}: ${item.question}${conceptInfo}\n   User Answer: ${item.user_response ?? 'No answer'}\n   Correct Answer: ${item.correct_answer ?? 'N/A'}\n   Result: ${status}`;
    })
    .join('\n\n');

  const correctCount = testResponses.filter((item) => item.is_correct === true).length;
  const totalCount = testResponses.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return `You are an expert curriculum designer. Fill in the {{details_to_be_filled}} placeholders for each module and checkpoint with ULTRA-CONCISE, actionable content.

Context:
- Goal: "${goalLevel}".

Placement Test Details: "${conceptPerformanceData}".

---

### YOUR TASK
For each module, provide:

**Goal:** One crisp sentence (8-12 words) stating what the learner will master.
**Practice:** 2-3 specific activities. (real platforms + URLs preferred (working links)).
**Resource:** ONE best learning resource with URL (working URLs).
**Check:** Simple success criterion to verify mastery.

---

### OUTPUT FORMAT

Keep exact headings and module titles from the structure. Fill only the {{details_to_be_filled}} sections.

${stage2Structure}

---

### EXAMPLES OF GOOD BREVITY

#### Module 12: Finding hypotenuse when legs are known

**Goal:** Use a² + b² = c² to calculate the long side of a triangle.

**Practice:**
- Khan Academy: "Pythagorean theorem (hypotenuse)" - https://khanacademy.org/math/geometry
- IXL: "Find the hypotenuse" - https://ixl.com/math/grade-8

**Resource:** Khan Academy Pythagorean Theorem - https://khanacademy.org/

**Check:** Solve 5 right triangle problems correctly.

---

### CRITICAL RULES
- Keep ALL phase titles, module titles, and structure EXACTLY as given
- Ultra-brief (no fluff, no essays)
- Prefer real, current working URLs (Khan Academy, IXL, Brilliant, Desmos, etc.)
- Each module = 8-15 minute focused session
- Return ONLY the filled learning plan (no extra commentary)`;
};

const finalPlanPrompt = ({goal, experience, testResponses, stage2Structure }) => {
  const currentLevel = experience ?? 'Not provided';
  const goalLevel = goal ?? 'Clarify learner goal';

  const testResultsDigest = testResponses
    .map((item, idx) => {
      const status = item.is_correct === true ? '✓ CORRECT' : item.is_correct === false ? '✗ WRONG' : '? PENDING';
      const conceptInfo = item.concept ? ` (Concept: ${item.concept})` : '';
      return `Q${idx + 1}: ${item.question}${conceptInfo}\n   User Answer: ${item.user_response ?? 'No answer'}\n   Correct Answer: ${item.correct_answer ?? 'N/A'}\n   Result: ${status}`;
    })
    .join('\n\n');

  const correctCount = testResponses.filter((item) => item.is_correct === true).length;
  const totalCount = testResponses.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return `You are an expert curriculum designer. 
  
  task: Fill in the {{details_to_be_filled}} placeholders for each module and checkpoint with ULTRA-CONCISE, actionable content.

---

### YOUR TASK
For each module, provide:

🎯 **Goal:** One crisp sentence (8-12 words) stating what the learner will master.
📚 **Resource:** ONE best learning resource with URL.
✓ **Check:** Simple success criterion to verify mastery.

For checkpoint modules:
🔍 **Focus:** What concepts to review.
🎉 **Success:** How to know you're ready to move forward.

---

### OUTPUT FORMAT

Keep exact headings and module titles from the structure. Fill only the {{details_to_be_filled}} sections.

${stage2Structure}

---

### EXAMPLES OF GOOD BREVITY

#### 📝 Module 12: Finding hypotenuse when legs are known

🎯 **Goal:** Use a² + b² = c² to calculate the long side.

📚 **Resource:** Khan Academy Pythagorean Theorem - https://khanacademy.org/math/geometry // this must be a link to learn the exact skill, do web search in necessary

✓ **Check:** Solve 5 right triangle problems correctly.

---

### CRITICAL RULES
- Keep ALL phase titles, module titles, emojis, and structure EXACTLY as given
- Ultra-brief (no fluff, no essays)
- Use real, current URLs (Khan Academy, IXL, Brilliant, Desmos, etc.)
- Each module = 8-15 minute focused session
- Include emojis before Goal (🎯), Resource (📚), Check (✓), Focus (🔍), Success (🎉)
- Return ONLY the filled learning plan (no extra commentary)`;
};

export async function summarizePlacementResults({ topic, goal, experience, testResponses }) {
  const safeTopic = stringOr(topic, 'Mathematics');
  const safeGoal = stringOr(goal, 'Clarify learner goal');
  const safeExperience = stringOr(experience, 'Not provided');
  const sanitizedResponses = sanitizeResponses(testResponses);

  const debugResults = sanitizedResponses.map((item) => ({
    order: item.order,
    concept: item.concept || '',
    question: item.question,
    user_response: item.user_response,
    correct_answer: item.correct_answer,
    is_correct: item.is_correct,
  }));
  console.log('[Debug] Placement test question results:', debugResults);

  // STAGE 1: Generate framework without learning plan
  console.log('[Stage 1 Variables] topic:', safeTopic);
  console.log('[Stage 1 Variables] goal:', safeGoal);
  console.log('[Stage 1 Variables] experience:', safeExperience);
  console.log('[Stage 1 Variables] testResponses count:', sanitizedResponses?.length || 0);
  console.log('[Stage 1 Variables] testResponses sample:', sanitizedResponses?.slice(0, 2));
  
  const stage1Prompt = prompt1({
    topic: safeTopic,
    goal: safeGoal,
    experience: safeExperience,
    testResponses: sanitizedResponses,
  });

  let frameworkResponse = null;
  let stage1RawResponse = '';

  console.log('[Stage 1] Generating framework with Grok (web search enabled)...');
  
  try {
    const payload = {
      messages: [
        { role: 'system', content: 'You are Grok, an AI education designer and reasoning model specialized in personalized math learning plans.' },
        { role: 'user', content: stage1Prompt },
      ],
      temperature: 0.3,
      max_output_tokens: 4000,
      web_search: {
        enable: true,
        max_results: 5,
        sources: [{ type: 'web' }],
      },
    };

    const response = await grokClient.generateCompletion(payload);
    const rawContent = extractTextFromAIResponse(response);
    stage1RawResponse = rawContent || '';
    frameworkResponse = rawContent;
    
    console.log('[Stage 1] Framework generated successfully');
    console.log('[Stage 1] Framework preview:', stage1RawResponse.substring(0, 500) + '...');
  } catch (error) {
    console.error('[Stage 1] Framework generation failed:', error?.message || error);
    console.warn('[Stage 1] Using fallback framework - will continue to generate PDF anyway');
    // Use a minimal framework as fallback
    frameworkResponse = `## Learning Plan Summary\n\n**Goal:** ${safeGoal}\n**Current Level:** ${safeExperience}\n**Assessment Score:** ${Math.round((sanitizedResponses.filter(r => r.is_correct).length / sanitizedResponses.length) * 100)}%\n\nYour personalized learning plan has been generated based on your placement test results.`;
    stage1RawResponse = frameworkResponse;
  }

  // Store the stage 1 response for the next prompt
  const stage1Context = {
    frameworkResponse: stage1RawResponse,
    userInputs: {
      name: 'Learner', // Can be enhanced to pull from user profile
      currentLevel: safeExperience,
      goalLevel: safeGoal,
      duration: '12 weeks', // Can be calculated based on assessment
      studyTime: '5-7 hours/week', // Can be from user preferences
    },
  };

  console.log('[Stage 1 Complete] ✓ Framework generated');
  console.log('[Progress] Stage 1/4 complete - Starting Stage 2...');
  console.log('[Stage 2] Generating phased module structure (auto-scaled to learner gap)...');

  // STAGE 2: Generate phased module structure (auto-scaled based on gap: 12-130+ modules organized in 3-5 phases)
  let stageStructure = null;
  let stage2RawResponse = '';

  try {
    console.log('[Stage 2 Variables] userInputs:', JSON.stringify(stage1Context.userInputs, null, 2));
    console.log('[Stage 2 Variables] testResponses count:', sanitizedResponses?.length || 0);
    console.log('[Stage 2 Variables] testResponses sample:', sanitizedResponses?.slice(0, 2));
    
    const stage2Prompt = prompt2({
      userInputs: stage1Context.userInputs,
      testResponses: sanitizedResponses,
    });

    const payload = {
      messages: [
        { role: 'system', content: 'You are an expert curriculum designer and cognitive learning scientist specializing in personalized learning pathways.' },
        { role: 'user', content: stage2Prompt },
      ],
      temperature: 0.3,
      max_output_tokens: 5000,
      web_search: {
        enable: true,
        max_results: 7,
        sources: [{ type: 'web' }],
      },
    };

    const response = await grokClient.generateCompletion(payload);
    const rawContent = extractTextFromAIResponse(response);
    stage2RawResponse = rawContent || '';
    stageStructure = rawContent;
    
    console.log('[Stage 2 Complete] ✓ Phased module structure created');
    console.log('[Stage 2] Structure includes phases, modules, and checkpoints in dependency order');
    console.log('[Progress] Stage 2/4 complete - Starting Stage 3...');
  } catch (error) {
    console.error('[Stage 2] Module structure generation failed:', error?.message || error);
    console.warn('[Stage 2] Falling back to existing plan generation');
  }

  // STAGE 3: Fill in concise content for each module using finalPlanPrompt
  let stage3RawResponse = '';

  if (stageStructure) {
    console.log('[Stage 3] Filling in concise content for each module...');
    
    // Extract only the learning plan section from stage 2 response
    console.log('[Stage 3] Extracting learning plan section from stage 2...');
    const learningPlanSection = extractLearningPlanSection(stage2RawResponse);
    console.log('[Stage 3] Extracted section length:', learningPlanSection.length, 'characters (vs full:', stage2RawResponse.length, ')');

    try {
      console.log('[Stage 3 Variables] goal:', safeGoal);
      console.log('[Stage 3 Variables] experience:', safeExperience);
      console.log('[Stage 3 Variables] testResponses count:', sanitizedResponses?.length || 0);
      console.log('[Stage 3 Variables] stage2Structure length:', learningPlanSection?.length || 0);
      console.log('[Stage 3 Variables] stage2Structure preview:', learningPlanSection?.substring(0, 300));
      
      const stage3Prompt = finalPlanPrompt({
        goal: safeGoal,
        experience: safeExperience,
        testResponses: sanitizedResponses,
        stage2Structure: learningPlanSection,  // Send only the learning plan section
      });

      const payload = {
        messages: [
          { role: 'system', content: 'You are an expert curriculum designer specializing in creating actionable, concise learning content.' },
          { role: 'user', content: stage3Prompt },
        ],
        temperature: 0.3,
        max_output_tokens: 8000,
        web_search: {
          enable: true,
          max_results: 7,
          sources: [{ type: 'web' }],
        },
      };

      const response = await grokClient.generateCompletion(payload);
      const rawContent = extractTextFromAIResponse(response);
      stage3RawResponse = rawContent || '';
      
      console.log('[Stage 3 Complete] ✓ Module content filled with ultra-concise details');
      console.log('[Stage 3] Content includes: goals, practice activities, resources, checkpoints');
      console.log('[Progress] Stage 3/3 complete - Starting stitching and PDF generation...');
    } catch (error) {
      console.error('[Stage 3] Detailed content generation failed:', error?.message || error);
      console.warn('[Stage 3] Using structure without detailed content');
      stage3RawResponse = stage2RawResponse; // Fallback to structure only
    }
  }

  // Update context with all stage responses
  stage1Context.stageStructure = stage2RawResponse;
  stage1Context.detailedLearningPlan = stage3RawResponse;

  // STITCH: Combine Stage 1 (Framework) + Stage 3 (Complete Section 3) AFTER stage 3 returns
  console.log('[Stitching] Combining Stage 1 framework + Stage 3 detailed plan...');
  let combinedDocument = stage1RawResponse;
  if (stage3RawResponse) {
    const blockPlaceholder = '## 📚 3. Learning Plan\n{{learning_plan_placeholder}}';
    if (combinedDocument.includes(blockPlaceholder)) {
      combinedDocument = combinedDocument.replace(blockPlaceholder, stage3RawResponse);
    } else if (combinedDocument.includes('{{learning_plan_placeholder}}')) {
      combinedDocument = combinedDocument.replace('{{learning_plan_placeholder}}', stage3RawResponse);
    } else {
      combinedDocument = `${combinedDocument}\n\n${stage3RawResponse}`;
    }
  }
  stage1Context.combinedDocument = combinedDocument;
  console.log('[Stitching Complete] ✓ Document combined successfully');

  // Generate simple metadata for legacy compatibility
  let planPayload = null;

  const normalizedPlan = normalizePlan(null, {
    topic: safeTopic,
    goal: safeGoal,
    experience: safeExperience,
    testResponses: sanitizedResponses,
  });

  // Generate PDF from the comprehensive multi-stage plan
  let pdf = null;
  console.log('[PDF Generation] Starting PDF creation...');
  
  try {
    let buffer = null;
    
    // Use the enhanced multi-stage content if available, otherwise fall back to normalized plan
    const hasMultiStageContent = stage1Context.combinedDocument && stage1Context.combinedDocument.length > 50;
    
    if (hasMultiStageContent) {
      console.log('[PDF Generation] Using multi-stage markdown document');
      try {
        buffer = await generateMarkdownPdf(stage1Context.combinedDocument, {
          topic: safeTopic,
          goal: safeGoal,
          experience: safeExperience,
          score: normalizedPlan.score,
          level: normalizedPlan.level,
        });
      } catch (pdfError) {
        console.error('[PDF Generation] Multi-stage PDF failed, trying legacy:', pdfError.message);
        buffer = null;
      }
    }
    
    // Fallback to legacy plan if multi-stage failed or wasn't available
    if (!buffer) {
      console.log('[PDF Generation] Using legacy structured plan (fallback)');
      buffer = await generateLegacyPlanPdf(normalizedPlan, {
        topic: safeTopic,
        goal: safeGoal,
        experience: safeExperience,
      });
    }
    
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('PDF buffer is invalid or empty');
    }
    
    const base64String = buffer.toString('base64');
    console.log('[PDF Generation] Base64 encoded, length:', base64String.length);
    console.log('[PDF Generation] Base64 preview:', base64String.substring(0, 50));
    
    pdf = {
      filename: buildPdfFilename(safeGoal),
      contentType: 'application/pdf',
      base64: base64String,
    };
    console.log('[PDF Generation] ✓ PDF created successfully');
    console.log('[Progress] Stage 4/4 complete - All stages finished!');
  } catch (error) {
    console.error('[PDF Generation] ❌ CRITICAL: Failed to build PDF:', error?.message || error);
    console.error('[PDF Generation] Stack:', error?.stack);
    console.error('[PDF Generation] This means the download button will be disabled!');
  }

  console.log('[Complete] ✓ Returning placement summary to frontend');  
  console.log('[PDF Status]', pdf ? `✓ PDF ready (${pdf.filename}, ${pdf.base64?.length || 0} chars)` : '✗ PDF is NULL - generation failed');
  
  // Build progress metadata for frontend visibility
  const stageProgress = {
    stage1_completed: !!stage1Context.frameworkResponse,
    stage2_completed: !!stage1Context.stageStructure,
    stage3_completed: !!stage1Context.detailedLearningPlan,
    pdf_generated: !!pdf,
    total_stages: 4,
    completed_stages: [
      !!stage1Context.frameworkResponse,
      !!stage1Context.stageStructure,
      !!stage1Context.detailedLearningPlan,
      !!pdf
    ].filter(Boolean).length,
  };
  
  return {
    success: true,
    summary: normalizedPlan.summary,
    score: normalizedPlan.score,
    level: normalizedPlan.level,
    experienceAnchor: normalizedPlan.experienceAnchor,
    goalAlignment: normalizedPlan.goalAlignment,
    prerequisites: normalizedPlan.prerequisites,
    learningPath: normalizedPlan.learningPath,
    recommendedTopics: normalizedPlan.recommendedTopics,
    callToAction: normalizedPlan.callToAction,
    pdf,
    progress: stageProgress,
    multiStageContext: {
      stage1Framework: stage1Context.frameworkResponse,
      stage2Structure: stage1Context.stageStructure,
      stage3DetailedPlan: stage1Context.detailedLearningPlan,
      combinedDocument: stage1Context.combinedDocument,
      userInputs: stage1Context.userInputs,
    },
  };
}

function sanitizeResponses(responses) {
  if (!Array.isArray(responses)) return [];
  return responses.map((item, index) => ({
    order: index + 1,
    question: stringOr(item?.question_text, ''),
    concept: stringOr(item?.assesses ?? item?.concept, ''),
    type: stringOr(item?.type, ''),
    correct_answer: stringOr(item?.correct_answer, ''),
    user_response: item?.user_response ?? null,
    is_correct: normalizeBoolean(item?.is_correct),
    ideal_answer: item?.ideal_answer ?? null,
    evaluation_feedback: item?.evaluation_feedback ?? null,
  }));
}


function normalizePlan(raw, context) {
  const correctCount = context.testResponses.filter((item) => item.is_correct === true).length;
  const total = context.testResponses.length || 0;
  const computedScore = computeDiagnosticScore(context.testResponses);
  const scoreLevel = computedScore > 66 ? 'Advanced' : computedScore > 33 ? 'Intermediate' : 'Beginner';

  const summary = stringOr(raw?.summary, `Your placement shows strengths to build on from ${context.experience}. Let's map a path toward ${context.goal}.`);
  const level = stringOr(raw?.level, scoreLevel);

  return {
    summary,
    score: computedScore,
    level,
    experienceAnchor: stringOr(raw?.experience_anchor, summarizeExperience(context.testResponses, context.experience)),
    goalAlignment: stringOr(raw?.goal_alignment, `Achieving ${context.goal} will require consolidating core competencies and stretching into advanced problem solving.`),
    prerequisites: normalizeArray(raw?.prerequisites).map((item) => ({
      title: stringOr(item?.title, 'Core skills'),
      status: stringOr(item?.status, 'developing'),
      focus: stringOr(item?.focus, 'Deepen conceptual understanding and procedural fluency.'),
      recommended_actions: normalizeArray(item?.recommended_actions).map((action) => stringOr(action, '')).filter(Boolean),
    })),
    learningPath: normalizeArray(raw?.learning_path).map((phase, index) => ({
      phase: stringOr(phase?.phase, `Phase ${index + 1}`),
      durationWeeks: numberOr(phase?.duration_weeks, 4),
      focus: stringOr(phase?.focus, 'Master key prerequisites and build confidence.'),
      milestones: normalizeArray(phase?.milestones).map((item) => stringOr(item, '')).filter(Boolean),
      successMetrics: normalizeArray(phase?.success_metrics).map((item) => stringOr(item, '')).filter(Boolean),
    })),
    recommendedTopics: normalizeArray(raw?.recommended_topics).map((topic, index) => ({
      name: stringOr(topic?.name, `Topic ${index + 1}`),
      difficulty: stringOr(topic?.difficulty, 'Core'),
      rationale: stringOr(topic?.rationale, 'Important stepping stone toward the target goal.'),
      practiceIdeas: normalizeArray(topic?.practice_ideas).map((idea) => stringOr(idea, '')).filter(Boolean),
    })),
    callToAction: stringOr(raw?.call_to_action, "Let's keep momentum going—commit to a regular study rhythm and celebrate each milestone!"),
  };
}

function summarizeExperience(testResponses, experience) {
  const attempted = testResponses.filter((item) => item.user_response !== null);
  if (attempted.length === 0) {
    return `Experience reported as ${experience}. Encourage learner to complete diagnostic for deeper insights.`;
  }
  const correct = attempted.filter((item) => item.is_correct === true).length;
  const experienceLabel = stringOr(experience, 'current level');
  const descriptor = typeof experienceLabel === 'string' ? experienceLabel.toLowerCase() : 'current level';
  return `Learner demonstrated mastery on ${correct} of ${attempted.length} answered tasks, indicating a ${descriptor} foundation (${experienceLabel}).`;
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeArray(parsed);
    } catch {
      return trimmed
        .split(/[\n,;]+/)
        .map((item) => item.replace(/^[-*•\u2022]+\s*/, '').trim())
        .filter(Boolean);
    }
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
      .filter(Boolean);
  }
  return [];
}

function stringOr(value, fallback) {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function numberOr(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function computeDiagnosticScore(responses) {
  if (!Array.isArray(responses) || responses.length === 0) {
    return 0;
  }
  const total = responses.length;
  const correct = responses.filter((item) => normalizeBoolean(item?.is_correct) === true).length;
  const score = Math.round((correct / total) * 100);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function normalizeBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return null;
}

function buildPdfFilename(goal) {
  const goalText = stringOr(goal, 'goal');
  const safeGoal = goalText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const timestamp = new Date().toISOString().split('T')[0];
  return `wurlo-learning-plan-${safeGoal || 'goal'}-${timestamp}.pdf`;
}

async function generateMarkdownPdf(markdown, meta) {
  const html = await renderHtmlFromMarkdown(markdown, meta);
  return renderHtmlToPdf(html, meta);
}

async function generateLegacyPlanPdf(plan, meta) {
  const html = renderLegacyPlanHtml(plan, meta);
  return renderHtmlToPdf(html, meta);
}

async function renderHtmlToPdf(html, meta) {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const { window } = dom;
  const wrapper = window.document.createElement('div');
  wrapper.innerHTML = html;

  // Convert HTML to pdfmake with custom styling preservation
  const pdfmakeContent = htmlToPdfmake(wrapper.innerHTML, { 
    window,
    defaultStyles: {
      p: { margin: [0, 5, 0, 5], color: '#475569', fontSize: 11, lineHeight: 1.5 },
      h1: { fontSize: 24, bold: true, color: '#0f172a', margin: [0, 0, 0, 12] },
      h2: { fontSize: 18, bold: true, color: '#0f172a', margin: [0, 20, 0, 10] },
      h3: { fontSize: 15, bold: true, color: '#0f172a', margin: [0, 15, 0, 8], fillColor: '#f8fafc', padding: [12, 10] },
      h4: { fontSize: 13, bold: true, color: '#0f172a', margin: [0, 12, 0, 6] },
      ul: { margin: [0, 5, 0, 10] },
      li: { margin: [0, 3, 0, 3], color: '#475569' },
      strong: { bold: true, color: '#0f172a' },
      em: { italics: true },
    },
  });

  // Add header with branding
  const headerContent = [
    {
      text: 'Wurlo',
      fontSize: 28,
      bold: true,
      color: '#0f172a',
      margin: [0, 0, 0, 8],
    },
    {
      columns: [
        { text: `Goal: ${meta?.goal || 'Learning Plan'}`, fontSize: 11, color: '#475569' },
        { text: `Level: ${meta?.experience || 'Custom'}`, fontSize: 11, color: '#475569', alignment: 'right' },
      ],
      margin: [0, 0, 0, 0],
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#14B8A6' }],
      margin: [0, 8, 0, 20],
    },
  ];

  // Add footer CTA
  const footerCTA = {
    stack: [
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
        margin: [0, 20, 0, 15],
      },
      {
        columns: [
          {
            stack: [
              { text: '🚀 Ready to start learning?', fontSize: 12, bold: true, color: '#0f172a', margin: [0, 0, 0, 4] },
              { text: 'Generate a full personalized course based on this plan.', fontSize: 10, color: '#64748b' },
            ],
          },
          {
            text: 'Visit wurlo.org',
            fontSize: 11,
            bold: true,
            color: '#14B8A6',
            alignment: 'right',
            margin: [0, 8, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 20, 0, 0],
  };

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 70],
    defaultStyle: {
      font: 'NotoSans',
      fontSize: 11,
      lineHeight: 1.4,
      color: '#0f172a',
    },
    styles: {
      brand: { fontSize: 28, bold: true, color: '#0f172a', margin: [0, 0, 0, 8] },
      sectionHeader: { fontSize: 18, bold: true, color: '#0f172a', margin: [0, 20, 0, 10], decoration: 'underline', decorationColor: '#14B8A6' },
      phaseHeader: { fontSize: 15, bold: true, color: '#0f172a', fillColor: '#f8fafc', margin: [0, 15, 0, 8] },
      moduleHeader: { fontSize: 13, bold: true, color: '#0f172a', margin: [0, 12, 0, 6] },
      body: { fontSize: 11, color: '#475569', margin: [0, 5, 0, 5], lineHeight: 1.5 },
      emphasis: { bold: true, color: '#0f172a' },
      cta: { fontSize: 11, bold: true, color: '#14B8A6' },
    },
    content: [
      ...headerContent,
      ...pdfmakeContent,
      footerCTA,
    ],
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 20],
      columns: [
        { text: `© ${new Date().getFullYear()} Wurlo`, alignment: 'left', fontSize: 9, color: '#94a3b8' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 9, color: '#94a3b8' },
      ],
    }),
  };

  return new Promise((resolve, reject) => {
    try {
      console.log('[PDF] Creating document with pdfmake...');
      const pdfDoc = pdfPrinter.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('[PDF] ✓ Document created, size:', buffer.length, 'bytes');
        resolve(buffer);
      });
      pdfDoc.on('error', (err) => {
        console.error('[PDF] ✗ Generation error:', err);
        reject(err);
      });
      pdfDoc.end();
    } catch (err) {
      console.error('[PDF] ✗ Setup error:', err);
      reject(err);
    }
  });
}

async function renderHtmlFromMarkdown(markdown, meta) {
  const content = await marked.parse(markdown, { headerIds: false, async: false });
  const body = `<section class="markdown-content">${content}</section>`;
  return wrapWithHtmlTemplate(body, meta);
}

function renderLegacyPlanHtml(plan, meta) {
  const metrics = [];
  if (Number.isFinite(plan.score)) metrics.push({ label: 'Diagnostic Score', value: `${plan.score}%` });
  if (plan.level) metrics.push({ label: 'Mastery Level', value: plan.level });
  if (plan.experienceAnchor) metrics.push({ label: 'Experience Anchor', value: plan.experienceAnchor });
  if (plan.goalAlignment) metrics.push({ label: 'Goal Alignment', value: plan.goalAlignment });

  const metricsHtml = metrics
    .map((metric) => `<div class="metric-item"><span class="metric-label">${escapeHtml(metric.label)}</span><span class="metric-value">${escapeHtml(metric.value)}</span></div>`)
    .join('');

  const prerequisitesHtml = (plan.prerequisites || [])
    .map((item) => `<section class="card"><h3>${escapeHtml(item.title)} • ${escapeHtml(item.status?.toUpperCase() || '')}</h3>${item.focus ? `<p>${escapeHtml(item.focus)}</p>` : ''}${renderList(item.recommended_actions)}</section>`)
    .join('');

  const learningPathHtml = (plan.learningPath || [])
    .map((phase) => `
      <section class="card">
        <h3>${escapeHtml(phase.phase)} (${phase.durationWeeks} weeks)</h3>
        ${phase.focus ? `<p>${escapeHtml(phase.focus)}</p>` : ''}
        ${renderList(phase.milestones, 'Milestones')}
        ${renderList(phase.successMetrics, 'Success Metrics')}
      </section>
    `)
    .join('');

  const topicsHtml = (plan.recommendedTopics || [])
    .map((topic) => `
      <section class="card">
        <h3>${escapeHtml(topic.name)} • ${escapeHtml(topic.difficulty)}</h3>
        ${topic.rationale ? `<p>${escapeHtml(topic.rationale)}</p>` : ''}
        ${renderList(topic.practiceIdeas)}
      </section>
    `)
    .join('');

  const callToActionHtml = plan.callToAction ? `<section class="cta"><h2>Call to Action</h2><p>${escapeHtml(plan.callToAction)}</p></section>` : '';

  const body = `
    <section class="header">
      <div class="brand">Wurlo</div>
      <div class="meta">
        <div><strong>Goal:</strong> ${escapeHtml(meta.goal)}</div>
        <div><strong>Starting point:</strong> ${escapeHtml(meta.experience)}</div>
      </div>
    </section>
    <section class="summary">
      <h2>Executive Summary</h2>
      <p>${escapeHtml(plan.summary)}</p>
      <div class="metrics">${metricsHtml}</div>
    </section>
    <section>
      <h2>Prerequisite Priorities</h2>
      <div class="grid">${prerequisitesHtml}</div>
    </section>
    <section>
      <h2>Phased Learning Path</h2>
      <div class="grid">${learningPathHtml}</div>
    </section>
    <section>
      <h2>Recommended Topics & Practice</h2>
      <div class="grid">${topicsHtml}</div>
    </section>
    ${callToActionHtml}
  `;

  return wrapWithHtmlTemplate(body, meta);
}

function wrapWithHtmlTemplate(body, meta) {
  const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wurlo Learning Plan</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      
      * {
        box-sizing: border-box;
      }
      
      :root {
        --primary: #0f172a;
        --primary-light: #1e293b;
        --accent: #14B8A6;
        --text: #0f172a;
        --text-medium: #475569;
        --text-light: #64748b;
        --bg: #ffffff;
        --bg-subtle: #f8fafc;
        --border: #e2e8f0;
        --border-light: #f1f5f9;
        --success: #10b981;
        --warning: #f59e0b;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 24px;
        background: var(--bg-subtle);
        color: var(--text);
        font-size: 14px;
        line-height: 1.7;
      }
      
      main {
        max-width: 800px;
        margin: 0 auto;
        background: var(--bg);
        border-radius: 2px;
        overflow: hidden;
      }
      
      /* Header Section - Clean, App-like */
      .header {
        background: var(--bg);
        color: var(--text);
        padding: 32px 40px;
        border-bottom: 1px solid var(--border);
      }
      
      .brand {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--primary);
        margin-bottom: 8px;
      }
      
      .meta {
        font-size: 13px;
        color: var(--text-medium);
        line-height: 1.6;
      }
      
      .meta > div {
        margin: 4px 0;
      }
      
      .meta strong {
        font-weight: 600;
        color: var(--text);
      }
      
      section {
        padding: 32px 40px;
      }
      
      /* Typography Hierarchy - Clear & Minimal */
      h1 {
        font-size: 32px;
        font-weight: 700;
        margin: 0 0 20px 0;
        color: var(--primary);
        line-height: 1.2;
        letter-spacing: -0.02em;
      }
      
      h2 {
        font-size: 20px;
        font-weight: 700;
        margin: 48px 0 16px 0;
        color: var(--primary);
        line-height: 1.3;
        letter-spacing: -0.01em;
      }
      
      h3 {
        font-size: 17px;
        font-weight: 600;
        margin: 32px 0 12px 0;
        color: var(--primary);
        line-height: 1.4;
      }
      
      h4 {
        font-size: 15px;
        font-weight: 600;
        margin: 24px 0 8px 0;
        color: var(--text);
        line-height: 1.5;
      }
      
      p {
        margin: 12px 0;
        color: var(--text-medium);
        line-height: 1.7;
        font-size: 14px;
      }
      
      /* Table of Contents */
      .toc-list {
        list-style: none;
        margin: 20px 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .toc-list li {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: var(--text-medium);
        line-height: 1.6;
      }

      .toc-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        display: inline-block;
      }

      .toc-index {
        font-weight: 600;
        color: var(--text);
        min-width: 22px;
      }

      .toc-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-medium);
      }

      .toc-note {
        font-style: italic;
        color: var(--text-light);
      }

      /* Section Headers - Clean with subtle separation */
      .markdown-content h2 {
        background: var(--bg);
        color: var(--primary);
        padding: 0 0 16px 0;
        border: none;
        border-bottom: 2px solid var(--primary);
        margin: 56px 0 32px 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 12px;
        page-break-after: avoid;
      }
      
      /* First section header has no top margin */
      .markdown-content h2:first-child {
        margin-top: 0;
      }
      
      /* Phase/Subsection Headers - Larger icons, cleaner design */
      .markdown-content h3 {
        background: var(--bg-subtle);
        padding: 20px 24px;
        border-radius: 0px;
        border: none;
        border-left: 4px solid var(--primary);
        margin: 40px 0 24px 0;
        font-size: 19px;
        font-weight: 600;
        color: var(--primary);
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        gap: 12px;
        page-break-after: avoid;
      }
      
      /* Module Cards - Clean, Clear, Spacious */
      .markdown-content h4 {
        background: var(--bg);
        border: 1px solid var(--border);
        border-left: 3px solid var(--accent);
        padding: 16px 20px;
        margin: 24px 0 0 0;
        border-radius: 0px;
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
        page-break-inside: avoid;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        line-height: 1.5;
      }
      
      /* Module content wrapper - Connected design */
      .markdown-content h4 + p,
      .markdown-content h4 + p + p,
      .markdown-content h4 + p + p + p {
        background: var(--bg);
        border: 1px solid var(--border);
        border-top: none;
        border-radius: 0;
        padding: 16px 20px;
        margin: 0 0 24px 0;
        font-size: 13px;
        line-height: 1.7;
        color: var(--text-medium);
      }
      
      /* Last content paragraph gets bottom radius */
      .markdown-content h4 + p + p + p {
        border-radius: 0 0 0px 0px;
      }
      
      /* Checkpoint Cards - Distinct but clean */
      .markdown-content h4:has-text("✅"),
      .markdown-content h4:has-text("Checkpoint") {
        background: var(--bg);
        border-left-color: var(--accent);
        border-left-width: 3px;
      }
      
      /* Lists - Clean and readable */
      .markdown-content ul {
        margin: 16px 0;
        padding-left: 0;
        list-style: none;
      }
      
      .markdown-content ul li {
        position: relative;
        padding-left: 24px;
        margin-bottom: 10px;
        color: var(--text-medium);
        font-size: 13px;
        line-height: 1.7;
      }
      
      .markdown-content ul li:before {
        content: "•";
        position: absolute;
        left: 8px;
        color: var(--accent);
        font-weight: 700;
        font-size: 16px;
      }
      
      /* Strong/Bold Text Styling */
      .markdown-content strong,
      .markdown-content b {
        font-weight: 600;
        color: var(--text);
      }
      
      /* Emoji-labeled fields - Larger, clearer */
      .markdown-content p strong:first-child {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text);
        margin-bottom: 8px;
        padding: 8px 12px;
        background: var(--bg-subtle);
        border-radius: 0px;
        min-width: 100px;
        font-weight: 600;
      }
      
      /* Goal field */
      .markdown-content p:has(strong:first-child:has-text("🎯")) {
        border-left: 3px solid var(--warning);
        padding: 16px 20px 16px 32px;
        background: var(--bg);
        margin: 16px 0 16px 12px;
        border-radius: 0px;
        position: relative;
      }
      
      .markdown-content p:has(strong:first-child:has-text("🎯"))::before {
        content: "";
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }
      
      /* Resource field */
      .markdown-content p:has(strong:first-child:has-text("📚")) {
        border-left: 3px solid var(--accent);
        padding: 16px 20px 16px 32px;
        background: var(--bg);
        margin: 16px 0 16px 12px;
        border-radius: 0px;
        position: relative;
      }
      
      .markdown-content p:has(strong:first-child:has-text("📚"))::before {
        content: "";
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }
      
      /* Check field */
      .markdown-content p:has(strong:first-child:has-text("✓")) {
        border-left: 3px solid var(--success);
        padding: 16px 20px 16px 32px;
        background: var(--bg);
        margin: 16px 0 16px 12px;
        border-radius: 0px;
        position: relative;
      }
      
      .markdown-content p:has(strong:first-child:has-text("✓"))::before {
        content: "";
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }
      
      /* Focus field */
      .markdown-content p:has(strong:first-child:has-text("🔍")) {
        border-left: 3px solid var(--primary);
        padding: 16px 20px 16px 32px;
        background: var(--bg);
        margin: 16px 0 16px 12px;
        border-radius: 0px;
        position: relative;
      }
      
      .markdown-content p:has(strong:first-child:has-text("🔍"))::before {
        content: "";
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }
      
      /* Success field */
      .markdown-content p:has(strong:first-child:has-text("🎉")) {
        border-left: 3px solid var(--success);
        padding: 16px 20px 16px 32px;
        background: var(--bg);
        margin: 16px 0 16px 12px;
        border-radius: 0px;
        position: relative;
      }
      
      .markdown-content p:has(strong:first-child:has-text("🎉"))::before {
        content: "";
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
      }
      
      /* Phase overview text */
      .markdown-content h3 + p em,
      .markdown-content h3 + em {
        display: block;
        padding: 16px 20px;
        background: var(--bg);
        border-left: 3px solid var(--border);
        border-radius: 0px;
        margin: 16px 0 24px 0;
        font-size: 13px;
        color: var(--text-medium);
        font-style: normal;
      }
      
      /* Links - Clean and accessible */
      .markdown-content a {
        color: var(--accent);
        text-decoration: none;
        font-size: 13px;
        word-break: break-word;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }
      
      .markdown-content a:hover {
        border-bottom-color: var(--accent);
      }
      
      /* Blockquotes */
      .markdown-content blockquote {
        margin: 20px 0;
        padding: 16px 20px;
        background: var(--bg-subtle);
        border-left: 3px solid var(--primary);
        border-radius: 0px;
        font-style: normal;
        color: var(--text-medium);
        font-size: 13px;
      }
      
      /* Code Blocks */
      .markdown-content code {
        background: var(--bg-subtle);
        padding: 3px 8px;
        border-radius: 0px;
        font-size: 12px;
        color: var(--primary);
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        border: 1px solid var(--border-light);
      }
      
      /* Table Styling - Clean and minimal */
      .markdown-content table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 24px 0;
        font-size: 13px;
        border: 1px solid var(--border);
        border-radius: 0px;
        overflow: hidden;
      }
      
      .markdown-content th,
      .markdown-content td {
        border-bottom: 1px solid var(--border);
        padding: 12px 16px;
        text-align: left;
      }
      
      .markdown-content th {
        background: var(--bg-subtle);
        font-weight: 600;
        color: var(--text);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .markdown-content tr:last-child td {
        border-bottom: none;
      }
      
      /* Footer - Minimal */
      footer {
        text-align: center;
        padding: 24px;
        font-size: 11px;
        color: var(--text-light);
        border-top: 1px solid var(--border);
        background: var(--bg-subtle);
      }
      
      /* Print Optimization */
      @page {
        margin: 15mm;
        size: A4;
      }
      
      @media print {
        body {
          padding: 0;
          background: white;
        }
        
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4 {
          page-break-after: avoid;
        }
        
        .markdown-content h4 {
          page-break-inside: avoid;
        }
      }
      
      /* Responsive Container */
      .markdown-content {
        max-width: 100%;
        overflow-x: hidden;
      }
    </style>
  </head>
  <body>
    <main>
      ${body}
      <footer>✨ Generated by Wurlo • ${generatedOn}</footer>
    </main>
  </body>
</html>`;
}

function renderList(items, title) {
  const values = Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim().length > 0) : [];
  if (values.length === 0) return '';
  const list = values.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `
    ${title ? `<h4>${escapeHtml(title)}</h4>` : ''}
    <ul>${list}</ul>
  `;
}

function extractLearningPlanSection(fullResponse) {
  if (!fullResponse || typeof fullResponse !== 'string') {
    console.warn('[extractLearningPlanSection] Invalid input, returning as-is');
    return fullResponse || '';
  }

  // Look for the learning plan section marker
  const sectionMarkers = [
    '## 📚 3. Learning Plan',
    '## 3. Learning Plan',
    '## 4. Learning Plan',
    '## Learning Plan',
    '### Learning Plan',
  ];

  let startIndex = -1;
  let markerUsed = '';

  for (const marker of sectionMarkers) {
    const index = fullResponse.indexOf(marker);
    if (index !== -1) {
      startIndex = index;
      markerUsed = marker;
      break;
    }
  }

  if (startIndex === -1) {
    console.warn('[extractLearningPlanSection] Learning plan section marker not found, returning full response');
    return fullResponse;
  }

  // Extract from the marker to the end
  const extracted = fullResponse.substring(startIndex);
  console.log('[extractLearningPlanSection] Found section starting with:', markerUsed);
  
  return extracted;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
