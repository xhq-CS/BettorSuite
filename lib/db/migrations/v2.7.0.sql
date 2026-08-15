ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamp;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id serial PRIMARY KEY,
  blocker_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_pair_idx ON user_blocks(blocker_id, blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id integer REFERENCES users(id) ON DELETE SET NULL,
  reporter_email text,
  target_type text NOT NULL,
  target_id text,
  reported_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  category text NOT NULL,
  details text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  reviewed_by integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports(status, created_at DESC);
