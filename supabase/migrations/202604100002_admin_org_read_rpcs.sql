create or replace function public.admin_list_org_memberships(p_org_id uuid)
returns setof public.org_memberships
language sql
security definer
set search_path = public
as $$
  select om.*
  from public.org_memberships om
  where public.is_admin(auth.uid())
    and om.org_id = p_org_id
    and om.is_active = true
  order by om.created_at desc;
$$;

create or replace function public.admin_list_facilitator_invites(p_org_id uuid)
returns setof public.facilitator_invites
language sql
security definer
set search_path = public
as $$
  select fi.*
  from public.facilitator_invites fi
  where public.is_admin(auth.uid())
    and fi.org_id = p_org_id
  order by fi.created_at desc;
$$;

create or replace function public.admin_list_managed_participants(p_org_id uuid)
returns setof public.managed_participants
language sql
security definer
set search_path = public
as $$
  select mp.*
  from public.managed_participants mp
  where public.is_admin(auth.uid())
    and mp.org_id = p_org_id
    and mp.active = true
  order by mp.created_at desc;
$$;

grant execute on function public.admin_list_org_memberships(uuid) to authenticated;
grant execute on function public.admin_list_facilitator_invites(uuid) to authenticated;
grant execute on function public.admin_list_managed_participants(uuid) to authenticated;
