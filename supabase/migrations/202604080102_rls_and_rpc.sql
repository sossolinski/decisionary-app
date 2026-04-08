create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and p.role = 'admin'
      and p.is_disabled = false
  );
$$;

create or replace function public.can_facilitate(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and p.is_disabled = false
      and coalesce(p.active_role, p.role) in ('admin', 'facilitator')
  );
$$;

create or replace function public.can_read_scenario(p_scenario_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.scenarios s
    where s.id = p_scenario_id
      and (
        s.owner_id = p_user_id
        or public.is_admin(p_user_id)
        or exists (
          select 1
          from public.scenario_shares sh
          where sh.scenario_id = s.id
            and sh.shared_with = p_user_id
        )
      )
  );
$$;

create or replace function public.can_edit_scenario(p_scenario_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.scenarios s
    where s.id = p_scenario_id
      and (
        s.owner_id = p_user_id
        or public.is_admin(p_user_id)
        or exists (
          select 1
          from public.scenario_shares sh
          where sh.scenario_id = s.id
            and sh.shared_with = p_user_id
            and sh.permission = 'edit'
        )
      )
  );
$$;

create or replace function public.can_access_session(p_session_id uuid, p_user_id uuid default auth.uid())
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
          from public.session_participants sp
          where sp.session_id = s.id
            and sp.user_id = p_user_id
        )
        or exists (
          select 1
          from public.session_role_assignments sra
          where sra.session_id = s.id
            and sra.user_id = p_user_id
        )
        or (s.scenario_id is not null and public.can_read_scenario(s.scenario_id, p_user_id))
      )
  );
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '/+=', 'XYZ'), 1, 6));
    exit when not exists (select 1 from public.sessions where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.ensure_profile_bootstrap()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
  v_demo_org uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  insert into public.profiles (user_id, email, active_role)
  values (v_uid, v_email, 'participant')
  on conflict (user_id) do update
    set email = excluded.email
  returning * into v_profile;

  select id into v_demo_org
  from public.organizations
  where slug = 'decisionary-demo'
  limit 1;

  if v_demo_org is not null then
    insert into public.org_memberships (org_id, user_id, email, role, created_by)
    values (v_demo_org, v_uid, lower(v_email), 'participant', v_uid)
    on conflict (org_id, user_id) do nothing;

    insert into public.user_org_settings (user_id, active_org_id, active_role)
    values (v_uid, v_demo_org, coalesce(v_profile.active_role, v_profile.role))
    on conflict (user_id) do update
      set active_org_id = coalesce(public.user_org_settings.active_org_id, excluded.active_org_id),
          active_role = coalesce(public.user_org_settings.active_role, excluded.active_role);
  end if;

  select * into v_profile from public.profiles where user_id = v_uid;
  return v_profile;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, active_role)
  values (new.id, new.email, 'participant')
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.get_my_profile()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  active_role public.app_role,
  is_disabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  disabled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile_bootstrap();

  return query
  select
    p.user_id,
    p.email,
    p.full_name,
    p.role,
    coalesce(uos.active_role, p.active_role, p.role) as active_role,
    p.is_disabled,
    p.created_at,
    p.updated_at,
    p.disabled_at
  from public.profiles p
  left join public.user_org_settings uos on uos.user_id = p.user_id
  where p.user_id = auth.uid();
end;
$$;

create or replace function public.set_my_active_role(p_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile_bootstrap();

  update public.profiles
  set active_role = p_role
  where user_id = v_uid;

  insert into public.user_org_settings (user_id, active_role)
  values (v_uid, p_role)
  on conflict (user_id) do update
    set active_role = excluded.active_role;

  select * into v_profile from public.profiles where user_id = v_uid;
  return v_profile;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change permanent roles';
  end if;

  update public.profiles
  set role = p_role,
      active_role = p_role
  where user_id = p_user_id;
end;
$$;

create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can disable users';
  end if;

  update public.profiles
  set is_disabled = p_disabled,
      disabled_at = case when p_disabled then timezone('utc', now()) else null end
  where user_id = p_user_id;
end;
$$;

create or replace function public.transfer_scenario_ownership(p_scenario_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_scenario(p_scenario_id, auth.uid()) then
    raise exception 'Not allowed to transfer scenario';
  end if;

  update public.scenarios
  set owner_id = p_new_owner,
      updated_by = auth.uid(),
      updated_at = timezone('utc', now())
  where id = p_scenario_id;
end;
$$;

create or replace function public.create_session_from_scenario(p_scenario_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_join_code text;
  v_scenario public.scenarios;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_read_scenario(p_scenario_id, v_uid) then
    raise exception 'Scenario not accessible';
  end if;

  select * into v_scenario
  from public.scenarios
  where id = p_scenario_id;

  if v_scenario.id is null then
    raise exception 'Scenario not found';
  end if;

  v_join_code := public.generate_join_code();

  insert into public.sessions (title, scenario_id, join_code, status, created_by)
  values (coalesce(nullif(trim(p_title), ''), v_scenario.title, 'New session'), p_scenario_id, v_join_code, 'draft', v_uid)
  returning id into v_session_id;

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
    v_session_id,
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
    v_uid
  )
  on conflict (session_id) do nothing;

  insert into public.session_participants (session_id, user_id)
  values (v_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (v_session_id, v_uid, 'facilitator')
  on conflict do nothing;

  perform public.ensure_session_role_slots(v_session_id);

  return v_session_id;
end;
$$;

create or replace function public.grant_session_role(p_session_id uuid, p_role_key text, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_actor uuid := auth.uid();
begin
  if v_uid is null or v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_actor) then
    raise exception 'Session not accessible';
  end if;

  insert into public.session_participants (session_id, user_id)
  values (p_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (p_session_id, v_uid, p_role_key)
  on conflict (session_id, user_id, role_key) do update
    set assigned_at = timezone('utc', now());
end;
$$;

create or replace function public.ensure_session_role_slots(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scenario_id uuid;
begin
  select scenario_id into v_scenario_id
  from public.sessions
  where id = p_session_id;

  if v_scenario_id is null then
    return;
  end if;

  insert into public.session_role_slots (session_id, role_key, capacity)
  select p_session_id, sr.role_key, case when sr.is_required then 1 else null end
  from public.scenario_roles sr
  where sr.scenario_id = v_scenario_id
  on conflict (session_id, role_key) do nothing;
end;
$$;

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
      started_at = coalesce(started_at, timezone('utc', now())),
      ended_at = null
  where id = p_session_id;
end;
$$;

create or replace function public.restart_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scenario public.scenarios;
begin
  if not public.can_access_session(p_session_id, auth.uid()) then
    raise exception 'Session not accessible';
  end if;

  delete from public.session_actions where session_id = p_session_id;
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

create or replace function public.join_session(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.id
  into v_session_id
  from public.sessions s
  where upper(s.join_code) = upper(trim(p_code))
  limit 1;

  if v_session_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.session_participants (session_id, user_id)
  values (v_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (v_session_id, v_uid, 'participant')
  on conflict do nothing;

  return v_session_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.user_org_settings enable row level security;
alter table public.facilitator_invites enable row level security;
alter table public.managed_participants enable row level security;
alter table public.scenarios enable row level security;
alter table public.injects enable row level security;
alter table public.scenario_injects enable row level security;
alter table public.scenario_roles enable row level security;
alter table public.scenario_shares enable row level security;
alter table public.sessions enable row level security;
alter table public.session_situation enable row level security;
alter table public.session_injects enable row level security;
alter table public.session_actions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_role_slots enable row level security;
alter table public.session_role_assignments enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.org_memberships om
    where om.org_id = organizations.id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists org_memberships_select on public.org_memberships;
create policy org_memberships_select on public.org_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1 from public.org_memberships om
    where om.org_id = org_memberships.org_id
      and om.user_id = auth.uid()
      and om.role = 'admin'
      and om.is_active = true
  )
);

drop policy if exists org_memberships_insert on public.org_memberships;
create policy org_memberships_insert on public.org_memberships
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists org_memberships_update on public.org_memberships;
create policy org_memberships_update on public.org_memberships
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists user_org_settings_select on public.user_org_settings;
create policy user_org_settings_select on public.user_org_settings
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_org_settings_upsert on public.user_org_settings;
create policy user_org_settings_upsert on public.user_org_settings
for all
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists facilitator_invites_select on public.facilitator_invites;
create policy facilitator_invites_select on public.facilitator_invites
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists facilitator_invites_write on public.facilitator_invites;
create policy facilitator_invites_write on public.facilitator_invites
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists managed_participants_all on public.managed_participants;
create policy managed_participants_all on public.managed_participants
for all
to authenticated
using (public.is_admin(auth.uid()) or public.can_facilitate(auth.uid()))
with check (public.is_admin(auth.uid()) or public.can_facilitate(auth.uid()));

drop policy if exists scenarios_select on public.scenarios;
create policy scenarios_select on public.scenarios
for select
to authenticated
using (public.can_read_scenario(id, auth.uid()));

drop policy if exists scenarios_insert on public.scenarios;
create policy scenarios_insert on public.scenarios
for insert
to authenticated
with check (
  public.can_facilitate(auth.uid())
  and coalesce(owner_id, auth.uid()) = auth.uid()
);

drop policy if exists scenarios_update on public.scenarios;
create policy scenarios_update on public.scenarios
for update
to authenticated
using (public.can_edit_scenario(id, auth.uid()))
with check (public.can_edit_scenario(id, auth.uid()));

drop policy if exists scenarios_delete on public.scenarios;
create policy scenarios_delete on public.scenarios
for delete
to authenticated
using (public.can_edit_scenario(id, auth.uid()));

drop policy if exists injects_all on public.injects;
create policy injects_all on public.injects
for all
to authenticated
using (public.can_facilitate(auth.uid()) or public.is_admin(auth.uid()))
with check (public.can_facilitate(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists scenario_injects_all on public.scenario_injects;
create policy scenario_injects_all on public.scenario_injects
for all
to authenticated
using (public.can_read_scenario(scenario_id, auth.uid()))
with check (public.can_edit_scenario(scenario_id, auth.uid()));

drop policy if exists scenario_roles_all on public.scenario_roles;
create policy scenario_roles_all on public.scenario_roles
for all
to authenticated
using (public.can_read_scenario(scenario_id, auth.uid()))
with check (public.can_edit_scenario(scenario_id, auth.uid()));

drop policy if exists scenario_shares_all on public.scenario_shares;
create policy scenario_shares_all on public.scenario_shares
for all
to authenticated
using (public.can_edit_scenario(scenario_id, auth.uid()) or shared_with = auth.uid())
with check (public.can_edit_scenario(scenario_id, auth.uid()));

drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions
for select
to authenticated
using (public.can_access_session(id, auth.uid()));

drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions
for insert
to authenticated
with check (public.can_facilitate(auth.uid()) and coalesce(created_by, auth.uid()) = auth.uid());

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions
for update
to authenticated
using (public.can_access_session(id, auth.uid()))
with check (public.can_access_session(id, auth.uid()));

drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions
for delete
to authenticated
using (public.can_access_session(id, auth.uid()));

drop policy if exists session_situation_all on public.session_situation;
create policy session_situation_all on public.session_situation
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_injects_all on public.session_injects;
create policy session_injects_all on public.session_injects
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_actions_all on public.session_actions;
create policy session_actions_all on public.session_actions
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_participants_all on public.session_participants;
create policy session_participants_all on public.session_participants
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()) or user_id = auth.uid())
with check (public.can_access_session(session_id, auth.uid()) or user_id = auth.uid());

drop policy if exists session_role_slots_all on public.session_role_slots;
create policy session_role_slots_all on public.session_role_slots
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_role_assignments_all on public.session_role_assignments;
create policy session_role_assignments_all on public.session_role_assignments
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()) or user_id = auth.uid())
with check (public.can_access_session(session_id, auth.uid()) or user_id = auth.uid());

grant execute on function public.ensure_profile_bootstrap() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.set_my_active_role(public.app_role) to authenticated;
grant execute on function public.create_session_from_scenario(uuid, text) to authenticated;
grant execute on function public.grant_session_role(uuid, text, uuid) to authenticated;
grant execute on function public.ensure_session_role_slots(uuid) to authenticated;
grant execute on function public.start_session(uuid) to authenticated;
grant execute on function public.restart_session(uuid) to authenticated;
grant execute on function public.join_session(text) to authenticated;
grant execute on function public.transfer_scenario_ownership(uuid, uuid) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
