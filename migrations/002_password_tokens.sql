-- Create password_tokens table for password reset functionality
CREATE TABLE IF NOT EXISTS password_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_password_tokens_token ON password_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_tokens_email ON password_tokens(email);

-- Add comment
COMMENT ON TABLE password_tokens IS 'Stores password reset tokens for user authentication';
