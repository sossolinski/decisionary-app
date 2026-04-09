do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_decision_type') then
    create type public.session_decision_type as enum ('ignore', 'escalate', 'act', 'confirm', 'deny');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_decision_status') then
    create type public.session_decision_status as enum ('open', 'recorded', 'resolved', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_task_status') then
    create type public.session_task_status as enum ('open', 'in_progress', 'blocked', 'done', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_task_priority') then
    create type public.session_task_priority as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

create table if not exists public.session_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_inject_id uuid references public.session_injects (id) on delete set null,
  action_id uuid references public.session_actions (id) on delete set null,
  owner_user_id uuid references public.profiles (user_id) on delete set null,
  decision_type public.session_decision_type not null,
  status public.session_decision_status not null default 'recorded',
  due_at timestamptz,
  rationale text,
  outcome_code text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.session_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_inject_id uuid references public.session_injects (id) on delete set null,
  decision_id uuid references public.session_decisions (id) on delete set null,
  source_action_id uuid references public.session_actions (id) on delete set null,
  assigned_role text,
  assigned_user_id uuid references public.profiles (user_id) on delete set null,
  title text not null,
  description text,
  status public.session_task_status not null default 'open',
  priority public.session_task_priority not null default 'medium',
  due_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null
);

create index if not exists idx_session_decisions_session_id on public.session_decisions (session_id, created_at desc);
create index if not exists idx_session_decisions_inject_id on public.session_decisions (session_inject_id);
create index if not exists idx_session_tasks_session_id on public.session_tasks (session_id, created_at desc);
create index if not exists idx_session_tasks_status on public.session_tasks (session_id, status, priority);
create index if not exists idx_session_tasks_assigned_user on public.session_tasks (assigned_user_id);

drop trigger if exists session_decisions_set_updated_by on public.session_decisions;
create trigger session_decisions_set_updated_by
before update on public.session_decisions
for each row
execute function public.set_updated_by();

drop trigger if exists session_tasks_set_updated_by on public.session_tasks;
create trigger session_tasks_set_updated_by
before update on public.session_tasks
for each row
execute function public.set_updated_by();

alter table public.session_decisions enable row level security;
alter table public.session_tasks enable row level security;

drop policy if exists session_decisions_all on public.session_decisions;
create policy session_decisions_all on public.session_decisions
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_tasks_all on public.session_tasks;
create policy session_tasks_all on public.session_tasks
for all
to authenticated
using (
  public.can_access_session(session_id, auth.uid())
  or assigned_user_id = auth.uid()
)
with check (
  public.can_access_session(session_id, auth.uid())
  or assigned_user_id = auth.uid()
);

create or replace function public.record_session_decision(
  p_session_id uuid,
  p_session_inject_id uuid,
  p_decision_type public.session_decision_type,
  p_rationale text default null,
  p_outcome_code text default null,
  p_owner_user_id uuid default auth.uid()
)
returns public.session_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_decision public.session_decisions;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  insert into public.session_decisions (
    session_id,
    session_inject_id,
    owner_user_id,
    decision_type,
    status,
    rationale,
    outcome_code,
    created_by,
    updated_by
  )
  values (
    p_session_id,
    p_session_inject_id,
    coalesce(p_owner_user_id, v_uid),
    p_decision_type,
    'recorded',
    nullif(trim(coalesce(p_rationale, '')), ''),
    nullif(trim(coalesce(p_outcome_code, '')), ''),
    v_uid,
    v_uid
  )
  returning * into v_decision;

  return v_decision;
end;
$$;

create or replace function public.create_session_task(
  p_session_id uuid,
  p_title text,
  p_description text default null,
  p_priority public.session_task_priority default 'medium',
  p_assigned_role text default null,
  p_assigned_user_id uuid default null,
  p_session_inject_id uuid default null,
  p_decision_id uuid default null,
  p_due_at timestamptz default null
)
returns public.session_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task public.session_tasks;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Task title is required';
  end if;

  insert into public.session_tasks (
    session_id,
    session_inject_id,
    decision_id,
    assigned_role,
    assigned_user_id,
    title,
    description,
    priority,
    due_at,
    created_by,
    updated_by
  )
  values (
    p_session_id,
    p_session_inject_id,
    p_decision_id,
    nullif(trim(coalesce(p_assigned_role, '')), ''),
    p_assigned_user_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_priority, 'medium'),
    p_due_at,
    v_uid,
    v_uid
  )
  returning * into v_task;

  return v_task;
end;
$$;

grant execute on function public.record_session_decision(uuid, uuid, public.session_decision_type, text, text, uuid) to authenticated;
grant execute on function public.create_session_task(uuid, text, text, public.session_task_priority, text, uuid, uuid, uuid, timestamptz) to authenticated;
