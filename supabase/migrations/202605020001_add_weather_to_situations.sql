alter table public.scenarios
  add column if not exists weather text;

alter table public.session_situation
  add column if not exists weather text;

update public.scenarios
set location = 'Final approach to a major European airport',
    weather = coalesce(nullif(trim(weather), ''), 'Low ceiling and rain')
where location = 'Final approach to a major European airport in low ceiling and rain';

update public.session_situation
set location = 'Final approach to a major European airport',
    weather = coalesce(nullif(trim(weather), ''), 'Low ceiling and rain')
where location = 'Final approach to a major European airport in low ceiling and rain';

create or replace function public.create_rehearsal_session_from_scenario(p_scenario_id uuid, p_title text)
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
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_active_org_required();

  if not public.user_belongs_to_org(v_org_id, v_uid) then
    raise exception 'Active organization not accessible';
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

  insert into public.sessions (
    title,
    scenario_id,
    org_id,
    join_code,
    status,
    session_mode,
    participant_limit,
    created_by
  )
  values (
    coalesce(nullif(trim(p_title), ''), v_scenario.title, 'Rehearsal session'),
    p_scenario_id,
    v_org_id,
    v_join_code,
    'draft',
    'rehearsal',
    1,
    v_uid
  )
  returning id into v_session_id;

  insert into public.session_situation (
    session_id,
    event_date,
    event_time,
    timezone,
    location,
    location_lat,
    location_lng,
    weather,
    situation_type,
    short_description,
    injured,
    fatalities,
    uninjured,
    unknown,
    passenger_count,
    crew_count,
    cargo_weight_kg,
    dangerous_goods_count,
    live_animals_count,
    updated_by
  )
  values (
    v_session_id,
    v_scenario.event_date,
    v_scenario.event_time,
    v_scenario.timezone,
    v_scenario.location,
    v_scenario.location_lat,
    v_scenario.location_lng,
    v_scenario.weather,
    v_scenario.situation_type,
    v_scenario.short_description,
    v_scenario.injured,
    v_scenario.fatalities,
    v_scenario.uninjured,
    v_scenario.unknown,
    v_scenario.passenger_count,
    v_scenario.crew_count,
    v_scenario.cargo_weight_kg,
    v_scenario.dangerous_goods_count,
    v_scenario.live_animals_count,
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

create or replace function public.create_live_session_from_scenario(
  p_scenario_id uuid,
  p_title text,
  p_requested_participant_limit integer default 5
)
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
  v_org_id uuid;
  v_required_limit integer := greatest(coalesce(p_requested_participant_limit, 5), 1);
  v_entitlement public.billing_entitlements;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.get_my_active_org_required();

  if not public.user_belongs_to_org(v_org_id, v_uid) then
    raise exception 'Active organization not accessible';
  end if;

  if not public.can_read_scenario(p_scenario_id, v_uid) then
    raise exception 'Scenario not accessible';
  end if;

  if v_required_limit > 15 then
    raise exception 'Live exercises above 15 participants require manual enterprise provisioning';
  end if;

  select * into v_scenario
  from public.scenarios
  where id = p_scenario_id;

  if v_scenario.id is null then
    raise exception 'Scenario not found';
  end if;

  select *
  into v_entitlement
  from public.billing_entitlements be
  where be.org_id = v_org_id
    and be.entitlement_type = 'live_exercise'
    and be.status = 'active'
    and be.remaining_quantity > 0
    and be.activate_at <= timezone('utc', now())
    and (be.expires_at is null or be.expires_at > timezone('utc', now()))
    and coalesce(be.participant_limit, 0) >= v_required_limit
  order by be.participant_limit asc, be.created_at asc
  limit 1
  for update;

  if v_entitlement.id is null then
    raise exception 'No live exercise access is available for this organization';
  end if;

  v_join_code := public.generate_join_code();

  insert into public.sessions (
    title,
    scenario_id,
    org_id,
    join_code,
    status,
    session_mode,
    participant_limit,
    source_entitlement_id,
    created_by
  )
  values (
    coalesce(nullif(trim(p_title), ''), v_scenario.title, 'Live exercise'),
    p_scenario_id,
    v_org_id,
    v_join_code,
    'draft',
    'live',
    v_entitlement.participant_limit,
    v_entitlement.id,
    v_uid
  )
  returning id into v_session_id;

  insert into public.session_situation (
    session_id,
    event_date,
    event_time,
    timezone,
    location,
    location_lat,
    location_lng,
    weather,
    situation_type,
    short_description,
    injured,
    fatalities,
    uninjured,
    unknown,
    passenger_count,
    crew_count,
    cargo_weight_kg,
    dangerous_goods_count,
    live_animals_count,
    updated_by
  )
  values (
    v_session_id,
    v_scenario.event_date,
    v_scenario.event_time,
    v_scenario.timezone,
    v_scenario.location,
    v_scenario.location_lat,
    v_scenario.location_lng,
    v_scenario.weather,
    v_scenario.situation_type,
    v_scenario.short_description,
    v_scenario.injured,
    v_scenario.fatalities,
    v_scenario.uninjured,
    v_scenario.unknown,
    v_scenario.passenger_count,
    v_scenario.crew_count,
    v_scenario.cargo_weight_kg,
    v_scenario.dangerous_goods_count,
    v_scenario.live_animals_count,
    v_uid
  )
  on conflict (session_id) do nothing;

  insert into public.session_participants (session_id, user_id)
  values (v_session_id, v_uid)
  on conflict do nothing;

  insert into public.session_role_assignments (session_id, user_id, role_key)
  values (v_session_id, v_uid, 'facilitator')
  on conflict do nothing;

  update public.billing_entitlements
  set remaining_quantity = greatest(remaining_quantity - 1, 0),
      status = case when remaining_quantity - 1 <= 0 then 'consumed' else status end,
      updated_at = timezone('utc', now()),
      updated_by = v_uid
  where id = v_entitlement.id;

  perform public.ensure_session_role_slots(v_session_id);

  return v_session_id;
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
      location_lat,
      location_lng,
      weather,
      situation_type,
      short_description,
      injured,
      fatalities,
      uninjured,
      unknown,
      passenger_count,
      crew_count,
      cargo_weight_kg,
      dangerous_goods_count,
      live_animals_count,
      updated_by
    )
    values (
      p_session_id,
      v_scenario.event_date,
      v_scenario.event_time,
      v_scenario.timezone,
      v_scenario.location,
      v_scenario.location_lat,
      v_scenario.location_lng,
      v_scenario.weather,
      v_scenario.situation_type,
      v_scenario.short_description,
      v_scenario.injured,
      v_scenario.fatalities,
      v_scenario.uninjured,
      v_scenario.unknown,
      v_scenario.passenger_count,
      v_scenario.crew_count,
      v_scenario.cargo_weight_kg,
      v_scenario.dangerous_goods_count,
      v_scenario.live_animals_count,
      auth.uid()
    )
    on conflict (session_id) do update
      set event_date = excluded.event_date,
          event_time = excluded.event_time,
          timezone = excluded.timezone,
          location = excluded.location,
          location_lat = excluded.location_lat,
          location_lng = excluded.location_lng,
          weather = excluded.weather,
          situation_type = excluded.situation_type,
          short_description = excluded.short_description,
          injured = excluded.injured,
          fatalities = excluded.fatalities,
          uninjured = excluded.uninjured,
          unknown = excluded.unknown,
          passenger_count = excluded.passenger_count,
          crew_count = excluded.crew_count,
          cargo_weight_kg = excluded.cargo_weight_kg,
          dangerous_goods_count = excluded.dangerous_goods_count,
          live_animals_count = excluded.live_animals_count,
          updated_by = excluded.updated_by,
          updated_at = timezone('utc', now());
  end if;
end;
$$;

grant execute on function public.create_rehearsal_session_from_scenario(uuid, text) to authenticated;
grant execute on function public.create_live_session_from_scenario(uuid, text, integer) to authenticated;
grant execute on function public.restart_session(uuid) to authenticated;
