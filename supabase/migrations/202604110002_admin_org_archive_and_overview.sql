create or replace function public.admin_list_all_organizations()
returns setof public.organizations
language sql
security definer
set search_path = public
as $$
  select o.*
  from public.organizations o
  where public.is_admin(auth.uid())
  order by
    case when o.archived then 1 else 0 end,
    o.created_at desc;
$$;

create or replace function public.admin_archive_organization(p_org_id uuid)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org public.organizations;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can archive organizations';
  end if;

  select *
  into v_org
  from public.organizations
  where id = p_org_id
    and archived = false;

  if v_org.id is null then
    raise exception 'Organization not found';
  end if;

  if (select count(*) from public.organizations where archived = false) <= 1 then
    raise exception 'You must keep at least one active organization';
  end if;

  update public.organizations
  set archived = true
  where id = p_org_id
  returning * into v_org;

  update public.user_org_settings
  set active_org_id = null,
      updated_at = timezone('utc', now())
  where active_org_id = p_org_id;

  return v_org;
end;
$$;

create or replace function public.admin_restore_organization(p_org_id uuid)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org public.organizations;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can restore organizations';
  end if;

  update public.organizations
  set archived = false
  where id = p_org_id
    and archived = true
  returning * into v_org;

  if v_org.id is null then
    raise exception 'Organization not found';
  end if;

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
    select 1 from public.organizations o where o.id = p_org_id and o.archived = true
  ) then
    raise exception 'Archive the organization before deleting it permanently';
  end if;

  delete from public.organizations where id = p_org_id;
end;
$$;

grant execute on function public.admin_list_all_organizations() to authenticated;
grant execute on function public.admin_archive_organization(uuid) to authenticated;
grant execute on function public.admin_restore_organization(uuid) to authenticated;
grant execute on function public.admin_delete_organization(uuid) to authenticated;
