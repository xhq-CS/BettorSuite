import { pool } from "@workspace/db";

export async function ensureModerationSchema() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS war_room_muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS war_room_muted_at timestamp,
      ADD COLUMN IF NOT EXISTS war_room_muted_by integer;

    ALTER TABLE group_members
      ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS muted_at timestamp,
      ADD COLUMN IF NOT EXISTS muted_by integer,
      ADD COLUMN IF NOT EXISTS notifications_muted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_read_at timestamp;
  `);
}
