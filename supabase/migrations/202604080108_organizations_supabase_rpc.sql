create or replace function public.generate_facilitator_invite_token()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_token text;
begin
  loop
    v_token := md5(random()::text || clock_timestamp()::text || coalesce(auth.uid()::text, 'anon'));
    exit when not exists (select 1 from public.facilitator_invites where token = v_token);
  end loop;
  return v_token;
end;
$$;

create or replace function public.generate_participant_join_code(p_org_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_org_id::text), 1, 6));
    exit when not exists (
      select 1
      from public.managed_participants mp
      where mp.org_id = p_org_id
        and mp.join_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

create or replace function public.set_my_active_org(p_org_id uuid)
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

  if p_org_id is not null and not exists (
    select 1
    from public.organizations o
    where o.id = p_org_id
      and o.archived = false
      and (
        public.is_admin(v_uid)
        or exists (
          select 1
          from public.org_memberships om
          where om.org_id = o.id
            and om.user_id = v_uid
            and om.is_active = true
        )
      )
  ) then
    raise exception 'Organization not accessible';
  end if;

  insert into public.user_org_settings (user_id, active_org_id)
  values (v_uid, p_org_id)
  on conflict (user_id) do update
    set active_org_id = excluded.active_org_id,
        updated_at = timezone('utc', now());
end;
$$;

create or replace function public.admin_create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_slug text;
  v_base_slug text;
  v_idx integer := 2;
  v_org public.organizations;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can create organizations';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Organization name is required';
  end if;

  select p.email into v_email
  from public.profiles p
  where p.user_id = v_uid;

  v_base_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');
  if coalesce(v_base_slug, '') = '' then
    v_base_slug := 'organization';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_idx::text;
    v_idx := v_idx + 1;
  end loop;

  insert into public.organizations (name, slug, created_by, archived)
  values (trim(p_name), v_slug, v_uid, false)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, email, role, created_by, is_active)
  values (v_org.id, v_uid, lower(v_email), 'admin', v_uid, true)
  on conflict (org_id, user_id) do update
    set email = excluded.email,
        role = 'admin',
        is_active = true;

  insert into public.user_org_settings (user_id, active_org_id)
  values (v_uid, v_org.id)
  on conflict (user_id) do update
    set active_org_id = excluded.active_org_id,
        updated_at = timezone('utc', now());

  return v_org;
end;
$$;

create or replace function public.admin_delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can delete organizations';
  end if;

  if not exists (
    select 1 from public.organizations o where o.id = p_org_id and o.archived = false
  ) then
    raise exception 'Organization not found';
  end if;

  if (select count(*) from public.organizations where archived = false) <= 1 then
    raise exception 'You must keep at least one organization';
  end if;

  delete from public.organizations where id = p_org_id;
end;
$$;

create or replace function public.admin_add_org_membership(
  p_org_id uuid,
  p_email text,
  p_role public.app_role
)
returns public.org_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_profile_id uuid;
  v_membership public.org_memberships;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can add memberships';
  end if;

  if v_email = '' then
    raise exception 'Email is required';
  end if;

  select p.user_id into v_profile_id
  from public.profiles p
  where lower(coalesce(p.email, '')) = v_email
  limit 1;

  update public.org_memberships om
  set user_id = coalesce(v_profile_id, om.user_id),
      email = v_email,
      role = p_role,
      is_active = true
  where om.org_id = p_org_id
    and (
      om.user_id = v_profile_id
      or lower(coalesce(om.email, '')) = v_email
    )
  returning * into v_membership;

  if v_membership.id is null then
    insert into public.org_memberships (org_id, user_id, email, role, created_by, is_active)
    values (p_org_id, v_profile_id, v_email, p_role, v_uid, true)
    returning * into v_membership;
  end if;

  return v_membership;
end;
$$;

create or replace function public.admin_remove_org_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can remove memberships';
  end if;

  delete from public.org_memberships
  where id = p_membership_id;
end;
$$;

create or replace function public.admin_create_facilitator_invite(
  p_org_id uuid,
  p_email text,
  p_ttl_days integer default 14
)
returns public.facilitator_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite public.facilitator_invites;
  v_ttl integer := greatest(coalesce(p_ttl_days, 14), 1);
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can create facilitator invites';
  end if;

  if v_email = '' then
    raise exception 'Email is required';
  end if;

  insert into public.facilitator_invites (
    org_id,
    email,
    token,
    status,
    created_by,
    expires_at
  )
  values (
    p_org_id,
    v_email,
    public.generate_facilitator_invite_token(),
    'pending',
    v_uid,
    timezone('utc', now()) + make_interval(days => v_ttl)
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.admin_revoke_facilitator_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can revoke facilitator invites';
  end if;

  update public.facilitator_invites
  set status = 'revoked'
  where id = p_invite_id
    and status = 'pending';
end;
$$;

create or replace function public.create_managed_participant(
  p_org_id uuid,
  p_display_name text,
  p_email text default null
)
returns public.managed_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_participant public.managed_participants;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not (public.is_admin(v_uid) or public.can_facilitate(v_uid)) then
    raise exception 'Not allowed to manage participants';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required';
  end if;

  insert into public.managed_participants (
    org_id,
    display_name,
    email,
    join_code,
    created_by,
    active
  )
  values (
    p_org_id,
    trim(p_display_name),
    v_email,
    public.generate_participant_join_code(p_org_id),
    v_uid,
    true
  )
  returning * into v_participant;

  return v_participant;
end;
$$;

create or replace function public.deactivate_managed_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not (public.is_admin(v_uid) or public.can_facilitate(v_uid)) then
    raise exception 'Not allowed to manage participants';
  end if;

  update public.managed_participants
  set active = false
  where id = p_participant_id;
end;
$$;

create or replace function public.get_facilitator_invite_by_token(p_token text)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  email text,
  token text,
  status public.facilitator_invite_status,
  created_at timestamptz,
  created_by uuid,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    fi.id,
    fi.org_id,
    o.name,
    o.slug,
    fi.email,
    fi.token,
    fi.status,
    fi.created_at,
    fi.created_by,
    fi.expires_at,
    fi.accepted_at,
    fi.accepted_user_id
  from public.facilitator_invites fi
  join public.organizations o on o.id = fi.org_id
  where fi.token = trim(p_token)
  limit 1;
end;
$$;

create or replace function public.accept_facilitator_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.facilitator_invites;
  v_existing_active_org uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(lower(trim(coalesce(v_email, ''))), '') is null then
    raise exception 'Authenticated user email missing';
  end if;

  select *
  into v_invite
  from public.facilitator_invites fi
  where fi.token = trim(p_token)
  limit 1;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite status is %', v_invite.status;
  end if;

  if v_invite.expires_at < timezone('utc', now()) then
    update public.facilitator_invites
    set status = 'expired'
    where id = v_invite.id;
    raise exception 'Invite expired';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'Signed-in email does not match invited email';
  end if;

  update public.facilitator_invites
  set status = 'accepted',
      accepted_at = timezone('utc', now()),
      accepted_user_id = v_uid
  where id = v_invite.id;

  update public.org_memberships om
  set user_id = v_uid,
      email = lower(v_email),
      role = 'facilitator',
      is_active = true
  where om.org_id = v_invite.org_id
    and (
      om.user_id = v_uid
      or lower(coalesce(om.email, '')) = lower(v_email)
    );

  if not exists (
    select 1
    from public.org_memberships om
    where om.org_id = v_invite.org_id
      and om.user_id = v_uid
  ) then
    insert into public.org_memberships (org_id, user_id, email, role, created_by, is_active)
    values (v_invite.org_id, v_uid, lower(v_email), 'facilitator', v_invite.created_by, true);
  end if;

  select uos.active_org_id into v_existing_active_org
  from public.user_org_settings uos
  where uos.user_id = v_uid;

  insert into public.user_org_settings (user_id, active_org_id)
  values (v_uid, coalesce(v_existing_active_org, v_invite.org_id))
  on conflict (user_id) do update
    set active_org_id = coalesce(public.user_org_settings.active_org_id, excluded.active_org_id),
        updated_at = timezone('utc', now());
end;
$$;

grant execute on function public.set_my_active_org(uuid) to authenticated;
grant execute on function public.admin_create_organization(text) to authenticated;
grant execute on function public.admin_delete_organization(uuid) to authenticated;
grant execute on function public.admin_add_org_membership(uuid, text, public.app_role) to authenticated;
grant execute on function public.admin_remove_org_membership(uuid) to authenticated;
grant execute on function public.admin_create_facilitator_invite(uuid, text, integer) to authenticated;
grant execute on function public.admin_revoke_facilitator_invite(uuid) to authenticated;
grant execute on function public.create_managed_participant(uuid, text, text) to authenticated;
grant execute on function public.deactivate_managed_participant(uuid) to authenticated;
grant execute on function public.get_facilitator_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_facilitator_invite(text) to authenticated;
