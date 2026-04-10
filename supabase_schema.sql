-- ═══════════════════════════════════════════════════════════════
--  EQUITY TRACE — Supabase Schema
--  Run this entire file in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";


-- ═══════════════════════════════════════════════════════════════
--  TABLE: profiles
--  One row per authenticated user. Created automatically on signup.
-- ═══════════════════════════════════════════════════════════════
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  theme       text default 'dark',
  created_at  timestamptz default now()
);

create table if not exists public_profiles (
  user_id      uuid primary key references profiles(id) on delete cascade,
  username     text,
  bio          text,
  is_public    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint public_profiles_username_format_chk
    check (username is null or username ~ '^[a-z0-9_]{3,24}$')
);

create unique index if not exists public_profiles_username_idx
  on public_profiles (lower(username))
  where username is not null and username <> '';

-- Trigger: auto-create profile when a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.public_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ═══════════════════════════════════════════════════════════════
--  TABLE: accounts
--  Prop firm / trading accounts
-- ═══════════════════════════════════════════════════════════════
create table if not exists accounts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,

  -- Legacy numeric id (for ordering / migration)
  legacy_id       integer,

  firm            text not null,
  phase           text,
  key             text,           -- the "filter name" used throughout the app
  balance         text,           -- display string e.g. "$25,220.01"
  type            text default 'DEMO',   -- 'DEMO' | 'LIVE'
  active          boolean default true,
  start_bal       numeric(14,2) default 0,
  max_drawdown    numeric(6,2) default 8,
  daily_loss      numeric(6,2) default 4,
  profit_target   numeric(6,2),
  dd_type         text default 'trailing',  -- 'trailing' | 'static'
  challenge_type  text,           -- 'Funded' | null
  current_phase   text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists accounts_user_id_idx on accounts(user_id);


-- ═══════════════════════════════════════════════════════════════
--  TABLE: trades
-- ═══════════════════════════════════════════════════════════════
create table if not exists trades (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,

  -- Legacy numeric id (used for image linking, ordering, migration)
  legacy_id       integer,

  -- Core trade fields
  date            date not null,
  time            text,           -- stored as "HH:MM" 24-hour
  symbol          text not null,
  type            text,           -- 'Forex' | 'Futures' | 'Crypto' etc.
  dir             text,           -- 'long' | 'short'
  entry           numeric(18,6),
  exit            numeric(18,6),
  size            numeric(14,4),
  sl              numeric(18,6),
  tp              numeric(18,6),
  comm            numeric(10,2) default 0,
  setup           text,
  model           text,
  session         text,
  account         text,           -- matches accounts.key
  rating          integer,        -- 1-5
  notes           text,
  emotions        text[],         -- array of strings e.g. ['Disciplined','Planned']
  pnl             numeric(14,2),

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists trades_user_id_idx   on trades(user_id);
create index if not exists trades_date_idx      on trades(date);
create index if not exists trades_account_idx   on trades(account);


-- ═══════════════════════════════════════════════════════════════
--  TABLE: trade_images
--  Base64 screenshots attached to trades
-- ═══════════════════════════════════════════════════════════════
create table if not exists trade_images (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  trade_id        uuid not null references trades(id) on delete cascade,

  label           text,
  data            text not null,  -- base64 data URL
  sort_order      integer default 0,

  created_at      timestamptz default now()
);

create index if not exists trade_images_trade_id_idx on trade_images(trade_id);
create index if not exists trade_images_user_id_idx  on trade_images(user_id);


-- ═══════════════════════════════════════════════════════════════
--  TABLE: playbooks
--  Entry model / playbook definitions
-- ═══════════════════════════════════════════════════════════════
create table if not exists playbooks (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,

  name            text not null,
  emoji           text default '📈',
  avg_r           text,           -- display string e.g. '+2.1R'
  description     text,
  sort_order      integer default 0,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists playbooks_user_id_idx on playbooks(user_id);


-- ═══════════════════════════════════════════════════════════════
--  TABLE: user_settings
--  Misc persistent settings (theme, filter state, labels, etc.)
-- ═══════════════════════════════════════════════════════════════
create table if not exists user_settings (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,

  key             text not null,   -- e.g. 'et-theme', 'et-filter-state', 'hiddenAccountIds'
  value           jsonb,           -- flexible JSON storage

  updated_at      timestamptz default now(),

  unique(user_id, key)
);

create index if not exists user_settings_user_id_idx on user_settings(user_id);


-- ═══════════════════════════════════════════════════════════════
--  PUBLIC TRADER STATS RPC
-- ═══════════════════════════════════════════════════════════════

create or replace function get_public_trader_stats(profile_username text)
returns jsonb
language sql
security definer
set search_path = public
as $$
with target as (
  select
    pp.user_id,
    pp.username,
    coalesce(nullif(p.display_name, ''), pp.username) as display_name,
    coalesce(pp.bio, '') as bio
  from public_profiles pp
  join profiles p on p.id = pp.user_id
  where pp.is_public = true
    and lower(pp.username) = lower(profile_username)
  limit 1
),
ordered_trades as (
  select
    t.user_id,
    t.date,
    t.symbol,
    t.dir,
    t.model,
    t.pnl,
    t.session,
    t.account,
    sum(coalesce(t.pnl, 0)) over (
      partition by t.user_id
      order by t.date asc, t.created_at asc, t.id asc
    ) as running_pnl
  from trades t
  join target tg on tg.user_id = t.user_id
),
summary as (
  select
    tg.user_id,
    count(ot.*)::int as total_trades,
    coalesce(round(avg(case when ot.pnl > 0 then 100.0 else 0 end)::numeric, 1), 0) as win_rate,
    coalesce(sum(ot.pnl), 0)::numeric(14,2) as net_pnl,
    coalesce((
      select jsonb_build_object(
        'name', model_stats.model,
        'trades', model_stats.trades,
        'win_rate', model_stats.win_rate,
        'net_pnl', model_stats.net_pnl
      )
      from (
        select
          coalesce(nullif(ot2.model, ''), 'Unlabeled') as model,
          count(*)::int as trades,
          round(avg(case when ot2.pnl > 0 then 100.0 else 0 end)::numeric, 1) as win_rate,
          coalesce(sum(ot2.pnl), 0)::numeric(14,2) as net_pnl
        from ordered_trades ot2
        where ot2.user_id = tg.user_id
        group by coalesce(nullif(ot2.model, ''), 'Unlabeled')
        order by net_pnl desc, trades desc, model asc
        limit 1
      ) model_stats
    ), jsonb_build_object(
      'name', 'No models yet',
      'trades', 0,
      'win_rate', 0,
      'net_pnl', 0
    )) as best_model
  from target tg
  left join ordered_trades ot on ot.user_id = tg.user_id
  group by tg.user_id
)
select case
  when not exists (select 1 from target) then null
  else jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'user_id', tg.user_id,
        'username', tg.username,
        'display_name', tg.display_name,
        'bio', tg.bio
      )
      from target tg
    ),
    'summary', (
      select jsonb_build_object(
        'total_trades', coalesce(s.total_trades, 0),
        'win_rate', coalesce(s.win_rate, 0),
        'net_pnl', coalesce(s.net_pnl, 0),
        'best_model', s.best_model
      )
      from summary s
    ),
    'equity_curve', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(ot.date, 'YYYY-MM-DD'),
          'value', round(ot.running_pnl, 2)
        )
        order by ot.date asc, ot.running_pnl asc
      )
      from ordered_trades ot
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', ranked.model,
          'trades', ranked.trades,
          'win_rate', ranked.win_rate,
          'net_pnl', ranked.net_pnl
        )
        order by ranked.net_pnl desc, ranked.trades desc, ranked.model asc
      )
      from (
        select
          coalesce(nullif(ot.model, ''), 'Unlabeled') as model,
          count(*)::int as trades,
          round(avg(case when ot.pnl > 0 then 100.0 else 0 end)::numeric, 1) as win_rate,
          coalesce(sum(ot.pnl), 0)::numeric(14,2) as net_pnl
        from ordered_trades ot
        group by coalesce(nullif(ot.model, ''), 'Unlabeled')
        order by net_pnl desc, trades desc, model asc
        limit 6
      ) ranked
    ), '[]'::jsonb),
    'recent_trades', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(recent.date, 'YYYY-MM-DD'),
          'symbol', recent.symbol,
          'dir', recent.dir,
          'model', recent.model,
          'session', recent.session,
          'account', recent.account,
          'pnl', recent.pnl
        )
        order by recent.date desc
      )
      from (
        select
          ot.date,
          ot.symbol,
          ot.dir,
          coalesce(nullif(ot.model, ''), 'Unlabeled') as model,
          ot.session,
          ot.account,
          round(coalesce(ot.pnl, 0), 2) as pnl
        from ordered_trades ot
        order by ot.date desc
        limit 8
      ) recent
    ), '[]'::jsonb)
  )
end;
$$;


-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY — Users can only see their own data
-- ═══════════════════════════════════════════════════════════════

alter table profiles      enable row level security;
alter table public_profiles enable row level security;
alter table accounts      enable row level security;
alter table trades        enable row level security;
alter table trade_images  enable row level security;
alter table playbooks     enable row level security;
alter table user_settings enable row level security;

-- profiles
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- public_profiles
create policy "Users can read own public profile"
  on public_profiles for select using (auth.uid() = user_id);
create policy "Public can read published trader pages"
  on public_profiles for select using (is_public = true);
create policy "Users can insert own public profile"
  on public_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own public profile"
  on public_profiles for update using (auth.uid() = user_id);
create policy "Users can delete own public profile"
  on public_profiles for delete using (auth.uid() = user_id);

-- accounts
create policy "Users can read own accounts"
  on accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts"
  on accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts"
  on accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts"
  on accounts for delete using (auth.uid() = user_id);

-- trades
create policy "Users can read own trades"
  on trades for select using (auth.uid() = user_id);
create policy "Users can insert own trades"
  on trades for insert with check (auth.uid() = user_id);
create policy "Users can update own trades"
  on trades for update using (auth.uid() = user_id);
create policy "Users can delete own trades"
  on trades for delete using (auth.uid() = user_id);

-- trade_images
create policy "Users can read own images"
  on trade_images for select using (auth.uid() = user_id);
create policy "Users can insert own images"
  on trade_images for insert with check (auth.uid() = user_id);
create policy "Users can update own images"
  on trade_images for update using (auth.uid() = user_id);
create policy "Users can delete own images"
  on trade_images for delete using (auth.uid() = user_id);

-- playbooks
create policy "Users can read own playbooks"
  on playbooks for select using (auth.uid() = user_id);
create policy "Users can insert own playbooks"
  on playbooks for insert with check (auth.uid() = user_id);
create policy "Users can update own playbooks"
  on playbooks for update using (auth.uid() = user_id);
create policy "Users can delete own playbooks"
  on playbooks for delete using (auth.uid() = user_id);

-- user_settings
create policy "Users can read own settings"
  on user_settings for select using (auth.uid() = user_id);
create policy "Users can upsert own settings"
  on user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);
create policy "Users can delete own settings"
  on user_settings for delete using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
--  HELPER: auto-update updated_at timestamps
-- ═══════════════════════════════════════════════════════════════
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trades_updated_at
  before update on trades
  for each row execute procedure touch_updated_at();

create trigger accounts_updated_at
  before update on accounts
  for each row execute procedure touch_updated_at();

create trigger playbooks_updated_at
  before update on playbooks
  for each row execute procedure touch_updated_at();

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute procedure touch_updated_at();

create trigger public_profiles_updated_at
  before update on public_profiles
  for each row execute procedure touch_updated_at();
