-- Alter existing users table to add required columns
DO $$ 
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_id') THEN
    ALTER TABLE users ADD COLUMN user_id VARCHAR(125);
  END IF;
  
  -- Add name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(255);
  END IF;
  
  -- Add auth_provider column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_provider') THEN
    ALTER TABLE users ADD COLUMN auth_provider VARCHAR(100);
  END IF;
  
  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
    ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255);
  END IF;
END $$;

-- Create unique index on user_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Create trigger to auto-update updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Stores user account information from Firebase Auth';
