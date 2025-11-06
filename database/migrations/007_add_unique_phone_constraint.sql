-- Add unique constraint to phone_number in waitlist table
-- This prevents duplicate phone numbers from being registered

-- Add unique constraint on phone_number
ALTER TABLE waitlist 
ADD CONSTRAINT waitlist_phone_number_unique UNIQUE (phone_number);
