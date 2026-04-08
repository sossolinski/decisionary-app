insert into public.organizations (name, slug, archived)
values ('Decisionary Demo', 'decisionary-demo', false)
on conflict (slug) do nothing;

do $$
declare
  v_admin uuid;
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where slug = 'decisionary-demo'
  limit 1;

  select user_id into v_admin
  from public.profiles
  order by created_at asc
  limit 1;

  if v_admin is not null and v_org is not null then
    update public.profiles
    set role = 'admin',
        active_role = 'admin'
    where user_id = v_admin;

    insert into public.org_memberships (org_id, user_id, email, role, created_by)
    select v_org, p.user_id, lower(p.email), 'admin', v_admin
    from public.profiles p
    where p.user_id = v_admin
    on conflict (org_id, user_id) do update
      set role = excluded.role,
          is_active = true;

    insert into public.user_org_settings (user_id, active_org_id, active_role)
    values (v_admin, v_org, 'admin')
    on conflict (user_id) do update
      set active_org_id = excluded.active_org_id,
          active_role = excluded.active_role;
  end if;
end $$;
