import { pool } from "@workspace/db";

export async function ensureModerationSchema() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS war_room_muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS war_room_muted_at timestamp,
      ADD COLUMN IF NOT EXISTS war_room_muted_by integer,
      ADD COLUMN IF NOT EXISTS presence_status text NOT NULL DEFAULT 'offline',
      ADD COLUMN IF NOT EXISTS presence_updated_at timestamp;

    ALTER TABLE group_members
      ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS muted_at timestamp,
      ADD COLUMN IF NOT EXISTS muted_by integer,
      ADD COLUMN IF NOT EXISTS notifications_muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_read_at timestamp;

    ALTER TABLE conversation_participants
      ADD COLUMN IF NOT EXISTS notifications_muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_read_at timestamp;

    CREATE TABLE IF NOT EXISTS user_nicknames (
      id serial PRIMARY KEY,
      owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS user_nicknames_owner_target_idx
      ON user_nicknames(owner_id, target_user_id);

    CREATE INDEX IF NOT EXISTS users_presence_updated_at_idx
      ON users(presence_updated_at);
  `);
}
