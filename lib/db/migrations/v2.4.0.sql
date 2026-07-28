begin;

alter table users add column if not exists tracker_break_even_enabled boolean not null default false;
alter table users add column if not exists tracker_break_even_balance numeric;
alter table users add column if not exists tracker_break_even_adjustment numeric not null default 0;
alter table users add column if not exists tracker_break_even_set_at timestamp;

alter table bets add column if not exists payout_override numeric;
alter table bets add column if not exists bet_date timestamp;
update bets set bet_date = created_at where bet_date is null;
alter table bets alter column bet_date set default now();
alter table bets alter column bet_date set not null;

alter table simulator_bets add column if not exists payout_override numeric;
alter table simulator_bets add column if not exists bet_date timestamp;
update simulator_bets set bet_date = created_at where bet_date is null;
alter table simulator_bets alter column bet_date set default now();
alter table simulator_bets alter column bet_date set not null;

alter table daily_cards add column if not exists source_bet_ids jsonb not null default '[]'::jsonb;

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

create table if not exists admin_audit_logs (
  id serial primary key,
  actor_id integer references users(id) on delete set null,
  target_user_id integer,
  action text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);

commit;
