-- Expand experience_level capacity for richer learner descriptions (PostgreSQL)

ALTER TABLE placement_tests
  ALTER COLUMN experience_level TYPE TEXT;
