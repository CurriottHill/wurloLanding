-- Add user information fields to waitlist table
-- This migration adds first_name, last_name, phone_number, and contact_consent columns

ALTER TABLE waitlist 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_consent BOOLEAN DEFAULT FALSE;

-- Add index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON waitlist (phone_number) WHERE phone_number IS NOT NULL;

-- Add index on contact_consent for filtering users who agreed to be contacted
CREATE INDEX IF NOT EXISTS idx_waitlist_contact_consent ON waitlist (contact_consent) WHERE contact_consent = TRUE;
