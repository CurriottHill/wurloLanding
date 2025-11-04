-- Mailing list table to store marketing consent and subscription metadata

CREATE TABLE IF NOT EXISTS mailing_list (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMPTZ,
  source VARCHAR(120),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mailing_list_opt_in ON mailing_list (marketing_opt_in) WHERE marketing_opt_in = TRUE;
CREATE INDEX IF NOT EXISTS idx_mailing_list_unsubscribed ON mailing_list (unsubscribed_at);

-- Ensure consented_at defaults when marketing_opt_in is true
CREATE OR REPLACE FUNCTION set_mailing_list_consent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marketing_opt_in THEN
    NEW.consented_at := COALESCE(NEW.consented_at, NOW());
    NEW.unsubscribed_at := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mailing_list_set_consent
BEFORE INSERT OR UPDATE ON mailing_list
FOR EACH ROW EXECUTE FUNCTION set_mailing_list_consent();
