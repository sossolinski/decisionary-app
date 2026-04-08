create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'facilitator', 'participant');
  end if;

  if not exists (select 1 from pg_type where typname = 'scenario_share_permission') then
    create type public.scenario_share_permission as enum ('read', 'edit');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('draft', 'live', 'ended');
  end if;

  if not exists (select 1 from pg_type where typname = 'facilitator_invite_status') then
    create type public.facilitator_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'participant',
  active_role public.app_role,
  is_disabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  disabled_at timestamptz
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  archived boolean not null default false
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (user_id) on delete cascade,
  email text,
  role public.app_role not null default 'participant',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  unique (org_id, user_id),
  unique (org_id, email)
);

create table if not exists public.user_org_settings (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  active_org_id uuid references public.organizations (id) on delete set null,
  active_role public.app_role,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.facilitator_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  token text not null unique,
  status public.facilitator_invite_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.managed_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null,
  email text,
  join_code text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  active boolean not null default true,
  unique (org_id, join_code)
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (user_id) on delete set null,
  title text not null default 'Untitled scenario',
  description text,
  event_date text,
  event_time text,
  timezone text,
  location text,
  situation_type text,
  short_description text,
  injured integer not null default 0,
  fatalities integer not null default 0,
  uninjured integer not null default 0,
  unknown integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null,
  check (injured >= 0),
  check (fatalities >= 0),
  check (uninjured >= 0),
  check (unknown >= 0)
);

create table if not exists public.injects (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  channel text,
  severity text,
  sender_name text,
  sender_org text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.scenario_injects (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  inject_id uuid not null references public.injects (id) on delete cascade,
  scheduled_at timestamptz,
  order_index integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  unique (scenario_id, inject_id, order_index)
);

create table if not exists public.scenario_roles (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  role_key text not null,
  role_name text not null,
  role_description text,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (scenario_id, role_key)
);

create table if not exists public.scenario_shares (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  shared_with uuid not null references public.profiles (user_id) on delete cascade,
  permission public.scenario_share_permission not null default 'read',
  created_at timestamptz not null default timezone('utc', now()),
  unique (scenario_id, shared_with)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  scenario_id uuid references public.scenarios (id) on delete set null,
  join_code text not null unique,
  status public.session_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.session_situation (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  event_date text,
  event_time text,
  timezone text,
  location text,
  situation_type text,
  short_description text,
  injured integer not null default 0,
  fatalities integer not null default 0,
  uninjured integer not null default 0,
  unknown integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null,
  check (injured >= 0),
  check (fatalities >= 0),
  check (uninjured >= 0),
  check (unknown >= 0)
);

create table if not exists public.session_injects (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  delivered_at timestamptz not null default timezone('utc', now()),
  inject_id uuid not null references public.injects (id) on delete cascade
);

create table if not exists public.session_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_inject_id uuid references public.session_injects (id) on delete set null,
  source text not null check (source in ('inbox', 'pulse')),
  action_type text not null check (action_type in ('ignore', 'escalate', 'act')),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, user_id)
);

create table if not exists public.session_role_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role_key text not null,
  capacity integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (session_id, role_key)
);

create table if not exists public.session_role_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role_key text,
  scenario_role_id uuid references public.scenario_roles (id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  unique (session_id, user_id, role_key)
);

create index if not exists idx_org_memberships_user_id on public.org_memberships (user_id);
create index if not exists idx_scenarios_owner_id on public.scenarios (owner_id);
create index if not exists idx_scenario_injects_scenario_id on public.scenario_injects (scenario_id, order_index);
create index if not exists idx_scenario_roles_scenario_id on public.scenario_roles (scenario_id, sort_order);
create index if not exists idx_sessions_scenario_id on public.sessions (scenario_id);
create index if not exists idx_sessions_created_by on public.sessions (created_by);
create index if not exists idx_session_injects_session_id on public.session_injects (session_id, delivered_at desc);
create index if not exists idx_session_actions_session_id on public.session_actions (session_id, created_at desc);
create index if not exists idx_session_participants_user_id on public.session_participants (user_id);
create index if not exists idx_session_role_assignments_session_id on public.session_role_assignments (session_id);
create index if not exists idx_session_role_assignments_user_id on public.session_role_assignments (user_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists user_org_settings_set_updated_at on public.user_org_settings;
create trigger user_org_settings_set_updated_at
before update on public.user_org_settings
for each row
execute function public.set_updated_at();

drop trigger if exists scenarios_set_updated_by on public.scenarios;
create trigger scenarios_set_updated_by
before update on public.scenarios
for each row
execute function public.set_updated_by();

drop trigger if exists session_situation_set_updated_by on public.session_situation;
create trigger session_situation_set_updated_by
before update on public.session_situation
for each row
execute function public.set_updated_by();
