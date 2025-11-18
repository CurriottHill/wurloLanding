# Multi-Stage PDF Generation Plan

## ✅ Status: FULLY OPERATIONAL

All 4 stages are implemented and working. The system generates comprehensive, personalized math learning plans with web-searched resources and exports them as formatted PDFs.

## Executive Summary

When a user completes a placement test:
1. **Stage 1** generates the framework (Sections 1-3, 5-11) WITHOUT Section 4
2. **Stage 2** creates ~50 ultra-granular daily modules in perfect dependency order (Section 4 skeleton)
3. **Stage 3** fills each module with ultra-concise content: goal, practice, resources, checkpoint
4. **Stage 4** converts the markdown to a clean, compact PDF (removes special characters like theta symbols)

**Key Design:** 
- **~50 daily modules** instead of weekly lessons (e.g., "Pythagorean Theorem" becomes 6 separate modules)
- **Ultra-concise** content (no essays, just essential information)
- **Perfect dependency order** (can't do Module N without completing Module N-1)
- **Clean PDF** with no problematic symbols, optimized spacing, smaller fonts

The API returns `{ success: true, pdf: {...}, placement_summary: {...} }` which the frontend uses to navigate to the summary page and provide the PDF download.

## Overview
The PDF generation uses a multi-stage approach with Grok prompts and web search.

## Stage 1: Framework Generation ✅ IMPLEMENTED

**Status:** Complete and operational

**Function:** `buildFrameworkPrompt()`

**What it does:**
- Generates the complete learning plan framework WITHOUT the detailed learning plan section
- Includes all 11 sections: Learning Strategy, Diagnostic Summary, Concept Hierarchy, Review Plan, AI Insights, Progress Forecast, Reflection, Tools & Resources, Analytics, and Completion
- Uses web search to reference real educational frameworks (Common Core, NCTM, GCSE, IB, Cambridge)
- Outputs formatted markdown suitable for PDF generation

**Web Search:** Enabled (max 5 results)

**Output:** Raw markdown text stored in `stage1Context.frameworkResponse`

**User Data Included:**
- Name: Learner
- Current Level: `${experience}`
- Goal: `${goal}`
- Duration: Auto-calculated based on placement test score
- Study Time: 5-7 hours/week
- Placement Test Results: Summary with score percentage

---

## Stage 2: Create ~50 Daily Module Structure ✅ IMPLEMENTED

**Status:** Complete and operational

**Function:** `buildStageStructurePrompt()`

**What it does:**
- Creates ~50 ultra-granular daily learning modules (NOT weekly)
- Each module = ONE atomic micro-skill (15-30 min focus time)
- Perfect dependency order (Module N requires Module N-1)
- Uses web search to verify micro-progressions exist in curricula

**Granularity Philosophy:**
- **NOT** "Pythagorean Theorem" → **YES** 6 separate modules:
  * Module 12: Identifying right triangles
  * Module 13: Understanding a² + b² = c²
  * Module 14: Finding hypotenuse when legs known
  * Module 15: Finding leg when hypotenuse known
  * Module 16: Recognizing Pythagorean triples
  * Module 17: Coordinate plane distance applications

**Key Features:**
1. **~50 Modules** - Adjusted based on gap between current level and goal
2. **Ultra-Specific Titles** - "Adding fractions with like denominators" not "fractions"
3. **Perfect Order** - Strict dependency chain (no gaps, no jumps)
4. **Web-Verified** - Curriculum progressions checked via Khan Academy/Common Core
5. **Placeholders Only** - Uses `{{details_to_be_filled}}` for content

**Web Search:** Enabled (max 5 results)

**Output:** Module structure stored in `multiStageContext.stage2Structure`

**Example Output:**
```markdown
## 4. Learning Plan

### Module 1: Identifying whole numbers vs integers
{{details_to_be_filled}}

### Module 2: Adding positive and negative integers
{{details_to_be_filled}}

### Module 3: Subtracting positive and negative integers
{{details_to_be_filled}}

[... continues to ~Module 50 ...]
```

**Integration:** 
- Input: `stage1Framework` + test results (detailed Q&A)
- Output: ~50 module titles in perfect order
- Next: Stage 3 fills `{{details_to_be_filled}}` with concise content

---

## Stage 3: Fill Module Content (Ultra-Concise) ✅ IMPLEMENTED

**Status:** Complete and operational

**Function:** `buildWeekByWeekContentPrompt()` (renamed but still accurate)

**What it does:**
- Fills ALL `{{details_to_be_filled}}` placeholders with ULTRA-BRIEF content
- NO essays, NO fluff - just essential information (10-15 words per section)
- Provides real current URLs for practice platforms
- Uses web search to verify resources are active and high-quality

**What Gets Filled In (Ultra-Brief Format):**

For each module:
1. **Goal** - One short sentence (10-15 words max)
2. **Practice** - 2-3 specific activities with direct URLs
3. **Resource** - ONE best resource link (not 3)
4. **Check** - Simple success criterion (e.g., "Solve 5 problems correctly")

**Resource Platforms:**
- Khan Academy (free, comprehensive)
- Brilliant.org (interactive problem solving)
- Desmos (graphing calculator and activities)
- IXL Math (adaptive practice)
- Paul's Online Math Notes
- 3Blue1Brown (visual explanations)
- Mathway, Wolfram Alpha (verification tools)

**Web Search:** Enabled (max 5 results)

**Output:** Complete Section 4 with all details stored in `multiStageContext.stage3DetailedPlan`

**Example Filled Module (Ultra-Concise):**
```markdown
### Module 14: Finding hypotenuse when legs are known

**Goal:** Use a^2 + b^2 = c^2 to find the long side of right triangles.

**Practice:**
- Khan Academy: "Find the hypotenuse" - https://khanacademy.org/math/geometry/pythagorean-theorem
- IXL: "Pythagorean theorem: find the hypotenuse" - https://ixl.com/math/grade-8/pythagorean-theorem

**Resource:** Khan Academy Pythagorean Theorem - https://khanacademy.org/math/geometry/pythagorean-theorem

**Check:** Solve 5 problems correctly

---
```

**Integration:** 
- Input: `stage1Framework` + `stage2Structure`
- Output: Complete detailed learning plan
- Combined: `multiStageContext.combinedDocument` = Stage 1 + Stage 3

---

## Stage 4: PDF Generation ✅ IMPLEMENTED

**Status:** Complete and operational

**Function:** `generateMarkdownPdf()`

**What it does:**
- Converts combined markdown to clean, compact PDF
- **Removes problematic characters** (Greek letters like θ, math symbols, special Unicode)
- Optimized spacing and font sizes for better readability
- Automatic page breaks (leaves more room at bottom)
- Renders horizontal rules as actual lines
- Falls back to legacy PDF if markdown unavailable

**Character Cleaning:**
- Strips: `θαβγδεζηικλμνξπρστυφχψω` (Greek letters)
- Strips: `∑∏∫∂∇√∞≈≠≤≥±×÷` (math symbols)
- Strips: Zero-width spaces, combining marks
- Result: Clean ASCII-friendly text

**Markdown Support:**
- `## Heading 1` - 16pt bold purple
- `### Heading 2` - 13pt bold purple (reduced size)
- `#### Heading 3` - 11pt bold dark (reduced size)
- `**Bold text**` - 10pt bold
- `- Bullet` - 9pt with indent
- `- [ ] Checkbox` - 9pt with checkbox symbol
- `---` - Gray horizontal line
- Regular text - 9pt (more compact)

**Font:** Noto Sans (variable width/weight), located in `server/fonts/`. Registered in both markdown and legacy PDF flows to avoid missing glyph issues.

**Flow:**
1. Check if `multiStageContext.combinedDocument` exists
2. If yes → `generateMarkdownPdf()` with full markdown content
3. If no → `generateLearningPlanPdf()` with legacy structured JSON
4. Return PDF as base64 in response

**Output:**
- PDF filename: `wurlo-learning-plan-{goal}-{date}.pdf`
- Content type: `application/pdf`
- Format: Base64 encoded buffer
- Included in API response under `pdf` key

---

## Current Implementation Status

### ✅ What's Working:
1. **Stage 1 Complete** - `buildFrameworkPrompt()` generates full framework (all sections except Learning Plan)
2. **Stage 1 Execution** - Grok called with web search enabled, framework stored
3. **Stage 2 Complete** - `buildStageStructurePrompt()` creates empty phase/week structure with ordered concepts
4. **Stage 2 Execution** - Grok called with Stage 1 framework as context, web search verifies concept ordering
5. **Stage 3 Complete** - `buildWeekByWeekContentPrompt()` fills in detailed content for each week
6. **Stage 3 Execution** - Grok called with Stage 1 + Stage 2 as context, web search finds quality resources
7. **Stage 4 Complete** - `generateMarkdownPdf()` converts markdown to formatted PDF
8. **Stage 4 Execution** - Parses markdown, applies styling, generates PDF with auto page breaks
9. **Context Management** - All responses stored in `multiStageContext` object:
   - `stage1Framework` - Framework output (Sections 1-3, 5-11)
   - `stage2Structure` - Empty structure (Section 4 with placeholders)
   - `stage3DetailedPlan` - Complete Section 4 with all details
   - `combinedDocument` - Full markdown document (Stage 1 + Stage 3)
   - `userInputs` - Learner data
10. **Console Logs** - Progress tracking through all 4 stages
11. **PDF Delivery** - Base64 encoded PDF included in API response for download
12. **Backward Compatibility** - Falls back to legacy PDF if markdown unavailable
13. **Summary Page Navigation** - Response includes `success: true` flag for frontend routing

### ✅ Complete Flow:
```
User completes placement test
        ↓
Backend triggers summarizePlacementResults()
        ↓
Stage 1: Generate framework (Grok + Web Search)
        ↓
Stage 2: Create phase/week structure (Grok + Web Search)
        ↓
Stage 3: Fill detailed content (Grok + Web Search)
        ↓
Stage 4: Generate PDF from markdown
        ↓
API returns: { success: true, pdf: {...}, placement_summary: {...} }
        ↓
Frontend navigates to summary page with PDF download link
```

### 🔜 Enhancement Ideas:
1. **User Personalization**
   - Pull user name from profile (currently defaults to "Learner")
   - Add user avatar to PDF header
   - Include user preferences for study time

2. **Advanced Features**
   - Interactive PDF with clickable resource links
   - Progress tracking checkboxes in PDF
   - Printable weekly study schedules
   - Practice problem sets generated per week

3. **Quality Improvements**
   - Enhanced markdown parsing (code blocks, nested lists)
   - Better table formatting in PDF
   - Include charts/graphs for progress visualization
   - Multi-language support

---

## Data Flow

```
Placement Test Results
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Framework Generation (Grok + Web Search)          │
│ Returns: Sections 1-3, 5-11 (all except Section 4)         │
└─────────────────────────────────────────────────────────────┘
        ↓ [Stored as stage1Framework]
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Structure Planning (Grok + Web Search)            │
│ Context: Stage 1 output                                     │
│ Returns: ONLY Section 4 skeleton (phases, weeks, titles)   │
│ Purpose: Planning concept order & dependencies             │
└─────────────────────────────────────────────────────────────┘
        ↓ [Stored as stage2Structure - for context only]
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Detail Generation (Grok + Web Search)             │
│ Context: Stage 1 + Stage 2 outputs                         │
│ Returns: COMPLETE Section 4 with all weekly content        │
│ Replaces: Stage 2 structure (fills all placeholders)       │
└─────────────────────────────────────────────────────────────┘
        ↓ [Stored as stage3DetailedPlan]
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Combine: Stage 1 + Stage 3 = Complete Document             │
└─────────────────────────────────────────────────────────────┘
        ↓ [combinedDocument]
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: PDF Generation                                     │
│ Input: combinedDocument (markdown)                          │
│ Returns: Formatted PDF (base64)                             │
└─────────────────────────────────────────────────────────────┘
        ↓
    [Final PDF delivered to frontend]
```

---

## Configuration

**Grok Model:** `grok-4-fast-reasoning`

**Stage 1 Settings:**
- Temperature: 0.3
- Max Output Tokens: 4000
- Web Search: Enabled (5 results max)
- Purpose: Generate comprehensive framework

**Stage 2 Settings:**
- Temperature: 0.3
- Max Output Tokens: 3000
- Web Search: Enabled (5 results max)
- Purpose: Create phase/week structure with ordered concepts

**Stage 3 Settings:**
- Temperature: 0.3
- Max Output Tokens: 6000
- Web Search: Enabled (5 results max)
- Purpose: Fill detailed content for each week

---

## Notes

- The current implementation runs all 3 stages sequentially, then still uses the old JSON-based flow for backward compatibility
- All stage outputs are returned in the API response via `multiStageContext` for inspection
- Console logs provide visibility into each stage of the process:
  - `[Stage 1] Generating framework...` → `[Stage 1] Framework generated successfully`
  - `[Stage 2] Generating empty stage structure...` → `[Stage 2] Stage structure generated successfully`
  - `[Stage 3] Filling in detailed content...` → `[Stage 3] Detailed content generated successfully`
- The framework prompt includes dynamic duration calculation based on placement test score (16-20 weeks if <30%, 12-16 weeks if <60%, 8-12 weeks if >60%)
- Stage 2 uses web search to verify concept ordering follows standard math curriculum progressions
- Stage 3 uses web search to find current, high-quality learning resources (Khan Academy, Brilliant, Desmos, etc.)
