alter table public.scenarios
  add column if not exists passenger_count integer not null default 0,
  add column if not exists crew_count integer not null default 0,
  add column if not exists cargo_weight_kg integer not null default 0,
  add column if not exists dangerous_goods_count integer not null default 0,
  add column if not exists live_animals_count integer not null default 0;

alter table public.session_situation
  add column if not exists passenger_count integer not null default 0,
  add column if not exists crew_count integer not null default 0,
  add column if not exists cargo_weight_kg integer not null default 0,
  add column if not exists dangerous_goods_count integer not null default 0,
  add column if not exists live_animals_count integer not null default 0;

do $$
begin
  alter table public.scenarios
    add constraint scenarios_passenger_count_nonnegative check (passenger_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.scenarios
    add constraint scenarios_crew_count_nonnegative check (crew_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.scenarios
    add constraint scenarios_cargo_weight_kg_nonnegative check (cargo_weight_kg >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.scenarios
    add constraint scenarios_dangerous_goods_count_nonnegative check (dangerous_goods_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.scenarios
    add constraint scenarios_live_animals_count_nonnegative check (live_animals_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.session_situation
    add constraint session_situation_passenger_count_nonnegative check (passenger_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.session_situation
    add constraint session_situation_crew_count_nonnegative check (crew_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.session_situation
    add constraint session_situation_cargo_weight_kg_nonnegative check (cargo_weight_kg >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.session_situation
    add constraint session_situation_dangerous_goods_count_nonnegative check (dangerous_goods_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.session_situation
    add constraint session_situation_live_animals_count_nonnegative check (live_animals_count >= 0);
exception
  when duplicate_object then null;
end $$;

create or replace function public.update_session_manifest(
  p_session_id uuid,
  p_passenger_count integer,
  p_crew_count integer,
  p_cargo_weight_kg integer default 0,
  p_dangerous_goods_count integer default 0,
  p_live_animals_count integer default 0
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

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  if p_passenger_count < 0
    or p_crew_count < 0
    or p_cargo_weight_kg < 0
    or p_dangerous_goods_count < 0
    or p_live_animals_count < 0
  then
    raise exception 'Manifest counts cannot be negative';
  end if;

  update public.session_situation
  set passenger_count = p_passenger_count,
      crew_count = p_crew_count,
      cargo_weight_kg = p_cargo_weight_kg,
      dangerous_goods_count = p_dangerous_goods_count,
      live_animals_count = p_live_animals_count,
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

grant execute on function public.update_session_manifest(uuid, integer, integer, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
