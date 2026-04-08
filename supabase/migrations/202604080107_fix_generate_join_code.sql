create or replace function public.generate_join_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.sessions where join_code = v_code);
  end loop;
  return v_code;
end;
$$;
