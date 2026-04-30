drop policy if exists injects_select_session_access on public.injects;
create policy injects_select_session_access on public.injects
for select
to authenticated
using (
  public.can_facilitate(auth.uid())
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.scenario_injects si
    where si.inject_id = public.injects.id
      and public.can_read_scenario(si.scenario_id, auth.uid())
  )
  or exists (
    select 1
    from public.session_injects si
    where si.inject_id = public.injects.id
      and public.can_access_session(si.session_id, auth.uid())
  )
);
