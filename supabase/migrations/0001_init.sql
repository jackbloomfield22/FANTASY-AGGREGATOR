-- Fantasy Aggregator — initial schema
-- Canonical-player-centric model:
--   players (canonical NFL player) <- roster_slots -> fantasy_teams -> leagues
-- Every user-owned row is protected by RLS on user_id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid () = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid () = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid () = id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- fantasy_connections
-- ---------------------------------------------------------------------------
create table if not exists public.fantasy_connections (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('sleeper', 'yahoo', 'espn', 'demo')),
  provider_user_id text not null,
  provider_username text,
  status text not null default 'connected' check (status in ('connected', 'expired', 'disconnected')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.fantasy_connections enable row level security;
create policy "connections: own rows" on public.fantasy_connections
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create index if not exists idx_connections_user on public.fantasy_connections (user_id);

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_league_id text not null,
  name text not null,
  season int not null,
  week int not null default 0,
  scoring_type text not null default 'custom',
  scoring_settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  unique (user_id, provider, provider_league_id)
);

alter table public.leagues enable row level security;
create policy "leagues: own rows" on public.leagues
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create index if not exists idx_leagues_user on public.leagues (user_id);

-- ---------------------------------------------------------------------------
-- fantasy_teams
-- ---------------------------------------------------------------------------
create table if not exists public.fantasy_teams (
  id uuid primary key default gen_random_uuid (),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_roster_id text not null,
  name text not null,
  owner_name text,
  is_user_team boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (league_id, provider_roster_id)
);

alter table public.fantasy_teams enable row level security;
create policy "fantasy_teams: own rows" on public.fantasy_teams
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create index if not exists idx_fantasy_teams_league on public.fantasy_teams (league_id);

-- ---------------------------------------------------------------------------
-- players (canonical NFL players — shared, read-only to users)
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid (),
  provider_player_ids jsonb not null default '{}'::jsonb, -- {sleeper, sportradar, espn, yahoo, ...}
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null,
  position text not null,
  nfl_team text,
  status text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
create policy "players: readable by all authenticated" on public.players
  for select using (auth.role () = 'authenticated');
-- Writes to the canonical directory happen with the service-role key only.

create index if not exists idx_players_sleeper on public.players ((provider_player_ids ->> 'sleeper'));
create index if not exists idx_players_sportradar on public.players ((provider_player_ids ->> 'sportradar'));
create index if not exists idx_players_name_team on public.players (full_name, nfl_team);

-- ---------------------------------------------------------------------------
-- roster_slots
-- ---------------------------------------------------------------------------
create table if not exists public.roster_slots (
  id uuid primary key default gen_random_uuid (),
  fantasy_team_id uuid not null references public.fantasy_teams (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null default 'BN',
  is_starter boolean not null default false,
  week int not null,
  provider_points numeric,
  metadata jsonb not null default '{}'::jsonb,
  unique (fantasy_team_id, player_id, week)
);

alter table public.roster_slots enable row level security;
create policy "roster_slots: own rows" on public.roster_slots
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create index if not exists idx_roster_slots_team_week on public.roster_slots (fantasy_team_id, week);
create index if not exists idx_roster_slots_player on public.roster_slots (player_id);

-- ---------------------------------------------------------------------------
-- matchups
-- ---------------------------------------------------------------------------
create table if not exists public.matchups (
  id uuid primary key default gen_random_uuid (),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week int not null,
  user_team_id uuid not null references public.fantasy_teams (id) on delete cascade,
  opponent_team_id uuid references public.fantasy_teams (id) on delete set null,
  user_score numeric not null default 0,
  opponent_score numeric not null default 0,
  user_projected numeric not null default 0,
  opponent_projected numeric not null default 0,
  win_probability numeric,
  status text not null default 'tossup',
  metadata jsonb not null default '{}'::jsonb,
  unique (league_id, week)
);

alter table public.matchups enable row level security;
create policy "matchups: own rows" on public.matchups
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create index if not exists idx_matchups_user_week on public.matchups (user_id, week);

-- ---------------------------------------------------------------------------
-- nfl_games (shared live game state — read-only to users)
-- ---------------------------------------------------------------------------
create table if not exists public.nfl_games (
  id uuid primary key default gen_random_uuid (),
  provider_game_id text not null unique,
  week int not null,
  home_team text not null,
  away_team text not null,
  home_score int not null default 0,
  away_score int not null default 0,
  game_status text not null default 'scheduled',
  quarter int,
  clock text,
  possession_team text,
  ball_yard_line int,
  down int,
  distance int,
  red_zone boolean not null default false,
  kickoff_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.nfl_games enable row level security;
create policy "nfl_games: readable by all authenticated" on public.nfl_games
  for select using (auth.role () = 'authenticated');

create index if not exists idx_nfl_games_week on public.nfl_games (week);
create index if not exists idx_nfl_games_status on public.nfl_games (game_status);

-- ---------------------------------------------------------------------------
-- player_game_stats (shared raw stats — read-only to users)
-- ---------------------------------------------------------------------------
create table if not exists public.player_game_stats (
  id uuid primary key default gen_random_uuid (),
  game_id uuid not null references public.nfl_games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  stats jsonb not null default '{}'::jsonb, -- normalized RawStatLine keys
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

alter table public.player_game_stats enable row level security;
create policy "player_game_stats: readable by all authenticated" on public.player_game_stats
  for select using (auth.role () = 'authenticated');

create index if not exists idx_pgs_player on public.player_game_stats (player_id);
