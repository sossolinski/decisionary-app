create or replace function public.can_manage_session(
  p_session_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = p_session_id
      and (
        s.created_by = p_user_id
        or public.is_admin(p_user_id)
        or exists (
          select 1
          from public.session_role_assignments sra
          where sra.session_id = s.id
            and sra.user_id = p_user_id
            and sra.role_key in ('facilitator', 'admin')
        )
        or (
          s.scenario_id is not null
          and public.can_edit_scenario(s.scenario_id, p_user_id)
        )
      )
  );
$$;

grant execute on function public.can_manage_session(uuid, uuid) to authenticated;

create table if not exists public.join_session_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (user_id) on delete cascade,
  code text,
  success boolean not null default false,
  attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_join_session_attempts_user_time
on public.join_session_attempts (user_id, attempted_at desc);

alter table public.join_session_attempts enable row level security;

drop policy if exists join_session_attempts_admin_select on public.join_session_attempts;
create policy join_session_attempts_admin_select on public.join_session_attempts
for select
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.join_session(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_session_id uuid;
  v_mode text;
  v_limit integer;
  v_existing boolean;
  v_count integer;
  v_recent_attempts integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::integer
  into v_recent_attempts
  from public.join_session_attempts a
  where a.user_id = v_uid
    and a.success = false
    and a.attempted_at > timezone('utc', now()) - interval '10 minutes';

  if v_recent_attempts >= 20 then
    raise exception 'Too many join attempts. Try again in a few minutes.';
  end if;

  if v_code !~ '^[A-Z0-9]{4,12}$' then
    insert into public.join_session_attempts (user_id, code, success)
    values (v_uid, left(v_code, 32), false);
    raise exception 'Invalid join code';
  end if;

  select s.id, s.session_mode, s.participant_limit
  into v_session_id, v_mode, v_limit
  from public.sessions s
  where upper(s.join_code) = v_code
  limit 1;

  if v_session_id is null then
    insert into public.join_session_attempts (user_id, code, success)
    values (v_uid, left(v_code, 32), false);
    raise exception 'Invalid join code';
  end if;

  select exists (
    select 1
    from public.session_participants sp
    where sp.session_id = v_session_id
      and sp.user_id = v_uid
  ) into v_existing;

  if not v_existing then
    select count(*)::integer
    into v_count
    from public.session_participants sp
    where sp.session_id = v_session_id;

    if v_mode = 'rehearsal' and v_count >= 1 then
      insert into public.join_session_attempts (user_id, code, success)
      values (v_uid, left(v_code, 32), false);
      raise exception 'Rehearsal mode is limited to the creator only';
    end if;

    if v_mode = 'live' and v_limit is not null and v_count >= v_limit then
      insert into public.join_session_attempts (user_id, code, success)
      values (v_uid, left(v_code, 32), false);
      raise exception 'Participant limit reached for this live exercise';
    end if;
  end if;

  insert into public.session_participants (session_id, user_id)
  values (v_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (v_session_id, v_uid, 'participant')
  on conflict do nothing;

  insert into public.join_session_attempts (user_id, code, success)
  values (v_uid, left(v_code, 32), true);

  return v_session_id;
end;
$$;

grant execute on function public.join_session(text) to authenticated;

create or replace function public.set_session_task_status(
  p_task_id uuid,
  p_status public.session_task_status
)
returns public.session_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task public.session_tasks;
  v_patch_started_at timestamptz;
  v_patch_resolved_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_task
  from public.session_tasks
  where id = p_task_id;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  if not (
    public.can_manage_session(v_task.session_id, v_uid)
    or v_task.assigned_user_id = v_uid
    or v_task.created_by = v_uid
  ) then
    raise exception 'Session task not accessible';
  end if;

  v_patch_started_at := v_task.started_at;
  v_patch_resolved_at := v_task.resolved_at;

  if p_status = 'in_progress' then
    v_patch_started_at := coalesce(v_patch_started_at, timezone('utc', now()));
  elsif p_status = 'done' then
    v_patch_resolved_at := coalesce(v_patch_resolved_at, timezone('utc', now()));
  end if;

  update public.session_tasks
  set status = p_status,
      started_at = v_patch_started_at,
      resolved_at = v_patch_resolved_at,
      updated_by = v_uid,
      updated_at = timezone('utc', now())
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

grant execute on function public.set_session_task_status(uuid, public.session_task_status) to authenticated;

create or replace function public.remove_session_participant(
  p_session_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_session(p_session_id, v_uid) then
    raise exception 'Session not manageable';
  end if;

  delete from public.session_role_assignments
  where session_id = p_session_id
    and user_id = p_user_id;

  delete from public.session_participants
  where session_id = p_session_id
    and user_id = p_user_id;
end;
$$;

grant execute on function public.remove_session_participant(uuid, uuid) to authenticated;

create or replace function public.record_session_action(
  p_session_id uuid,
  p_session_inject_id uuid,
  p_source text,
  p_action_type text,
  p_comment text default null
)
returns public.session_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action public.session_actions;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  if p_source not in ('inbox', 'pulse') then
    raise exception 'Invalid action source';
  end if;

  if p_action_type not in ('ignore', 'escalate', 'act') then
    raise exception 'Invalid action type';
  end if;

  if p_session_inject_id is not null and not exists (
    select 1
    from public.session_injects si
    where si.id = p_session_inject_id
      and si.session_id = p_session_id
  ) then
    raise exception 'Session inject not found';
  end if;

  insert into public.session_actions (
    session_id,
    session_inject_id,
    source,
    action_type,
    comment,
    created_by
  )
  values (
    p_session_id,
    p_session_inject_id,
    p_source,
    p_action_type,
    nullif(trim(coalesce(p_comment, '')), ''),
    v_uid
  )
  returning * into v_action;

  return v_action;
end;
$$;

grant execute on function public.record_session_action(uuid, uuid, text, text, text) to authenticated;

create or replace function public.release_session_inject(
  p_session_id uuid,
  p_inject_id uuid,
  p_delivered_at timestamptz default timezone('utc', now())
)
returns public.session_injects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_inject public.session_injects;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_session(p_session_id, v_uid) then
    raise exception 'Session not manageable';
  end if;

  if not exists (select 1 from public.injects i where i.id = p_inject_id) then
    raise exception 'Inject not found';
  end if;

  insert into public.session_injects (
    session_id,
    inject_id,
    delivered_at
  )
  values (
    p_session_id,
    p_inject_id,
    coalesce(p_delivered_at, timezone('utc', now()))
  )
  returning * into v_session_inject;

  return v_session_inject;
end;
$$;

grant execute on function public.release_session_inject(uuid, uuid, timestamptz) to authenticated;

create or replace function public.record_session_decision_v2(
  p_session_id uuid,
  p_session_inject_id uuid,
  p_action_id uuid default null,
  p_owner_user_id uuid default null,
  p_decision_type public.session_decision_type default 'act',
  p_status public.session_decision_status default 'recorded',
  p_rationale text default null,
  p_outcome_code text default null
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

  if p_session_inject_id is not null and not exists (
    select 1
    from public.session_injects si
    where si.id = p_session_inject_id
      and si.session_id = p_session_id
  ) then
    raise exception 'Session inject not found';
  end if;

  if p_action_id is not null and not exists (
    select 1
    from public.session_actions sa
    where sa.id = p_action_id
      and sa.session_id = p_session_id
  ) then
    raise exception 'Session action not found';
  end if;

  insert into public.session_decisions (
    session_id,
    session_inject_id,
    action_id,
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
    p_action_id,
    coalesce(p_owner_user_id, v_uid),
    p_decision_type,
    coalesce(p_status, 'recorded'),
    nullif(trim(coalesce(p_rationale, '')), ''),
    nullif(trim(coalesce(p_outcome_code, '')), ''),
    v_uid,
    v_uid
  )
  returning * into v_decision;

  return v_decision;
end;
$$;

grant execute on function public.record_session_decision_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  public.session_decision_type,
  public.session_decision_status,
  text,
  text
) to authenticated;

create or replace function public.create_session_task_v2(
  p_session_id uuid,
  p_session_inject_id uuid default null,
  p_decision_id uuid default null,
  p_source_action_id uuid default null,
  p_assigned_role text default null,
  p_assigned_user_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_status public.session_task_status default 'open',
  p_priority public.session_task_priority default 'medium',
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
  v_started_at timestamptz;
  v_resolved_at timestamptz;
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

  if p_session_inject_id is not null and not exists (
    select 1
    from public.session_injects si
    where si.id = p_session_inject_id
      and si.session_id = p_session_id
  ) then
    raise exception 'Session inject not found';
  end if;

  if p_decision_id is not null and not exists (
    select 1
    from public.session_decisions sd
    where sd.id = p_decision_id
      and sd.session_id = p_session_id
  ) then
    raise exception 'Session decision not found';
  end if;

  if p_source_action_id is not null and not exists (
    select 1
    from public.session_actions sa
    where sa.id = p_source_action_id
      and sa.session_id = p_session_id
  ) then
    raise exception 'Session action not found';
  end if;

  if p_status = 'in_progress' then
    v_started_at := timezone('utc', now());
  elsif p_status = 'done' then
    v_resolved_at := timezone('utc', now());
  end if;

  insert into public.session_tasks (
    session_id,
    session_inject_id,
    decision_id,
    source_action_id,
    assigned_role,
    assigned_user_id,
    title,
    description,
    status,
    priority,
    due_at,
    started_at,
    resolved_at,
    created_by,
    updated_by
  )
  values (
    p_session_id,
    p_session_inject_id,
    p_decision_id,
    p_source_action_id,
    nullif(trim(coalesce(p_assigned_role, '')), ''),
    p_assigned_user_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_status, 'open'),
    coalesce(p_priority, 'medium'),
    p_due_at,
    v_started_at,
    v_resolved_at,
    v_uid,
    v_uid
  )
  returning * into v_task;

  return v_task;
end;
$$;

grant execute on function public.create_session_task_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  public.session_task_status,
  public.session_task_priority,
  timestamptz
) to authenticated;

create or replace function public.start_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_session(p_session_id, auth.uid()) then
    raise exception 'Session not manageable';
  end if;

  update public.sessions
  set status = 'live',
      started_at = coalesce(started_at, timezone('utc', now())),
      ended_at = null
  where id = p_session_id;
end;
$$;

grant execute on function public.start_session(uuid) to authenticated;

create or replace function public.set_session_status(
  p_session_id uuid,
  p_status public.session_status
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions;
begin
  if not public.can_manage_session(p_session_id, auth.uid()) then
    raise exception 'Session not manageable';
  end if;

  if p_status = 'live' then
    update public.sessions
    set status = 'live',
        started_at = coalesce(started_at, timezone('utc', now())),
        ended_at = null
    where id = p_session_id
    returning * into v_session;
  elsif p_status = 'ended' then
    update public.sessions
    set status = 'ended',
        ended_at = coalesce(ended_at, timezone('utc', now()))
    where id = p_session_id
    returning * into v_session;
  else
    update public.sessions
    set status = 'draft',
        ended_at = null
    where id = p_session_id
    returning * into v_session;
  end if;

  return v_session;
end;
$$;

grant execute on function public.set_session_status(uuid, public.session_status) to authenticated;

create or replace function public.update_session_casualties(
  p_session_id uuid,
  p_injured integer,
  p_fatalities integer,
  p_uninjured integer,
  p_unknown integer
)
returns public.session_situation
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_situation public.session_situation;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_session(p_session_id, v_uid) then
    raise exception 'Session not manageable';
  end if;

  if p_injured < 0 or p_fatalities < 0 or p_uninjured < 0 or p_unknown < 0 then
    raise exception 'Casualty counts cannot be negative';
  end if;

  update public.session_situation
  set injured = p_injured,
      fatalities = p_fatalities,
      uninjured = p_uninjured,
      unknown = p_unknown,
      updated_by = v_uid,
      updated_at = timezone('utc', now())
  where session_id = p_session_id
  returning * into v_situation;

  if v_situation.session_id is null then
    raise exception 'Session situation not found';
  end if;

  return v_situation;
end;
$$;

grant execute on function public.update_session_casualties(uuid, integer, integer, integer, integer) to authenticated;

create or replace function public.restart_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scenario public.scenarios;
begin
  if not public.can_manage_session(p_session_id, auth.uid()) then
    raise exception 'Session not manageable';
  end if;

  delete from public.session_actions where session_id = p_session_id;
  delete from public.session_decisions where session_id = p_session_id;
  delete from public.session_tasks where session_id = p_session_id;
  delete from public.session_consequences where session_id = p_session_id;
  delete from public.session_injects where session_id = p_session_id;

  update public.sessions
  set status = 'draft',
      started_at = null,
      ended_at = null
  where id = p_session_id;

  select s2.*
  into v_scenario
  from public.sessions s
  join public.scenarios s2 on s2.id = s.scenario_id
  where s.id = p_session_id;

  if v_scenario.id is not null then
    insert into public.session_situation (
      session_id,
      event_date,
      event_time,
      timezone,
      location,
      situation_type,
      short_description,
      injured,
      fatalities,
      uninjured,
      unknown,
      updated_by
    )
    values (
      p_session_id,
      v_scenario.event_date,
      v_scenario.event_time,
      v_scenario.timezone,
      v_scenario.location,
      v_scenario.situation_type,
      v_scenario.short_description,
      v_scenario.injured,
      v_scenario.fatalities,
      v_scenario.uninjured,
      v_scenario.unknown,
      auth.uid()
    )
    on conflict (session_id) do update
      set event_date = excluded.event_date,
          event_time = excluded.event_time,
          timezone = excluded.timezone,
          location = excluded.location,
          situation_type = excluded.situation_type,
          short_description = excluded.short_description,
          injured = excluded.injured,
          fatalities = excluded.fatalities,
          uninjured = excluded.uninjured,
          unknown = excluded.unknown,
          updated_by = excluded.updated_by,
          updated_at = timezone('utc', now());
  end if;
end;
$$;

grant execute on function public.restart_session(uuid) to authenticated;

create or replace function public.grant_session_role(
  p_session_id uuid,
  p_role_key text,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_actor uuid := auth.uid();
  v_mode text;
  v_limit integer;
  v_existing boolean;
  v_count integer;
begin
  if v_uid is null or v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_session(p_session_id, v_actor) then
    raise exception 'Session not manageable';
  end if;

  select s.session_mode, s.participant_limit
  into v_mode, v_limit
  from public.sessions s
  where s.id = p_session_id;

  if v_mode is null then
    raise exception 'Session not found';
  end if;

  select exists (
    select 1
    from public.session_participants sp
    where sp.session_id = p_session_id
      and sp.user_id = v_uid
  ) into v_existing;

  if not v_existing then
    select count(*)::integer
    into v_count
    from public.session_participants sp
    where sp.session_id = p_session_id;

    if v_mode = 'rehearsal' and v_count >= 1 then
      raise exception 'Rehearsal mode is limited to the creator only';
    end if;

    if v_mode = 'live' and v_limit is not null and v_count >= v_limit then
      raise exception 'Participant limit reached for this live exercise';
    end if;
  end if;

  insert into public.session_participants (session_id, user_id)
  values (p_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (p_session_id, v_uid, nullif(trim(coalesce(p_role_key, '')), ''))
  on conflict (session_id, user_id, role_key) do update
    set assigned_at = timezone('utc', now());
end;
$$;

grant execute on function public.grant_session_role(uuid, text, uuid) to authenticated;

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions
for update
to authenticated
using (public.can_manage_session(id, auth.uid()))
with check (public.can_manage_session(id, auth.uid()));

drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions
for delete
to authenticated
using (public.can_manage_session(id, auth.uid()));

drop policy if exists session_situation_all on public.session_situation;
drop policy if exists session_situation_select on public.session_situation;
drop policy if exists session_situation_insert on public.session_situation;
drop policy if exists session_situation_update on public.session_situation;
drop policy if exists session_situation_delete on public.session_situation;

create policy session_situation_select on public.session_situation
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_situation_insert on public.session_situation
for insert
to authenticated
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_situation_update on public.session_situation
for update
to authenticated
using (public.can_manage_session(session_id, auth.uid()))
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_situation_delete on public.session_situation
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

drop policy if exists session_injects_all on public.session_injects;
drop policy if exists session_injects_select on public.session_injects;
drop policy if exists session_injects_insert on public.session_injects;
drop policy if exists session_injects_update on public.session_injects;
drop policy if exists session_injects_delete on public.session_injects;

create policy session_injects_select on public.session_injects
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_injects_insert on public.session_injects
for insert
to authenticated
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_injects_update on public.session_injects
for update
to authenticated
using (public.can_manage_session(session_id, auth.uid()))
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_injects_delete on public.session_injects
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

drop policy if exists session_actions_all on public.session_actions;
drop policy if exists session_actions_select on public.session_actions;
drop policy if exists session_actions_insert on public.session_actions;
drop policy if exists session_actions_update on public.session_actions;
drop policy if exists session_actions_delete on public.session_actions;

create policy session_actions_select on public.session_actions
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_actions_insert on public.session_actions
for insert
to authenticated
with check (
  public.can_access_session(session_id, auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
);

create policy session_actions_update on public.session_actions
for update
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or created_by = auth.uid()
)
with check (
  public.can_manage_session(session_id, auth.uid())
  or created_by = auth.uid()
);

create policy session_actions_delete on public.session_actions
for delete
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or created_by = auth.uid()
);

drop policy if exists session_participants_all on public.session_participants;
drop policy if exists session_participants_select on public.session_participants;
drop policy if exists session_participants_insert on public.session_participants;
drop policy if exists session_participants_delete on public.session_participants;

create policy session_participants_select on public.session_participants
for select
to authenticated
using (
  public.can_access_session(session_id, auth.uid())
  or user_id = auth.uid()
);

create policy session_participants_insert on public.session_participants
for insert
to authenticated
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_participants_delete on public.session_participants
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

drop policy if exists session_role_slots_all on public.session_role_slots;
drop policy if exists session_role_slots_select on public.session_role_slots;
drop policy if exists session_role_slots_insert on public.session_role_slots;
drop policy if exists session_role_slots_update on public.session_role_slots;
drop policy if exists session_role_slots_delete on public.session_role_slots;

create policy session_role_slots_select on public.session_role_slots
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_role_slots_insert on public.session_role_slots
for insert
to authenticated
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_role_slots_update on public.session_role_slots
for update
to authenticated
using (public.can_manage_session(session_id, auth.uid()))
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_role_slots_delete on public.session_role_slots
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

drop policy if exists session_role_assignments_all on public.session_role_assignments;
drop policy if exists session_role_assignments_select on public.session_role_assignments;
drop policy if exists session_role_assignments_insert on public.session_role_assignments;
drop policy if exists session_role_assignments_update on public.session_role_assignments;
drop policy if exists session_role_assignments_delete on public.session_role_assignments;

create policy session_role_assignments_select on public.session_role_assignments
for select
to authenticated
using (
  public.can_access_session(session_id, auth.uid())
  or user_id = auth.uid()
);

create policy session_role_assignments_insert on public.session_role_assignments
for insert
to authenticated
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_role_assignments_update on public.session_role_assignments
for update
to authenticated
using (public.can_manage_session(session_id, auth.uid()))
with check (public.can_manage_session(session_id, auth.uid()));

create policy session_role_assignments_delete on public.session_role_assignments
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

drop policy if exists session_decisions_all on public.session_decisions;
drop policy if exists session_decisions_select on public.session_decisions;
drop policy if exists session_decisions_insert on public.session_decisions;
drop policy if exists session_decisions_update on public.session_decisions;
drop policy if exists session_decisions_delete on public.session_decisions;

create policy session_decisions_select on public.session_decisions
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_decisions_insert on public.session_decisions
for insert
to authenticated
with check (public.can_access_session(session_id, auth.uid()));

create policy session_decisions_update on public.session_decisions
for update
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or owner_user_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.can_manage_session(session_id, auth.uid())
  or owner_user_id = auth.uid()
  or created_by = auth.uid()
);

create policy session_decisions_delete on public.session_decisions
for delete
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or created_by = auth.uid()
);

drop policy if exists session_tasks_all on public.session_tasks;
drop policy if exists session_tasks_select on public.session_tasks;
drop policy if exists session_tasks_insert on public.session_tasks;
drop policy if exists session_tasks_update on public.session_tasks;
drop policy if exists session_tasks_delete on public.session_tasks;

create policy session_tasks_select on public.session_tasks
for select
to authenticated
using (
  public.can_access_session(session_id, auth.uid())
  or assigned_user_id = auth.uid()
);

create policy session_tasks_insert on public.session_tasks
for insert
to authenticated
with check (public.can_access_session(session_id, auth.uid()));

create policy session_tasks_update on public.session_tasks
for update
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or assigned_user_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.can_manage_session(session_id, auth.uid())
  or assigned_user_id = auth.uid()
  or created_by = auth.uid()
);

create policy session_tasks_delete on public.session_tasks
for delete
to authenticated
using (
  public.can_manage_session(session_id, auth.uid())
  or created_by = auth.uid()
);

drop policy if exists session_consequences_all on public.session_consequences;
drop policy if exists session_consequences_select on public.session_consequences;
drop policy if exists session_consequences_insert on public.session_consequences;
drop policy if exists session_consequences_delete on public.session_consequences;

create policy session_consequences_select on public.session_consequences
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

create policy session_consequences_insert on public.session_consequences
for insert
to authenticated
with check (public.can_access_session(session_id, auth.uid()));

create policy session_consequences_delete on public.session_consequences
for delete
to authenticated
using (public.can_manage_session(session_id, auth.uid()));

revoke all on function public.lookup_join_session(text) from public;
revoke execute on function public.lookup_join_session(text) from anon, authenticated;
