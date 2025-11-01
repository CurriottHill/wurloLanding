-- Fix user_onboarding.question_type column to support all question types (PostgreSQL)
-- Ensures column can store: 'topic', 'goal', 'prior_knowledge', 'preference', etc.

ALTER TABLE user_onboarding 
ALTER COLUMN question_type TYPE VARCHAR(50);
