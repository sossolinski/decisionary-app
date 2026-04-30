alter table public.scenario_injects
  add column if not exists release_offset_minutes integer;

comment on column public.scenario_injects.release_offset_minutes is
  'Minutes from session start when the inject should be released. Null keeps legacy absolute scheduling.';
