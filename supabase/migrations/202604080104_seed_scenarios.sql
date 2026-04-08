do $$
declare
  v_admin_id uuid;
  v_scenario_id uuid;
begin
  select user_id into v_admin_id
  from public.profiles
  where lower(email) = 'decisionary.app@gmail.com'
  limit 1;

  if v_admin_id is null then
    select user_id into v_admin_id
    from public.profiles
    where role = 'admin'
    order by created_at asc
    limit 1;
  end if;

  if v_admin_id is null then
    raise exception 'No admin profile found for scenario seed';
  end if;

  insert into public.scenarios (
    owner_id,
    title,
    description,
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
    created_by,
    updated_by
  )
  values (
    v_admin_id,
    'Cabin Smoke Diversion Over Central Europe',
    'A narrow-body passenger flight cruising from Warsaw to Barcelona reports a persistent smell of smoke in the aft cabin followed by visible haze near the rear galley. The cabin crew reports increasing passenger anxiety, one flight attendant with mild smoke inhalation symptoms, and uncertain source identification. The flight crew declares PAN PAN and begins diversion planning while operations control, airport services, emergency response, media teams, and family assistance functions begin activating in parallel. The exercise focuses on time-critical decision-making under uncertainty, coordination between flight deck and ground stakeholders, passenger communications, diversion support, and the transition from an in-flight technical irregularity into a reputational and customer-care event.',
    '2026-05-12',
    '14:20',
    'Europe/Warsaw',
    'En route over southern Poland, diverting to Katowice Airport (EPKT)',
    'In-flight technical emergency',
    'Cabin smoke event with diversion, passenger anxiety, and fast-escalating operational coordination demands.',
    1,
    0,
    178,
    0,
    v_admin_id,
    v_admin_id
  )
  returning id into v_scenario_id;

  insert into public.scenario_roles (
    scenario_id,
    role_key,
    role_name,
    role_description,
    sort_order,
    is_required
  )
  values
    (v_scenario_id, 'incident_commander', 'Airline Incident Commander', 'Leads strategic coordination, approves priorities, and aligns all response functions.', 10, true),
    (v_scenario_id, 'flight_operations', 'Flight Operations Duty Manager', 'Coordinates with crew, dispatch, flight watch, and diversion support teams.', 20, true),
    (v_scenario_id, 'airport_ops', 'Airport Operations Coordinator', 'Manages stand allocation, airside access, emergency services interface, and turnaround impact.', 30, true),
    (v_scenario_id, 'communications', 'Corporate Communications Lead', 'Handles media holding statements, executive messaging, and rumor control.', 40, true),
    (v_scenario_id, 'family_assistance', 'Passenger and Family Support Lead', 'Coordinates passenger welfare, onward travel, and support for distressed relatives.', 50, false);

  insert into public.scenarios (
    owner_id,
    title,
    description,
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
    created_by,
    updated_by
  )
  values (
    v_admin_id,
    'Runway Incursion and Near-Collision at a Busy Hub',
    'During evening peak traffic at a major international airport, an arriving aircraft is cleared to land while a maintenance vehicle and a departing regional jet are both positioned incorrectly near the active runway due to a chain of communication failures, reduced visibility, and frequency congestion. The landing aircraft executes a late go-around after the crew reports traffic on the runway. Air traffic control, airport operations, airline operations, safety, and communications teams must respond to a near-catastrophic event with immediate regulatory, operational, and media implications. The scenario emphasizes fragmented situational awareness, conflicting accounts from multiple actors, and the challenge of making confident public statements before facts are fully confirmed.',
    '2026-06-03',
    '19:05',
    'Europe/London',
    'Major international hub airport during evening peak bank',
    'Airport surface safety event',
    'A runway incursion creates a last-second go-around and immediate safety, regulatory, and media pressure.',
    0,
    0,
    241,
    0,
    v_admin_id,
    v_admin_id
  )
  returning id into v_scenario_id;

  insert into public.scenario_roles (
    scenario_id,
    role_key,
    role_name,
    role_description,
    sort_order,
    is_required
  )
  values
    (v_scenario_id, 'airside_commander', 'Airside Response Commander', 'Coordinates airport-side response, secures runway environment, and manages operational continuity.', 10, true),
    (v_scenario_id, 'safety_investigation', 'Safety and Investigation Lead', 'Owns evidence protection, initial fact gathering, and regulator interface.', 20, true),
    (v_scenario_id, 'airline_control', 'Airline Operations Control Lead', 'Assesses knock-on disruption, aircraft status, crew impacts, and passenger recovery.', 30, true),
    (v_scenario_id, 'regulatory_liaison', 'Regulatory Liaison Officer', 'Coordinates mandatory notifications and response consistency with authorities.', 40, true),
    (v_scenario_id, 'media_cell', 'Media Response Cell Lead', 'Prepares statements, manages press escalation, and controls unverified narratives.', 50, false);

  insert into public.scenarios (
    owner_id,
    title,
    description,
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
    created_by,
    updated_by
  )
  values (
    v_admin_id,
    'Bird Strike After Departure With Engine Damage',
    'A medium-haul departure suffers a multiple-bird ingestion shortly after takeoff, resulting in severe vibration, partial thrust loss, and possible engine damage. The crew requests priority return while fuel burn, landing performance, emergency services readiness, and passenger communications must all be managed in real time. On the ground, operations control must coordinate maintenance, customer impact, network disruption, airport rescue readiness, and media handling after bystander video appears online showing flames near the engine. The scenario tests fast technical assessment, the balance between caution and escalation, and coordination between engineering, flight operations, commercial teams, and airport partners.',
    '2026-07-18',
    '06:45',
    'Europe/Amsterdam',
    'Shortly after departure from Amsterdam Schiphol (EHAM)',
    'Post-takeoff technical event',
    'A bird strike causes engine damage after departure and triggers a high-visibility emergency return.',
    2,
    0,
    164,
    0,
    v_admin_id,
    v_admin_id
  )
  returning id into v_scenario_id;

  insert into public.scenario_roles (
    scenario_id,
    role_key,
    role_name,
    role_description,
    sort_order,
    is_required
  )
  values
    (v_scenario_id, 'technical_lead', 'Technical Operations Lead', 'Assesses aircraft damage, maintenance implications, and fleet-wide technical messaging.', 10, true),
    (v_scenario_id, 'flight_dispatch', 'Flight Dispatch Coordinator', 'Supports crew with performance, weather, alternates, and recovery planning.', 20, true),
    (v_scenario_id, 'customer_response', 'Customer Response Manager', 'Plans passenger handling, reaccommodation, and digital communications.', 30, true),
    (v_scenario_id, 'airport_emergency', 'Airport Emergency Services Liaison', 'Coordinates emergency positioning, runway inspection, and airside readiness.', 40, true),
    (v_scenario_id, 'social_monitoring', 'Social Media Monitoring Lead', 'Tracks public video, misinformation, and escalation risk across channels.', 50, false);

  insert into public.scenarios (
    owner_id,
    title,
    description,
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
    created_by,
    updated_by
  )
  values (
    v_admin_id,
    'Cyberattack on Airline Operations and Airport Interfaces',
    'A coordinated cyberattack affects the airline operational control center, crew reporting tools, internal messaging, and selected airport integration feeds. Flights are still airborne, but dispatch visibility is degraded, load control messages are delayed, and check-in disruption is spreading across two hubs. Rumors of a ransomware demand appear on social media before the technical teams have a confirmed scope. Leadership must decide whether to continue, delay, or ground operations while balancing safety, data integrity, regulatory duties, and intense external scrutiny. The scenario is designed to force cross-functional collaboration between operations, cyber, legal, executive leadership, customer communications, and airport stakeholders under conditions of incomplete and potentially misleading information.',
    '2026-09-02',
    '08:10',
    'Europe/Dublin',
    'Airline operations control center and two connected airport stations',
    'Cyber and operational disruption',
    'A cyber incident degrades dispatch and airport interfaces, forcing safety and continuity decisions under uncertainty.',
    0,
    0,
    0,
    0,
    v_admin_id,
    v_admin_id
  )
  returning id into v_scenario_id;

  insert into public.scenario_roles (
    scenario_id,
    role_key,
    role_name,
    role_description,
    sort_order,
    is_required
  )
  values
    (v_scenario_id, 'crisis_director', 'Crisis Director', 'Owns enterprise-level priorities, escalation thresholds, and executive decision support.', 10, true),
    (v_scenario_id, 'cyber_lead', 'Cybersecurity Incident Lead', 'Coordinates containment, forensics, and technical situation reporting.', 20, true),
    (v_scenario_id, 'ops_continuity', 'Operations Continuity Manager', 'Assesses which operational functions can safely continue and under what controls.', 30, true),
    (v_scenario_id, 'legal_compliance', 'Legal and Compliance Counsel', 'Advises on notification duties, liability exposure, and evidence preservation.', 40, true),
    (v_scenario_id, 'customer_comms', 'Customer Communications Lead', 'Builds outward-facing messaging for passengers, partners, and digital channels.', 50, false);

  insert into public.scenarios (
    owner_id,
    title,
    description,
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
    created_by,
    updated_by
  )
  values (
    v_admin_id,
    'Crash on Final Approach With Mass Casualty Response',
    'A regional jet on approach in deteriorating weather crashes short of the runway perimeter, resulting in multiple fatalities, significant injuries, airfield closure, and an immediate large-scale emergency response. The airline, airport, emergency services, investigators, and government authorities must operate simultaneously under enormous public and political pressure. Survivor support, family assistance, executive briefings, regulator notifications, media saturation, staff welfare, and continuity planning all compete for attention within the first hours. This scenario is intentionally intense and complex, designed for mature crisis management teams that need to practice leadership, prioritization, message discipline, and structured coordination during a fast-moving mass casualty aviation event.',
    '2026-11-21',
    '17:40',
    'Europe/Paris',
    'Final approach to a major European airport in low ceiling and rain',
    'Major aircraft accident',
    'A crash on approach triggers a full-scale mass casualty, investigation, family assistance, and media response.',
    23,
    31,
    18,
    4,
    v_admin_id,
    v_admin_id
  )
  returning id into v_scenario_id;

  insert into public.scenario_roles (
    scenario_id,
    role_key,
    role_name,
    role_description,
    sort_order,
    is_required
  )
  values
    (v_scenario_id, 'gold_command', 'Gold Command Lead', 'Sets strategic objectives and chairs the highest-level crisis coordination cell.', 10, true),
    (v_scenario_id, 'family_assistance_director', 'Family Assistance Director', 'Leads victim support, family reception, and compassionate communications.', 20, true),
    (v_scenario_id, 'investigation_support', 'Accident Investigation Support Lead', 'Coordinates with investigators and protects records, evidence, and technical experts.', 30, true),
    (v_scenario_id, 'executive_briefing', 'Executive Briefing Coordinator', 'Prepares leadership updates, board material, and decision support for senior executives.', 40, true),
    (v_scenario_id, 'staff_welfare', 'Staff Welfare and Resilience Lead', 'Manages support for crew, frontline staff, and control center personnel.', 50, false);
end $$;
