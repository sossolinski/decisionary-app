create or replace function public.lookup_join_session(p_code text)
returns table (
  session_id uuid
)
language sql
security definer
set search_path = public
as $$
  select s.id as session_id
  from public.sessions s
  where upper(s.join_code) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.lookup_join_session(text) from public;
revoke execute on function public.lookup_join_session(text) from anon, authenticated;
