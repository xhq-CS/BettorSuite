begin;

alter table users
  add column if not exists presence_status text not null default 'offline',
  add column if not exists presence_updated_at timestamp;

create index if not exists users_presence_updated_at_idx
  on users(presence_updated_at);

alter table conversation_participants
  add column if not exists last_read_at timestamp;

create table if not exists user_nicknames (
  id serial primary key,
  owner_id integer not null references users(id) on delete cascade,
  target_user_id integer not null references users(id) on delete cascade,
  nickname text not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create unique index if not exists user_nicknames_owner_target_idx
  on user_nicknames(owner_id, target_user_id);

commit;
