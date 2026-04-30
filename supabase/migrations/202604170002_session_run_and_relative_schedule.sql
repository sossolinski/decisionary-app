alter table public.sessions
  add column if not exists run_number integer not null default 0;

alter table public.scenario_injects
  add column if not exists release_offset_minutes integer;

alter table public.session_injects
  add column if not exists session_run_number integer;

alter table public.session_actions
  add column if not exists session_run_number integer;

alter table public.session_decisions
  add column if not exists session_run_number integer;

alter table public.session_tasks
  add column if not exists session_run_number integer;

alter table public.session_consequences
  add column if not exists session_run_number integer;

alter table public.session_rule_evaluations
  add column if not exists session_run_number integer;

create or replace function public.assign_session_run_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.session_run_number is null and new.session_id is not null then
    select run_number
    into new.session_run_number
    from public.sessions
    where id = new.session_id;
  end if;

  return new;
end;
$$;

drop trigger if exists session_injects_assign_run_number on public.session_injects;
create trigger session_injects_assign_run_number
before insert on public.session_injects
for each row
execute function public.assign_session_run_number();

drop trigger if exists session_actions_assign_run_number on public.session_actions;
create trigger session_actions_assign_run_number
before insert on public.session_actions
for each row
execute function public.assign_session_run_number();

drop trigger if exists session_decisions_assign_run_number on public.session_decisions;
create trigger session_decisions_assign_run_number
before insert on public.session_decisions
for each row
execute function public.assign_session_run_number();

drop trigger if exists session_tasks_assign_run_number on public.session_tasks;
create trigger session_tasks_assign_run_number
before insert on public.session_tasks
for each row
execute function public.assign_session_run_number();

drop trigger if exists session_consequences_assign_run_number on public.session_consequences;
create trigger session_consequences_assign_run_number
before insert on public.session_consequences
for each row
execute function public.assign_session_run_number();

drop trigger if exists session_rule_evaluations_assign_run_number on public.session_rule_evaluations;
create trigger session_rule_evaluations_assign_run_number
before insert on public.session_rule_evaluations
for each row
execute function public.assign_session_run_number();

update public.session_injects si
set session_run_number = s.run_number
from public.sessions s
where s.id = si.session_id
  and si.session_run_number is null;

update public.session_actions sa
set session_run_number = s.run_number
from public.sessions s
where s.id = sa.session_id
  and sa.session_run_number is null;

update public.session_decisions sd
set session_run_number = s.run_number
from public.sessions s
where s.id = sd.session_id
  and sd.session_run_number is null;

update public.session_tasks st
set session_run_number = s.run_number
from public.sessions s
where s.id = st.session_id
  and st.session_run_number is null;

update public.session_consequences sc
set session_run_number = s.run_number
from public.sessions s
where s.id = sc.session_id
  and sc.session_run_number is null;

update public.session_rule_evaluations sre
set session_run_number = s.run_number
from public.sessions s
where s.id = sre.session_id
  and sre.session_run_number is null;

create or replace function public.start_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_session(p_session_id, auth.uid()) then
    raise exception 'Session not accessible';
  end if;

  update public.sessions
  set status = 'live',
      run_number = case
        when status is distinct from 'live'::public.session_status then coalesce(run_number, 0) + 1
        else coalesce(run_number, 0)
      end,
      started_at = case
        when status is distinct from 'live'::public.session_status then timezone('utc', now())
        else coalesce(started_at, timezone('utc', now()))
      end,
      ended_at = null
  where id = p_session_id;
end;
$$;

create index if not exists idx_session_injects_run_number
on public.session_injects (session_id, session_run_number, delivered_at desc);

create index if not exists idx_session_actions_run_number
on public.session_actions (session_id, session_run_number, created_at desc);

create index if not exists idx_session_decisions_run_number
on public.session_decisions (session_id, session_run_number, created_at desc);

create index if not exists idx_session_tasks_run_number
on public.session_tasks (session_id, session_run_number, created_at desc);

create index if not exists idx_session_consequences_run_number
on public.session_consequences (session_id, session_run_number, applied_at desc);

create index if not exists idx_session_rule_evaluations_run_number
on public.session_rule_evaluations (session_id, session_run_number, created_at desc);
