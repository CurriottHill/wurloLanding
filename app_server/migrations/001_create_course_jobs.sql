-- ✅ Fixed: Course generation job tracking table (PostgreSQL)

CREATE TABLE IF NOT EXISTS course_jobs (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Job status: 'pending', 'processing', 'completed', 'failed'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  -- Current step being processed
  current_step VARCHAR(100) DEFAULT NULL,

  -- JSON array of completed steps
  completed_steps JSONB NULL,

  -- JSON array of failed steps with error messages
  failed_steps JSONB NULL,

  -- Total number of steps in this job
  total_steps INT NOT NULL DEFAULT 0,

  -- Error message if job failed
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,

  -- Foreign key to courses table
  CONSTRAINT fk_course_jobs_course
    FOREIGN KEY (course_id)
    REFERENCES wurlo_courses(id)
    ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_course_jobs_course_id ON course_jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_course_jobs_user_id ON course_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_course_jobs_status ON course_jobs(status);
CREATE INDEX IF NOT EXISTS idx_course_jobs_created_at ON course_jobs(created_at);
