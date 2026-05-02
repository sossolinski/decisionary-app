alter table public.sessions
  add column if not exists org_id uuid references public.organizations (id) on delete set null,
  add column if not exists session_mode text not null default 'live' check (session_mode in ('rehearsal', 'live')),
  add column if not exists participant_limit integer check (participant_limit is null or participant_limit > 0),
  add column if not exists source_entitlement_id uuid;

create table if not exists public.org_billing_accounts (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  billing_email text,
  stripe_customer_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'payment_pending', 'paid', 'cancelled', 'failed', 'expired')),
  currency text not null default 'usd',
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  notes text,
  stripe_customer_id text,
  stripe_invoice_id text unique,
  stripe_invoice_url text,
  stripe_payment_intent_id text,
  payment_requested_at timestamptz,
  paid_at timestamptz,
  provisioned_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null
);

create table if not exists public.billing_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.billing_orders (id) on delete cascade,
  item_type text not null check (item_type in ('live_exercise', 'scenario_template', 'custom_scenario_service')),
  scenario_source text check (scenario_source in ('own_scenario', 'template', 'custom_service')),
  title text not null,
  description text,
  participant_limit integer check (participant_limit is null or participant_limit > 0),
  quantity integer not null default 1 check (quantity > 0),
  unit_amount integer not null default 0 check (unit_amount >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  source_order_id uuid references public.billing_orders (id) on delete set null,
  source_order_item_id uuid references public.billing_order_items (id) on delete set null,
  entitlement_type text not null check (entitlement_type in ('live_exercise', 'scenario_template', 'custom_scenario_service')),
  scenario_source text check (scenario_source in ('own_scenario', 'template', 'custom_service')),
  title text not null,
  participant_limit integer check (participant_limit is null or participant_limit > 0),
  quantity integer not null default 1 check (quantity > 0),
  remaining_quantity integer not null default 1 check (remaining_quantity >= 0),
  status text not null default 'active' check (status in ('pending', 'active', 'consumed', 'expired', 'revoked')),
  activate_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  granted_manually boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null,
  check (remaining_quantity <= quantity),
  check (expires_at is null or expires_at > activate_at)
);

create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default timezone('utc', now()),
  payload jsonb
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'sessions_source_entitlement_id_fkey'
      and table_schema = 'public'
      and table_name = 'sessions'
  ) then
    alter table public.sessions
      add constraint sessions_source_entitlement_id_fkey
      foreign key (source_entitlement_id)
      references public.billing_entitlements (id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_sessions_org_id on public.sessions (org_id);
create index if not exists idx_sessions_mode on public.sessions (session_mode);
create index if not exists idx_sessions_source_entitlement_id on public.sessions (source_entitlement_id);
create index if not exists idx_billing_orders_org_id on public.billing_orders (org_id, created_at desc);
create index if not exists idx_billing_order_items_order_id on public.billing_order_items (order_id);
create index if not exists idx_billing_entitlements_org_id on public.billing_entitlements (org_id, status, activate_at desc);
create index if not exists idx_billing_entitlements_source_order_item_id on public.billing_entitlements (source_order_item_id);

alter table public.org_billing_accounts enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_order_items enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;

drop trigger if exists org_billing_accounts_set_updated_by on public.org_billing_accounts;
create trigger org_billing_accounts_set_updated_by
before update on public.org_billing_accounts
for each row
execute function public.set_updated_by();

drop trigger if exists billing_orders_set_updated_by on public.billing_orders;
create trigger billing_orders_set_updated_by
before update on public.billing_orders
for each row
execute function public.set_updated_by();

drop trigger if exists billing_entitlements_set_updated_by on public.billing_entitlements;
create trigger billing_entitlements_set_updated_by
before update on public.billing_entitlements
for each row
execute function public.set_updated_by();

drop policy if exists org_billing_accounts_admin_all on public.org_billing_accounts;
create policy org_billing_accounts_admin_all on public.org_billing_accounts
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists billing_orders_admin_all on public.billing_orders;
create policy billing_orders_admin_all on public.billing_orders
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists billing_order_items_admin_all on public.billing_order_items;
create policy billing_order_items_admin_all on public.billing_order_items
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists billing_entitlements_admin_all on public.billing_entitlements;
create policy billing_entitlements_admin_all on public.billing_entitlements
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists billing_webhook_events_admin_all on public.billing_webhook_events;
create policy billing_webhook_events_admin_all on public.billing_webhook_events
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create or replace function public.user_belongs_to_org(p_org_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_org_id
      and o.archived = false
      and (
        public.is_admin(p_user_id)
        or exists (
          select 1
          from public.org_memberships om
          where om.org_id = o.id
            and om.user_id = p_user_id
            and om.is_active = true
        )
      )
  );
$$;

create or replace function public.get_my_active_org_required()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select public.get_my_active_org_id() into v_org_id;
  if v_org_id is null then
    raise exception 'Select an active organization before creating a session';
  end if;
  return v_org_id;
end;
$$;

create or replace function public.list_my_live_exercise_access()
returns table (
  entitlement_id uuid,
  org_id uuid,
  title text,
  participant_limit integer,
  remaining_quantity integer,
  expires_at timestamptz,
  status text
)
language sql
security definer
set search_path = public
as $$
  with my_org as (
    select public.get_my_active_org_id() as org_id
  )
  select
    be.id as entitlement_id,
    be.org_id,
    be.title,
    be.participant_limit,
    be.remaining_quantity,
    be.expires_at,
    be.status
  from public.billing_entitlements be
  cross join my_org
  where my_org.org_id is not null
    and be.org_id = my_org.org_id
    and be.entitlement_type = 'live_exercise'
    and be.status in ('active', 'consumed')
    and be.activate_at <= timezone('utc', now())
    and (be.expires_at is null or be.expires_at > timezone('utc', now()))
  order by be.participant_limit asc, be.created_at asc;
$$;

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

create or replace function public.create_session_from_scenario(p_scenario_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_rehearsal_session_from_scenario(p_scenario_id, p_title);
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
  v_mode text;
  v_limit integer;
  v_existing boolean;
  v_count integer;
begin
  if v_uid is null or v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_actor) then
    raise exception 'Session not accessible';
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
  values (p_session_id, v_uid, p_role_key)
  on conflict (session_id, user_id, role_key) do update
    set assigned_at = timezone('utc', now());
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
  v_mode text;
  v_limit integer;
  v_existing boolean;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.id, s.session_mode, s.participant_limit
  into v_session_id, v_mode, v_limit
  from public.sessions s
  where upper(s.join_code) = upper(trim(p_code))
  limit 1;

  if v_session_id is null then
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
      raise exception 'Rehearsal mode is limited to the creator only';
    end if;

    if v_mode = 'live' and v_limit is not null and v_count >= v_limit then
      raise exception 'Participant limit reached for this live exercise';
    end if;
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

create or replace function public.admin_upsert_org_billing_account(
  p_org_id uuid,
  p_billing_email text default null
)
returns public.org_billing_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.org_billing_accounts;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can manage billing accounts';
  end if;

  insert into public.org_billing_accounts (org_id, billing_email, updated_by)
  values (p_org_id, nullif(trim(coalesce(p_billing_email, '')), ''), v_uid)
  on conflict (org_id) do update
    set billing_email = excluded.billing_email,
        updated_by = v_uid,
        updated_at = timezone('utc', now())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_get_org_billing_account(p_org_id uuid)
returns public.org_billing_accounts
language sql
security definer
set search_path = public
as $$
  select oba.*
  from public.org_billing_accounts oba
  where public.is_admin(auth.uid())
    and oba.org_id = p_org_id
  limit 1;
$$;

create or replace function public.admin_create_billing_order(
  p_org_id uuid,
  p_currency text default 'usd',
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.billing_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.billing_orders;
  v_item jsonb;
  v_title text;
  v_item_type text;
  v_scenario_source text;
  v_quantity integer;
  v_unit_amount integer;
  v_participant_limit integer;
  v_subtotal integer := 0;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can create billing orders';
  end if;

  if p_org_id is null then
    raise exception 'Organization is required';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'At least one billing item is required';
  end if;

  insert into public.billing_orders (org_id, currency, notes, created_by, updated_by)
  values (p_org_id, lower(trim(coalesce(p_currency, 'usd'))), nullif(trim(coalesce(p_notes, '')), ''), v_uid, v_uid)
  returning * into v_order;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_item_type := lower(trim(coalesce(v_item->>'item_type', '')));
    v_scenario_source := nullif(lower(trim(coalesce(v_item->>'scenario_source', ''))), '');
    v_title := nullif(trim(coalesce(v_item->>'title', '')), '');
    v_quantity := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    v_unit_amount := greatest(coalesce((v_item->>'unit_amount')::integer, 0), 0);
    v_participant_limit := nullif(coalesce(v_item->>'participant_limit', ''), '')::integer;

    if v_item_type not in ('live_exercise', 'scenario_template', 'custom_scenario_service') then
      raise exception 'Invalid billing item type';
    end if;

    if v_scenario_source is not null and v_scenario_source not in ('own_scenario', 'template', 'custom_service') then
      raise exception 'Invalid scenario source';
    end if;

    if v_title is null then
      raise exception 'Billing item title is required';
    end if;

    if v_item_type = 'live_exercise' and coalesce(v_participant_limit, 0) <= 0 then
      raise exception 'Live exercise items require participant_limit';
    end if;

    insert into public.billing_order_items (
      order_id,
      item_type,
      scenario_source,
      title,
      description,
      participant_limit,
      quantity,
      unit_amount,
      metadata
    )
    values (
      v_order.id,
      v_item_type,
      v_scenario_source,
      v_title,
      nullif(trim(coalesce(v_item->>'description', '')), ''),
      v_participant_limit,
      v_quantity,
      v_unit_amount,
      coalesce(v_item->'metadata', '{}'::jsonb)
    );

    v_subtotal := v_subtotal + (v_quantity * v_unit_amount);
  end loop;

  update public.billing_orders
  set subtotal_amount = v_subtotal,
      total_amount = v_subtotal,
      updated_by = v_uid,
      updated_at = timezone('utc', now())
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.admin_manual_grant_billing_entitlement(
  p_org_id uuid,
  p_entitlement_type text,
  p_title text,
  p_participant_limit integer default null,
  p_quantity integer default 1,
  p_scenario_source text default null,
  p_expires_at timestamptz default null
)
returns public.billing_entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_entitlement_type, '')));
  v_source text := nullif(lower(trim(coalesce(p_scenario_source, ''))), '');
  v_row public.billing_entitlements;
  v_qty integer := greatest(coalesce(p_quantity, 1), 1);
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can grant entitlements';
  end if;

  if p_org_id is null then
    raise exception 'Organization is required';
  end if;

  if v_type not in ('live_exercise', 'scenario_template', 'custom_scenario_service') then
    raise exception 'Invalid entitlement type';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Title is required';
  end if;

  if v_source is not null and v_source not in ('own_scenario', 'template', 'custom_service') then
    raise exception 'Invalid scenario source';
  end if;

  if v_type = 'live_exercise' and coalesce(p_participant_limit, 0) <= 0 then
    raise exception 'Live exercise entitlements require participant_limit';
  end if;

  insert into public.billing_entitlements (
    org_id,
    entitlement_type,
    scenario_source,
    title,
    participant_limit,
    quantity,
    remaining_quantity,
    status,
    activate_at,
    expires_at,
    granted_manually,
    created_by,
    updated_by
  )
  values (
    p_org_id,
    v_type,
    v_source,
    trim(p_title),
    p_participant_limit,
    v_qty,
    v_qty,
    'active',
    timezone('utc', now()),
    p_expires_at,
    true,
    v_uid,
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_list_billing_orders(p_org_id uuid default null)
returns setof public.billing_orders
language sql
security definer
set search_path = public
as $$
  select bo.*
  from public.billing_orders bo
  where public.is_admin(auth.uid())
    and (p_org_id is null or bo.org_id = p_org_id)
  order by bo.created_at desc;
$$;

create or replace function public.admin_list_billing_order_items(p_order_id uuid)
returns setof public.billing_order_items
language sql
security definer
set search_path = public
as $$
  select boi.*
  from public.billing_order_items boi
  join public.billing_orders bo on bo.id = boi.order_id
  where public.is_admin(auth.uid())
    and boi.order_id = p_order_id
  order by boi.created_at asc;
$$;

create or replace function public.admin_list_billing_entitlements(p_org_id uuid default null)
returns setof public.billing_entitlements
language sql
security definer
set search_path = public
as $$
  select be.*
  from public.billing_entitlements be
  where public.is_admin(auth.uid())
    and (p_org_id is null or be.org_id = p_org_id)
  order by be.created_at desc;
$$;

grant execute on function public.user_belongs_to_org(uuid, uuid) to authenticated;
grant execute on function public.get_my_active_org_required() to authenticated;
grant execute on function public.list_my_live_exercise_access() to authenticated;
grant execute on function public.create_rehearsal_session_from_scenario(uuid, text) to authenticated;
grant execute on function public.create_live_session_from_scenario(uuid, text, integer) to authenticated;
grant execute on function public.create_session_from_scenario(uuid, text) to authenticated;
grant execute on function public.grant_session_role(uuid, text, uuid) to authenticated;
grant execute on function public.join_session(text) to authenticated;
grant execute on function public.admin_upsert_org_billing_account(uuid, text) to authenticated;
grant execute on function public.admin_get_org_billing_account(uuid) to authenticated;
grant execute on function public.admin_create_billing_order(uuid, text, text, jsonb) to authenticated;
grant execute on function public.admin_manual_grant_billing_entitlement(uuid, text, text, integer, integer, text, timestamptz) to authenticated;
grant execute on function public.admin_list_billing_orders(uuid) to authenticated;
grant execute on function public.admin_list_billing_order_items(uuid) to authenticated;
grant execute on function public.admin_list_billing_entitlements(uuid) to authenticated;
