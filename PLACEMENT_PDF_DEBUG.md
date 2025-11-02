# Placement Test PDF Generation - Debug Investigation

## Issue Description
PDF is being generated prematurely around the 4th question instead of after completing all questions in the placement test.

## Root Cause Analysis

### Potential Causes Identified

#### 1. **Duplicate Answer Entries (Most Likely)**
**Symptom**: Multiple entries in `placement_attempt_questions` for the same question
**Root Cause**: Race condition or frontend retry logic causing duplicate submissions
**Impact**: `COUNT(*)` returns inflated numbers, triggering premature completion

**Example**:
- Test has 30 questions total
- User answers question 1, 2, 3, 4
- If question 4 is submitted twice (race condition), COUNT returns 5
- But only 4 unique questions answered
- System thinks test is further along than it is

**Fix Applied**:
1. Added `UNIQUE (attempt_id, question_id)` constraint via migration
2. Modified INSERT statements to use `ON CONFLICT ... DO UPDATE`
3. Added duplicate detection logging

#### 2. **Incorrect Question Count from AI**
**Symptom**: AI generates fewer questions than expected
**Root Cause**: Questions filtered out during validation in `transformQuestion()`
**Impact**: `total_questions` might be less than expected

**Fix Applied**:
- Added logging to track raw vs validated question counts
- Logs filtered out questions

#### 3. **Frontend Submitting Wrong Question IDs**
**Symptom**: Answering questions that don't exist or duplicate IDs
**Root Cause**: Frontend state management or mapping issues
**Impact**: Phantom answers counted toward completion

**Mitigation**:
- Added comprehensive logging of question IDs
- Logs all question IDs vs answered question IDs

## Changes Made

### 1. Database Migration (004)
**File**: `database/migrations/004_add_unique_constraint_placement_attempt_questions.sql`
```sql
-- Removes duplicate entries
-- Adds UNIQUE constraint on (attempt_id, question_id)
```

### 2. Server Route Updates
**File**: `routes/onboardingRoutes.js`

**Added Logging**:
- Question generation counts (raw vs validated)
- Answer submission tracking
- Duplicate entry detection
- Detailed question ID mapping
- Completion status tracking

**Added Safety**:
- `ON CONFLICT` clauses in INSERT statements
- Duplicate answer detection query
- Question ID validation logging

### 3. Service Updates
**File**: `services/placementTestService.js`

**Added Logging**:
- AI-generated question count
- Validated question count after filtering
- Persisted question count verification

## How to Debug

### Step 1: Run Migration
```bash
node scripts/runMigrations.js
```

### Step 2: Monitor Server Logs
Watch for these log patterns:
```
[DEBUG] Placement test generation: { raw_questions_from_ai, validated_questions, filtered_out }
[DEBUG] Placement test persistence: { test_id, persisted_count, expected_count }
[DEBUG] Existing answer check: { attempt_id, question_id, found_existing }
[DEBUG] Answer submission - Question counts: { total_questions, answered_questions, ... }
[ERROR] Duplicate answer entries detected: [...]
```

### Step 3: Verify Counts Match
Look for these mismatches:
- `total_questions` in test vs actual COUNT from database
- `answered_questions` vs unique question_ids
- Duplicate entries in the duplicate check query

### Step 4: Check Question ID Arrays
Compare:
- `all_question_ids`: All questions in the test
- `answered_question_ids`: Questions the user has answered
- Should see progression: [1], [1,2], [1,2,3], etc.

## Expected Behavior

### Normal Flow (30 question test):
```
Question 1: answered=1, total=30, completed=false
Question 2: answered=2, total=30, completed=false
Question 3: answered=3, total=30, completed=false
Question 4: answered=4, total=30, completed=false
...
Question 30: answered=30, total=30, completed=true → PDF GENERATED
```

### Bug Flow (Duplicate entries):
```
Question 1: answered=1, total=30, completed=false
Question 2: answered=2, total=30, completed=false
Question 3: answered=3, total=30, completed=false
Question 4: answered=5, total=30, completed=false  ← DUPLICATE ENTRY!
                    ^^^ More than expected
```

### Bug Flow (Wrong total count):
```
Question 1: answered=1, total=5, completed=false  ← WRONG TOTAL!
Question 2: answered=2, total=5, completed=false
Question 3: answered=3, total=5, completed=false
Question 4: answered=4, total=5, completed=false
Question 5: answered=5, total=5, completed=true → PDF GENERATED (TOO EARLY!)
```

## Testing Steps

1. **Start Fresh Test**:
   - Clear any existing attempts in database
   - Start new onboarding flow
   - Generate placement test

2. **Monitor Each Answer**:
   - Check logs after each answer submission
   - Verify counts increment correctly
   - Watch for duplicate warnings

3. **Verify Question Count**:
   - Check how many questions AI generated
   - Verify they all persisted to database
   - Confirm frontend received all questions

4. **Check for Race Conditions**:
   - Try clicking submit button multiple times quickly
   - Check if duplicate entries are created
   - Verify ON CONFLICT prevents duplicates

## Frontend Investigation Needed

Since test_client appears to be a compiled app, you may need to:

1. Check browser console for API calls
2. Look for retry logic or duplicate submissions
3. Verify question state management
4. Check if questions are being resubmitted on navigation

## Database Queries for Manual Investigation

### Check for duplicates:
```sql
SELECT attempt_id, question_id, COUNT(*) 
FROM placement_attempt_questions 
GROUP BY attempt_id, question_id 
HAVING COUNT(*) > 1;
```

### Check test totals:
```sql
SELECT pt.id, pt.total_questions, 
       (SELECT COUNT(*) FROM placement_questions WHERE test_id = pt.id) as actual_count
FROM placement_tests pt;
```

### Check answer counts:
```sql
SELECT pa.id, pa.test_id, pa.completed,
       (SELECT COUNT(*) FROM placement_questions WHERE test_id = pa.test_id) as total,
       (SELECT COUNT(*) FROM placement_attempt_questions WHERE attempt_id = pa.id) as answered
FROM placement_attempts pa;
```

## Next Steps

1. Deploy changes with migration
2. Monitor logs during next test
3. Identify which root cause is triggering the bug
4. Apply targeted fix based on findings
