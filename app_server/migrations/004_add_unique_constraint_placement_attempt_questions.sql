-- Add unique constraint to prevent duplicate answer submissions
-- This ensures one answer per question per attempt

-- First, remove any potential duplicates that might exist
DELETE FROM placement_attempt_questions a
USING placement_attempt_questions b
WHERE a.id > b.id 
  AND a.attempt_id = b.attempt_id 
  AND a.question_id = b.question_id;

-- Add the unique constraint
ALTER TABLE placement_attempt_questions
  ADD CONSTRAINT unique_attempt_question 
  UNIQUE (attempt_id, question_id);
