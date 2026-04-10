do $$
begin
  if not exists (select 1 from pg_type where typname = 'inject_kind') then
    create type public.inject_kind as enum ('operational', 'media', 'social', 'intel', 'internal', 'system');
  end if;

  if not exists (select 1 from pg_type where typname = 'inject_source_type') then
    create type public.inject_source_type as enum ('scheduled', 'manual', 'conditional', 'consequence');
  end if;

  if not exists (select 1 from pg_type where typname = 'consequence_severity') then
    create type public.consequence_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

alter table public.injects
  add column if not exists inject_kind public.inject_kind not null default 'operational',
  add column if not exists source_type public.inject_source_type not null default 'manual',
  add column if not exists entity_scope text,
  add column if not exists requires_decision boolean not null default false,
  add column if not exists decision_template_key text,
  add column if not exists visibility_scope text not null default 'all',
  add column if not exists branch_key text;

create table if not exists public.scenario_rule_templates (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  rule_key text not null,
  rule_name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  condition_config jsonb not null default '{}'::jsonb,
  effect_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null,
  unique (scenario_id, rule_key)
);

create table if not exists public.session_consequences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_inject_id uuid references public.session_injects (id) on delete set null,
  decision_id uuid references public.session_decisions (id) on delete set null,
  task_id uuid references public.session_tasks (id) on delete set null,
  rule_template_id uuid references public.scenario_rule_templates (id) on delete set null,
  consequence_type text not null,
  severity public.consequence_severity not null default 'medium',
  title text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null
);

create index if not exists idx_injects_requires_decision on public.injects (requires_decision, inject_kind);
create index if not exists idx_scenario_rule_templates_scenario on public.scenario_rule_templates (scenario_id, enabled);
create index if not exists idx_session_consequences_session on public.session_consequences (session_id, applied_at desc);

drop trigger if exists scenario_rule_templates_set_updated_by on public.scenario_rule_templates;
create trigger scenario_rule_templates_set_updated_by
before update on public.scenario_rule_templates
for each row
execute function public.set_updated_by();

alter table public.scenario_rule_templates enable row level security;
alter table public.session_consequences enable row level security;

drop policy if exists scenario_rule_templates_all on public.scenario_rule_templates;
drop policy if exists scenario_rule_templates_read on public.scenario_rule_templates;
drop policy if exists scenario_rule_templates_write on public.scenario_rule_templates;

create policy scenario_rule_templates_read on public.scenario_rule_templates
for select
to authenticated
using (public.can_read_scenario(scenario_id, auth.uid()));

create policy scenario_rule_templates_write on public.scenario_rule_templates
for all
to authenticated
using (public.can_edit_scenario(scenario_id, auth.uid()))
with check (public.can_edit_scenario(scenario_id, auth.uid()));

drop policy if exists session_consequences_all on public.session_consequences;
create policy session_consequences_all on public.session_consequences
for all
to authenticated
using (public.can_access_session(session_id, auth.uid()))
with check (public.can_access_session(session_id, auth.uid()));
