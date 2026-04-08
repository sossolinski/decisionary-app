create or replace function public.list_my_organizations()
returns setof public.organizations
language sql
security definer
set search_path = public
as $$
  select o.*
  from public.organizations o
  where o.archived = false
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1
        from public.org_memberships om
        where om.org_id = o.id
          and om.user_id = auth.uid()
          and om.is_active = true
      )
    )
  order by o.created_at asc;
$$;

create or replace function public.get_my_active_org_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select uos.active_org_id
  from public.user_org_settings uos
  where uos.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.list_my_organizations() to authenticated;
grant execute on function public.get_my_active_org_id() to authenticated;
