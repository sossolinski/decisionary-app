create or replace function public.evaluate_session_rules(
  p_session_id uuid,
  p_event_type text,
  p_session_inject_id uuid default null,
  p_decision_id uuid default null,
  p_action_id uuid default null,
  p_source text default null,
  p_task_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_scenario_id uuid;
  v_session_status public.session_status;
  v_created_consequences integer := 0;
  v_created_tasks integer := 0;
  v_created_injects integer := 0;
  v_rule_created_consequences integer;
  v_rule_created_tasks integer;
  v_rule_created_injects integer;
  v_skip_reason text;
  v_session_inject public.session_injects;
  v_inject public.injects;
  v_decision public.session_decisions;
  v_action public.session_actions;
  v_task public.session_tasks;
  v_rule public.scenario_rule_templates;
  v_trigger jsonb;
  v_condition jsonb;
  v_effect jsonb;
  v_payload jsonb;
  v_context jsonb;
  v_existing_consequence public.session_consequences;
  v_existing_task public.session_tasks;
  v_consequence_type text;
  v_consequence_title text;
  v_consequence_description text;
  v_consequence_severity public.consequence_severity;
  v_task_title text;
  v_task_description text;
  v_due_in_minutes numeric;
  v_due_at timestamptz;
  v_new_inject_id uuid;
  v_send_inject jsonb;
  v_create_task jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  select scenario_id, status
  into v_scenario_id, v_session_status
  from public.sessions
  where id = p_session_id;

  if v_scenario_id is null or v_session_status is distinct from 'live'::public.session_status then
    return jsonb_build_object(
      'created_consequences', 0,
      'created_tasks', 0,
      'created_injects', 0
    );
  end if;

  if p_session_inject_id is not null then
    select *
    into v_session_inject
    from public.session_injects
    where id = p_session_inject_id
      and session_id = p_session_id;

    if v_session_inject.id is not null then
      select *
      into v_inject
      from public.injects
      where id = v_session_inject.inject_id;
    end if;
  end if;

  if p_decision_id is not null then
    select *
    into v_decision
    from public.session_decisions
    where id = p_decision_id
      and session_id = p_session_id;
  end if;

  if p_action_id is not null then
    select *
    into v_action
    from public.session_actions
    where id = p_action_id
      and session_id = p_session_id;
  end if;

  if p_task_id is not null then
    select *
    into v_task
    from public.session_tasks
    where id = p_task_id
      and session_id = p_session_id;
  end if;

  v_context := jsonb_build_object(
    'event_type', p_event_type,
    'session_id', p_session_id::text,
    'session_inject_id', coalesce(v_session_inject.id::text, ''),
    'inject_id', coalesce(v_inject.id::text, ''),
    'inject_title', coalesce(v_inject.title, ''),
    'inject_body', coalesce(v_inject.body, ''),
    'inject_kind', coalesce(v_inject.inject_kind::text, ''),
    'channel', coalesce(v_inject.channel, ''),
    'severity', coalesce(v_inject.severity, ''),
    'entity_scope', coalesce(v_inject.entity_scope, ''),
    'branch_key', coalesce(v_inject.branch_key, ''),
    'decision_template_key', coalesce(v_inject.decision_template_key, ''),
    'decision_id', coalesce(v_decision.id::text, ''),
    'decision_type', coalesce(v_decision.decision_type::text, ''),
    'decision_rationale', coalesce(v_decision.rationale, ''),
    'action_id', coalesce(v_action.id::text, ''),
    'action_type', coalesce(v_action.action_type, ''),
    'action_comment', coalesce(v_action.comment, ''),
    'source', coalesce(p_source, ''),
    'task_id', coalesce(v_task.id::text, ''),
    'task_title', coalesce(v_task.title, ''),
    'task_description', coalesce(v_task.description, ''),
    'task_priority', coalesce(v_task.priority::text, ''),
    'task_status', coalesce(v_task.status::text, ''),
    'task_due_at', coalesce(v_task.due_at::text, ''),
    'task_started_at', coalesce(v_task.started_at::text, ''),
    'task_resolved_at', coalesce(v_task.resolved_at::text, ''),
    'task_assigned_role', coalesce(v_task.assigned_role, '')
  );

  for v_rule in
    select *
    from public.scenario_rule_templates
    where scenario_id = v_scenario_id
      and enabled = true
      and trigger_type = p_event_type
    order by created_at asc
  loop
    v_trigger := coalesce(v_rule.trigger_config, '{}'::jsonb);
    v_condition := coalesce(v_rule.condition_config, '{}'::jsonb);
    v_effect := coalesce(v_rule.effect_config, '{}'::jsonb);
    v_rule_created_consequences := 0;
    v_rule_created_tasks := 0;
    v_rule_created_injects := 0;
    v_skip_reason := null;

    if v_trigger ? 'inject_kind'
      and coalesce(v_inject.inject_kind::text, '') <> coalesce(v_trigger->>'inject_kind', '') then
      v_skip_reason := 'trigger.inject_kind';
    elsif v_trigger ? 'channel'
      and coalesce(v_inject.channel, '') <> coalesce(v_trigger->>'channel', '') then
      v_skip_reason := 'trigger.channel';
    elsif v_trigger ? 'severity'
      and coalesce(v_inject.severity, '') <> coalesce(v_trigger->>'severity', '') then
      v_skip_reason := 'trigger.severity';
    elsif v_trigger ? 'source_type'
      and coalesce(v_inject.source_type::text, '') <> coalesce(v_trigger->>'source_type', '') then
      v_skip_reason := 'trigger.source_type';
    elsif v_trigger ? 'entity_scope'
      and coalesce(v_inject.entity_scope, '') <> coalesce(v_trigger->>'entity_scope', '') then
      v_skip_reason := 'trigger.entity_scope';
    elsif v_trigger ? 'branch_key'
      and coalesce(v_inject.branch_key, '') <> coalesce(v_trigger->>'branch_key', '') then
      v_skip_reason := 'trigger.branch_key';
    elsif v_trigger ? 'decision_template_key'
      and coalesce(v_inject.decision_template_key, '') <> coalesce(v_trigger->>'decision_template_key', '') then
      v_skip_reason := 'trigger.decision_template_key';
    elsif v_trigger ? 'visibility_scope'
      and coalesce(v_inject.visibility_scope, '') <> coalesce(v_trigger->>'visibility_scope', '') then
      v_skip_reason := 'trigger.visibility_scope';
    elsif v_trigger ? 'requires_decision'
      and coalesce(v_inject.requires_decision, false) is distinct from coalesce((v_trigger->>'requires_decision')::boolean, false) then
      v_skip_reason := 'trigger.requires_decision';
    end if;

    if v_skip_reason is null and p_event_type = 'decision_recorded' then
      if v_decision.id is null then
        v_skip_reason := 'decision.missing';
      elsif v_trigger ? 'decision_type'
        and coalesce(v_decision.decision_type::text, '') <> coalesce(v_trigger->>'decision_type', '') then
        v_skip_reason := 'trigger.decision_type';
      elsif v_trigger ? 'source'
        and coalesce(p_source, '') <> coalesce(v_trigger->>'source', '') then
        v_skip_reason := 'trigger.source';
      elsif v_trigger ? 'action_type'
        and coalesce(v_action.action_type, '') <> coalesce(v_trigger->>'action_type', '') then
        v_skip_reason := 'trigger.action_type';
      end if;
    end if;

    if v_skip_reason is null and p_event_type in ('task_overdue', 'task_status_changed') then
      if v_task.id is null then
        v_skip_reason := 'task.missing';
      elsif v_trigger ? 'task_priority'
        and coalesce(v_task.priority::text, '') <> coalesce(v_trigger->>'task_priority', '') then
        v_skip_reason := 'trigger.task_priority';
      elsif v_trigger ? 'task_status'
        and coalesce(v_task.status::text, '') <> coalesce(v_trigger->>'task_status', '') then
        v_skip_reason := 'trigger.task_status';
      elsif v_trigger ? 'assigned_role'
        and coalesce(v_task.assigned_role, '') <> coalesce(v_trigger->>'assigned_role', '') then
        v_skip_reason := 'trigger.assigned_role';
      end if;
    end if;

    if v_skip_reason is null and v_condition ? 'severity'
      and coalesce(v_inject.severity, '') <> coalesce(v_condition->>'severity', '') then
      v_skip_reason := 'condition.severity';
    elsif v_skip_reason is null and v_condition ? 'decision_required'
      and coalesce(v_inject.requires_decision, false) is distinct from coalesce((v_condition->>'decision_required')::boolean, false) then
      v_skip_reason := 'condition.decision_required';
    elsif v_skip_reason is null and p_event_type = 'decision_recorded'
      and v_condition ? 'decision_type'
      and coalesce(v_decision.decision_type::text, '') <> coalesce(v_condition->>'decision_type', '') then
      v_skip_reason := 'condition.decision_type';
    elsif v_skip_reason is null and p_event_type = 'decision_recorded'
      and v_condition ? 'source'
      and coalesce(p_source, '') <> coalesce(v_condition->>'source', '') then
      v_skip_reason := 'condition.source';
    elsif v_skip_reason is null and p_event_type in ('task_overdue', 'task_status_changed')
      and v_condition ? 'task_status'
      and coalesce(v_task.status::text, '') <> coalesce(v_condition->>'task_status', '') then
      v_skip_reason := 'condition.task_status';
    elsif v_skip_reason is null and p_event_type in ('task_overdue', 'task_status_changed')
      and v_condition ? 'task_priority'
      and coalesce(v_task.priority::text, '') <> coalesce(v_condition->>'task_priority', '') then
      v_skip_reason := 'condition.task_priority';
    elsif v_skip_reason is null and p_event_type in ('task_overdue', 'task_status_changed')
      and v_condition ? 'assigned_role'
      and coalesce(v_task.assigned_role, '') <> coalesce(v_condition->>'assigned_role', '') then
      v_skip_reason := 'condition.assigned_role';
    elsif v_skip_reason is null and v_condition ? 'title_includes'
      and position(lower(coalesce(v_condition->>'title_includes', '')) in lower(coalesce(v_inject.title, ''))) = 0 then
      v_skip_reason := 'condition.title_includes';
    elsif v_skip_reason is null and v_condition ? 'title_excludes'
      and position(lower(coalesce(v_condition->>'title_excludes', '')) in lower(coalesce(v_inject.title, ''))) > 0 then
      v_skip_reason := 'condition.title_excludes';
    elsif v_skip_reason is null and v_condition ? 'body_includes'
      and position(lower(coalesce(v_condition->>'body_includes', '')) in lower(coalesce(v_inject.body, ''))) = 0 then
      v_skip_reason := 'condition.body_includes';
    elsif v_skip_reason is null and v_condition ? 'body_excludes'
      and position(lower(coalesce(v_condition->>'body_excludes', '')) in lower(coalesce(v_inject.body, ''))) > 0 then
      v_skip_reason := 'condition.body_excludes';
    elsif v_skip_reason is null and v_condition ? 'comment_includes'
      and position(lower(coalesce(v_condition->>'comment_includes', '')) in lower(coalesce(v_action.comment, ''))) = 0 then
      v_skip_reason := 'condition.comment_includes';
    elsif v_skip_reason is null and v_condition ? 'comment_excludes'
      and position(lower(coalesce(v_condition->>'comment_excludes', '')) in lower(coalesce(v_action.comment, ''))) > 0 then
      v_skip_reason := 'condition.comment_excludes';
    elsif v_skip_reason is null and v_condition ? 'task_title_includes'
      and position(lower(coalesce(v_condition->>'task_title_includes', '')) in lower(coalesce(v_task.title, ''))) = 0 then
      v_skip_reason := 'condition.task_title_includes';
    elsif v_skip_reason is null and v_condition ? 'task_title_excludes'
      and position(lower(coalesce(v_condition->>'task_title_excludes', '')) in lower(coalesce(v_task.title, ''))) > 0 then
      v_skip_reason := 'condition.task_title_excludes';
    end if;

    if v_skip_reason is null
      and (p_session_inject_id is not null or p_decision_id is not null or p_action_id is not null or p_task_id is not null)
      and exists (
        select 1
        from public.session_rule_evaluations e
        where e.session_id = p_session_id
          and e.rule_template_id = v_rule.id
          and e.event_type = p_event_type
          and e.matched = true
          and e.session_inject_id is not distinct from p_session_inject_id
          and e.decision_id is not distinct from p_decision_id
          and e.action_id is not distinct from p_action_id
          and e.task_id is not distinct from p_task_id
      ) then
      v_skip_reason := 'duplicate.event';
    end if;

    if v_skip_reason is not null then
      perform public.log_session_rule_evaluation(
        p_session_id,
        v_rule.id,
        p_event_type,
        false,
        v_skip_reason,
        p_session_inject_id,
        p_decision_id,
        p_action_id,
        p_task_id,
        0,
        0,
        0,
        v_context
      );
      continue;
    end if;

    v_consequence_type := nullif(trim(coalesce(v_effect->>'consequence_type', '')), '');
    if v_consequence_type is null then
      v_consequence_type := p_event_type;
    end if;

    v_consequence_title := nullif(trim(public.interpolate_runtime_template(v_effect->>'title', v_context)), '');
    if v_consequence_title is null then
      v_consequence_title := v_rule.rule_name;
    end if;

    v_consequence_description := nullif(trim(public.interpolate_runtime_template(v_effect->>'description', v_context)), '');
    if v_consequence_description is null then
      v_consequence_description := v_rule.description;
    end if;

    v_consequence_severity := case
      when v_effect->>'severity' in ('low', 'medium', 'high', 'critical')
        then (v_effect->>'severity')::public.consequence_severity
      when coalesce(v_inject.severity, '') in ('low', 'medium', 'high', 'critical')
        then v_inject.severity::public.consequence_severity
      else 'medium'::public.consequence_severity
    end;

    select *
    into v_existing_consequence
    from public.session_consequences
    where session_id = p_session_id
      and consequence_type = v_consequence_type
      and title = v_consequence_title
      and rule_template_id = v_rule.id
      and session_inject_id is not distinct from p_session_inject_id
      and decision_id is not distinct from p_decision_id
      and task_id is not distinct from p_task_id
    limit 1;

    if v_existing_consequence.id is not null then
      perform public.log_session_rule_evaluation(
        p_session_id,
        v_rule.id,
        p_event_type,
        false,
        'duplicate.consequence',
        p_session_inject_id,
        p_decision_id,
        p_action_id,
        p_task_id,
        0,
        0,
        0,
        v_context
      );
      continue;
    end if;

    v_payload := coalesce(v_effect->'payload', '{}'::jsonb) || jsonb_build_object(
      'trigger_type', p_event_type,
      'inject_kind', coalesce(v_inject.inject_kind::text, null),
      'channel', coalesce(v_inject.channel, null),
      'decision_type', coalesce(v_decision.decision_type::text, null),
      'task_status', coalesce(v_task.status::text, null),
      'task_priority', coalesce(v_task.priority::text, null)
    );

    insert into public.session_consequences (
      session_id,
      session_inject_id,
      decision_id,
      task_id,
      rule_template_id,
      consequence_type,
      severity,
      title,
      description,
      payload,
      created_by
    )
    values (
      p_session_id,
      p_session_inject_id,
      p_decision_id,
      p_task_id,
      v_rule.id,
      v_consequence_type,
      v_consequence_severity,
      v_consequence_title,
      v_consequence_description,
      coalesce(v_payload, '{}'::jsonb),
      v_uid
    );

    v_created_consequences := v_created_consequences + 1;
    v_rule_created_consequences := v_rule_created_consequences + 1;

    v_create_task := coalesce(v_effect->'create_task', '{}'::jsonb);
    if jsonb_typeof(v_create_task) = 'object' and jsonb_object_length(v_create_task) > 0 then
      v_task_title := nullif(trim(public.interpolate_runtime_template(v_create_task->>'title', v_context)), '');
      if v_task_title is null then
        v_task_title := 'Follow-up: ' || v_consequence_title;
      end if;

      v_task_description := nullif(trim(public.interpolate_runtime_template(v_create_task->>'description', v_context)), '');
      if v_task_description is null then
        v_task_description := v_consequence_description;
      end if;

      v_due_in_minutes := nullif(v_create_task->>'due_in_minutes', '')::numeric;
      v_due_at := case
        when v_due_in_minutes is null then null
        else timezone('utc', now()) + make_interval(mins => v_due_in_minutes::integer)
      end;

      select *
      into v_existing_task
      from public.session_tasks
      where session_id = p_session_id
        and session_inject_id is not distinct from p_session_inject_id
        and decision_id is not distinct from p_decision_id
        and title = v_task_title
        and description is not distinct from v_task_description
      limit 1;

      if v_existing_task.id is null then
        insert into public.session_tasks (
          session_id,
          session_inject_id,
          decision_id,
          assigned_role,
          title,
          description,
          status,
          priority,
          due_at,
          created_by,
          updated_by
        )
        values (
          p_session_id,
          p_session_inject_id,
          p_decision_id,
          nullif(trim(coalesce(v_create_task->>'assigned_role', 'facilitator')), ''),
          v_task_title,
          v_task_description,
          case
            when v_create_task->>'status' in ('open', 'in_progress', 'blocked', 'done', 'cancelled')
              then (v_create_task->>'status')::public.session_task_status
            else 'open'::public.session_task_status
          end,
          case
            when v_create_task->>'priority' in ('low', 'medium', 'high', 'critical')
              then (v_create_task->>'priority')::public.session_task_priority
            else 'medium'::public.session_task_priority
          end,
          v_due_at,
          v_uid,
          v_uid
        );

        v_created_tasks := v_created_tasks + 1;
        v_rule_created_tasks := v_rule_created_tasks + 1;
      end if;
    end if;

    v_send_inject := coalesce(v_effect->'send_inject', '{}'::jsonb);
    if jsonb_typeof(v_send_inject) = 'object'
      and nullif(trim(public.interpolate_runtime_template(v_send_inject->>'title', v_context)), '') is not null
      and nullif(trim(public.interpolate_runtime_template(v_send_inject->>'body', v_context)), '') is not null then
      insert into public.injects (
        title,
        body,
        channel,
        severity,
        sender_name,
        sender_org,
        inject_kind,
        source_type,
        entity_scope,
        requires_decision,
        decision_template_key,
        visibility_scope,
        branch_key
      )
      values (
        public.interpolate_runtime_template(v_send_inject->>'title', v_context),
        public.interpolate_runtime_template(v_send_inject->>'body', v_context),
        coalesce(nullif(trim(public.interpolate_runtime_template(v_send_inject->>'channel', v_context)), ''), 'ops'),
        case
          when v_send_inject->>'severity' in ('low', 'medium', 'high', 'critical')
            then v_send_inject->>'severity'
          else v_consequence_severity::text
        end,
        'System',
        'Decisionary',
        case
          when v_send_inject->>'inject_kind' in ('operational', 'media', 'social', 'intel', 'internal', 'system')
            then (v_send_inject->>'inject_kind')::public.inject_kind
          else 'system'::public.inject_kind
        end,
        'consequence'::public.inject_source_type,
        nullif(trim(public.interpolate_runtime_template(v_send_inject->>'entity_scope', v_context)), ''),
        coalesce((v_send_inject->>'requires_decision')::boolean, false),
        nullif(trim(public.interpolate_runtime_template(v_send_inject->>'decision_template_key', v_context)), ''),
        coalesce(nullif(trim(public.interpolate_runtime_template(v_send_inject->>'visibility_scope', v_context)), ''), 'all'),
        nullif(trim(public.interpolate_runtime_template(v_send_inject->>'branch_key', v_context)), '')
      )
      returning id into v_new_inject_id;

      insert into public.session_injects (
        session_id,
        delivered_at,
        inject_id
      )
      values (
        p_session_id,
        timezone('utc', now()),
        v_new_inject_id
      );

      v_created_injects := v_created_injects + 1;
      v_rule_created_injects := v_rule_created_injects + 1;
    end if;

    perform public.log_session_rule_evaluation(
      p_session_id,
      v_rule.id,
      p_event_type,
      true,
      null,
      p_session_inject_id,
      p_decision_id,
      p_action_id,
      p_task_id,
      v_rule_created_consequences,
      v_rule_created_tasks,
      v_rule_created_injects,
      v_context
    );
  end loop;

  return jsonb_build_object(
    'created_consequences', v_created_consequences,
    'created_tasks', v_created_tasks,
    'created_injects', v_created_injects
  );
end;
$$;

create or replace function public.process_overdue_session_tasks(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_status public.session_status;
  v_task record;
  v_result jsonb;
  v_total_consequences integer := 0;
  v_total_tasks integer := 0;
  v_total_injects integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_session(p_session_id, v_uid) then
    raise exception 'Session not accessible';
  end if;

  select status
  into v_session_status
  from public.sessions
  where id = p_session_id;

  if v_session_status is distinct from 'live'::public.session_status then
    return jsonb_build_object(
      'created_consequences', 0,
      'created_tasks', 0,
      'created_injects', 0
    );
  end if;

  for v_task in
    select id, session_inject_id
    from public.session_tasks
    where session_id = p_session_id
      and status not in ('done', 'cancelled')
      and due_at is not null
      and due_at <= timezone('utc', now())
  loop
    v_result := public.evaluate_session_rules(
      p_session_id,
      'task_overdue',
      v_task.session_inject_id,
      null,
      null,
      null,
      v_task.id
    );

    v_total_consequences := v_total_consequences + coalesce((v_result->>'created_consequences')::integer, 0);
    v_total_tasks := v_total_tasks + coalesce((v_result->>'created_tasks')::integer, 0);
    v_total_injects := v_total_injects + coalesce((v_result->>'created_injects')::integer, 0);
  end loop;

  return jsonb_build_object(
    'created_consequences', v_total_consequences,
    'created_tasks', v_total_tasks,
    'created_injects', v_total_injects
  );
end;
$$;

create or replace function public.restart_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scenario public.scenarios;
begin
  if not public.can_access_session(p_session_id, auth.uid()) then
    raise exception 'Session not accessible';
  end if;

  delete from public.session_rule_evaluations where session_id = p_session_id;
  delete from public.session_consequences where session_id = p_session_id;
  delete from public.session_tasks where session_id = p_session_id;
  delete from public.session_decisions where session_id = p_session_id;
  delete from public.session_actions where session_id = p_session_id;
  delete from public.session_injects where session_id = p_session_id;

  update public.sessions
  set status = 'draft',
      started_at = null,
      ended_at = null
  where id = p_session_id;

  select s2.*
  into v_scenario
  from public.sessions s
  join public.scenarios s2 on s2.id = s.scenario_id
  where s.id = p_session_id;

  if v_scenario.id is not null then
    insert into public.session_situation (
      session_id,
      event_date,
      event_time,
      timezone,
      location,
      situation_type,
      short_description,
      injured,
      fatalities,
      uninjured,
      unknown,
      updated_by
    )
    values (
      p_session_id,
      v_scenario.event_date,
      v_scenario.event_time,
      v_scenario.timezone,
      v_scenario.location,
      v_scenario.situation_type,
      v_scenario.short_description,
      v_scenario.injured,
      v_scenario.fatalities,
      v_scenario.uninjured,
      v_scenario.unknown,
      auth.uid()
    )
    on conflict (session_id) do update
      set event_date = excluded.event_date,
          event_time = excluded.event_time,
          timezone = excluded.timezone,
          location = excluded.location,
          situation_type = excluded.situation_type,
          short_description = excluded.short_description,
          injured = excluded.injured,
          fatalities = excluded.fatalities,
          uninjured = excluded.uninjured,
          unknown = excluded.unknown,
          updated_by = excluded.updated_by,
          updated_at = timezone('utc', now());
  end if;
end;
$$;
