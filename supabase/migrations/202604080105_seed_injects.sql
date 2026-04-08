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
    raise exception 'No admin profile found for inject seed';
  end if;

  create temporary table tmp_inject_seed (
    scenario_title text,
    order_index integer,
    scheduled_at timestamptz,
    title text,
    body text,
    channel text,
    severity text,
    sender_name text,
    sender_org text
  ) on commit drop;

  insert into tmp_inject_seed (
    scenario_title,
    order_index,
    scheduled_at,
    title,
    body,
    channel,
    severity,
    sender_name,
    sender_org
  )
  values
    (
      'Cabin Smoke Diversion Over Central Europe',
      10,
      '2026-05-12T14:22:00+02:00',
      'Initial Cabin Crew Report',
      'Cabin crew report a persistent electrical smell and light haze in the aft galley. Passengers in rows 24 to 30 are turning around and asking whether there is smoke on board. One crew member reports throat irritation but remains able to work. The captain requests that operations begin diversion support planning immediately.',
      'ops',
      'high',
      'Senior Cabin Crew',
      'Flight DEC217'
    ),
    (
      'Cabin Smoke Diversion Over Central Europe',
      20,
      '2026-05-12T14:25:00+02:00',
      'Dispatch Weather and Alternate Snapshot',
      'Katowice currently reports acceptable visibility, dry runway, and emergency services available with no flow restrictions. Krakow remains available but has tighter stand capacity and increasing arrival pressure. Dispatch requests a decision within five minutes to coordinate ground handling, towing support, and a passenger recovery plan.',
      'ops',
      'medium',
      'Flight Dispatch',
      'Airline Operations Control'
    ),
    (
      'Cabin Smoke Diversion Over Central Europe',
      30,
      '2026-05-12T14:29:00+02:00',
      'Passenger Social Media Post Spreading',
      'A passenger has posted on X: "Smoke filling the back of the plane, no information from crew, people panicking." The post is already being reshared by two aviation accounts and one local news desk has sent a request for comment to the press office inbox.',
      'social',
      'high',
      'Digital Monitoring Desk',
      'Corporate Communications'
    ),
    (
      'Cabin Smoke Diversion Over Central Europe',
      40,
      '2026-05-12T14:33:00+02:00',
      'Airport Fire Commander Readiness Check',
      'Katowice Airport Rescue and Fire Fighting Services confirm category coverage and request updated souls on board, dangerous goods status, and whether a full evacuation is expected after landing. They can position at stand or request remote parking depending on airline preference.',
      'ops',
      'high',
      'ARFF Duty Commander',
      'Katowice Airport'
    ),
    (
      'Cabin Smoke Diversion Over Central Europe',
      50,
      '2026-05-12T14:40:00+02:00',
      'Family Contact Center Escalation',
      'Three relatives have called the customer contact line after seeing online posts about smoke on board. They are asking whether the aircraft is on fire and whether anyone has been injured. Call center supervisors request approved holding lines and escalation guidance.',
      'inbox',
      'medium',
      'Contact Center Supervisor',
      'Customer Support'
    ),
    (
      'Cabin Smoke Diversion Over Central Europe',
      60,
      '2026-05-12T14:46:00+02:00',
      'On-Ground Medical Follow-Up',
      'After landing, the aft cabin crew member is assessed for minor smoke inhalation symptoms and two passengers request medical evaluation due to anxiety and breathing discomfort. Local media are now filming outside the terminal bus arrival point. The station manager requests direction on passenger handling and visual shielding.',
      'ops',
      'high',
      'Station Manager',
      'Katowice Turnaround Team'
    ),

    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      10,
      '2026-06-03T19:06:00+01:00',
      'Tower Supervisor Initial Alert',
      'Tower reports that arriving Flight BRG442 initiated a go-around after the crew stated there was traffic still on the runway. A maintenance vehicle had not vacated as expected and a departing regional jet had begun line-up preparations. No collision occurred, but the runway is temporarily closed pending fact gathering.',
      'ops',
      'high',
      'Tower Supervisor',
      'Airport ATC'
    ),
    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      20,
      '2026-06-03T19:10:00+01:00',
      'Conflicting Account From Ground Vehicle Team',
      'The airfield maintenance team claims they believed they were cleared to remain adjacent to the runway holding point and never heard a vacate instruction due to radio congestion. The first factual picture is already inconsistent across ATC, vehicle control, and flight crew reporting.',
      'inbox',
      'medium',
      'Airfield Maintenance Control',
      'Airport Operations'
    ),
    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      30,
      '2026-06-03T19:15:00+01:00',
      'Aircraft Crew Safety Report Submitted',
      'The captain of the arriving aircraft states that runway occupancy became visible only in the late landing phase and that the aircraft crossed the threshold before the go-around was initiated. Cabin crew report passengers visibly alarmed and several believe the aircraft nearly crashed.',
      'ops',
      'high',
      'Flight Safety Reporting System',
      'Airline Safety'
    ),
    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      40,
      '2026-06-03T19:19:00+01:00',
      'Regulator Requests Immediate Notification',
      'The national aviation authority duty officer requests a preliminary timeline, identities of aircraft and vehicle operators, and confirmation on whether evidence preservation procedures are already in place. They warn that media inquiries are likely within minutes.',
      'ops',
      'high',
      'Duty Officer',
      'Civil Aviation Authority'
    ),
    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      50,
      '2026-06-03T19:24:00+01:00',
      'Press Inquiry From Major Broadcaster',
      'A national broadcaster asks whether "three moving objects were on the same runway at the same time" and whether airport staffing shortages contributed to the event. They are requesting a live interview within the next twenty minutes.',
      'media',
      'high',
      'News Assignment Editor',
      'Global News Network'
    ),
    (
      'Runway Incursion and Near-Collision at a Busy Hub',
      60,
      '2026-06-03T19:31:00+01:00',
      'Operational Recovery Pressure',
      'Airline network control warns that a prolonged runway closure will cascade into missed curfews, crew legality issues, and overnight passenger displacement across the hub structure. They need a forecast, but the safety team argues the airfield should remain restricted until evidence is protected.',
      'pulse',
      'medium',
      'Network Control',
      'Airline Operations'
    ),

    (
      'Bird Strike After Departure With Engine Damage',
      10,
      '2026-07-18T06:47:00+02:00',
      'Flight Crew Declares Return',
      'The departing crew reports a multiple bird strike shortly after rotation with loud bangs, severe vibration, and indications of partial thrust degradation on the left engine. They intend to hold for a short assessment before requesting priority return. Cabin crew report passengers saw flames from the engine.',
      'ops',
      'high',
      'Captain',
      'Flight NDL602'
    ),
    (
      'Bird Strike After Departure With Engine Damage',
      20,
      '2026-07-18T06:51:00+02:00',
      'Engineering Advisory',
      'Engineering control advises that the vibration pattern described by the crew may indicate fan blade damage or ingestion beyond standard bird strike tolerance. They strongly recommend full emergency services readiness and post-landing engine inspection before taxi decisions are made.',
      'ops',
      'high',
      'Engineering Control',
      'Technical Operations'
    ),
    (
      'Bird Strike After Departure With Engine Damage',
      30,
      '2026-07-18T06:55:00+02:00',
      'Video Clip Appears Online',
      'A ground observer has uploaded a short video showing sparks or flame near the left engine during climb-out. The clip is spreading quickly with captions claiming the engine "exploded after takeoff." Customer channels are beginning to receive worried messages from booked passengers on later departures.',
      'social',
      'high',
      'Social Listening Team',
      'Corporate Communications'
    ),
    (
      'Bird Strike After Departure With Engine Damage',
      40,
      '2026-07-18T06:59:00+02:00',
      'Airport Wildlife Control Question',
      'Airport wildlife control asks whether this appears to be an isolated event or whether the airline expects wider bird activity risk in the departure corridor. Operations wants to know if departures should be slowed while runway inspection and bird dispersal are conducted.',
      'ops',
      'medium',
      'Wildlife Hazard Officer',
      'Airport Operations'
    ),
    (
      'Bird Strike After Departure With Engine Damage',
      50,
      '2026-07-18T07:08:00+02:00',
      'Passenger Welfare and Rebooking Load',
      'Commercial control estimates that if the aircraft remains grounded for the day, 166 customers will require reaccommodation and two onward long-haul connections will be missed. Frontline teams ask whether to proactively issue disruption notices now or wait until the technical picture is confirmed.',
      'inbox',
      'medium',
      'Commercial Duty Manager',
      'Customer Operations'
    ),
    (
      'Bird Strike After Departure With Engine Damage',
      60,
      '2026-07-18T07:14:00+02:00',
      'Crew Reports High Cabin Tension',
      'After landing safely, cabin crew report that several passengers are filming inside the cabin and challenging staff explanations. Two passengers say they smelled burning and want written confirmation of what happened before continuing travel. The station team requests approved language and escalation thresholds.',
      'pulse',
      'medium',
      'Cabin Services Manager',
      'Airport Station Team'
    ),

    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      10,
      '2026-09-02T08:12:00+01:00',
      'Dispatch Systems Degradation Alert',
      'Operations control reports intermittent loss of dispatch visibility, delayed weather uplinks, and failures in crew briefing synchronization. Flights already airborne remain contactable, but decision support tools are becoming unreliable. The cyber team has not yet confirmed whether this is outage, intrusion, or both.',
      'ops',
      'high',
      'Operations Control Supervisor',
      'Airline OCC'
    ),
    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      20,
      '2026-09-02T08:18:00+01:00',
      'Suspicious Ransom Note Screenshot',
      'A screenshot circulating internally appears to show a ransom demand on one operations workstation, but IT cannot yet verify whether it is genuine, staged, or copied from another incident. Executives are asking whether the airline is under active ransomware attack and whether systems should be isolated immediately.',
      'inbox',
      'high',
      'IT Service Desk',
      'Enterprise Technology'
    ),
    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      30,
      '2026-09-02T08:24:00+01:00',
      'Airport Interface Failure Escalates',
      'Two airport stations report that load control and departure messaging exchanges with the airline are no longer consistent. One station has begun reverting to manual workaround processes, while another says it cannot confidently dispatch the next bank without validated data.',
      'ops',
      'high',
      'Station Duty Manager',
      'Hub Operations'
    ),
    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      40,
      '2026-09-02T08:31:00+01:00',
      'Data Protection Concern Raised',
      'Legal asks whether any passenger, employee, or crew data may already be exposed because a journalist has emailed claiming that "internal manifests" are being offered online. No evidence has yet been verified, but the notification clock may become critical if personal data compromise is confirmed.',
      'inbox',
      'high',
      'Legal Counsel',
      'Risk and Compliance'
    ),
    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      50,
      '2026-09-02T08:38:00+01:00',
      'CEO Requests Grounding Recommendation',
      'The CEO requests a clear recommendation within ten minutes: continue under manual contingency procedures, selectively delay, or temporarily ground network operations until system integrity is better understood. Senior leaders are divided between operational caution and fear of overreacting without enough evidence.',
      'pulse',
      'high',
      'Executive Office',
      'Corporate HQ'
    ),
    (
      'Cyberattack on Airline Operations and Airport Interfaces',
      60,
      '2026-09-02T08:45:00+01:00',
      'Media Leak and Public Narrative Shift',
      'An aviation trade journalist posts that the airline is "possibly under cyberattack" and suggests flights may be dispatched without full system support. Passenger sentiment shifts rapidly from frustration to safety concern. The communications team needs a holding line that does not overstate certainty.',
      'media',
      'high',
      'External Media Monitor',
      'Corporate Communications'
    ),

    (
      'Crash on Final Approach With Mass Casualty Response',
      10,
      '2026-11-21T17:42:00+01:00',
      'Initial Crash Confirmation',
      'Airport emergency operations confirm that a regional jet impacted terrain short of the runway threshold during final approach in heavy rain. Fire is visible near the fuselage and multiple rescue units are responding. The runway is closed and all arriving traffic is being diverted. The exact number of fatalities is not yet confirmed.',
      'ops',
      'critical',
      'Airport Emergency Control',
      'Airport Operations'
    ),
    (
      'Crash on Final Approach With Mass Casualty Response',
      20,
      '2026-11-21T17:47:00+01:00',
      'Conflicting Casualty Numbers',
      'Emergency services estimate multiple fatalities, but social media posts are already claiming that "everyone died." The airline duty team has only a provisional manifest reconciliation and cannot yet confirm how many occupants were on board, transported, or self-evacuated.',
      'inbox',
      'critical',
      'Emergency Liaison Officer',
      'Joint Response Cell'
    ),
    (
      'Crash on Final Approach With Mass Casualty Response',
      30,
      '2026-11-21T17:55:00+01:00',
      'Government and Regulator Escalation',
      'Transport ministry officials request a secure briefing within thirty minutes. The accident investigation authority requires immediate preservation of maintenance records, crew schedules, dangerous goods information, and all communication logs. Senior political offices are now monitoring the event directly.',
      'ops',
      'critical',
      'Duty Director',
      'National Transport Authority'
    ),
    (
      'Crash on Final Approach With Mass Casualty Response',
      40,
      '2026-11-21T18:03:00+01:00',
      'Family Reception Center Pressure',
      'Relatives are arriving at the airport terminal after seeing news alerts. Frontline staff do not yet have approved wording on survivor status, hospitals, or transportation arrangements. Family assistance volunteers are requesting immediate leadership, private space, and a clear registration process.',
      'inbox',
      'high',
      'Terminal Duty Manager',
      'Passenger Services'
    ),
    (
      'Crash on Final Approach With Mass Casualty Response',
      50,
      '2026-11-21T18:11:00+01:00',
      'Live Broadcast Demands Executive Appearance',
      'Multiple broadcasters are now carrying live pictures from outside the airport. One anchor states on air that the airline "has gone silent during a national tragedy" and requests an executive spokesperson within the hour. Share price speculation is beginning in financial media.',
      'media',
      'high',
      'Broadcast Producer',
      'International News Channel'
    ),
    (
      'Crash on Final Approach With Mass Casualty Response',
      60,
      '2026-11-21T18:22:00+01:00',
      'Crew Family and Staff Welfare Breakdown',
      'Internal teams report that one crew family member has arrived at headquarters without escort and several frontline call center staff are visibly distressed after handling repeated casualty questions. HR and welfare teams warn that responders themselves now need structured support and protected rotations.',
      'pulse',
      'high',
      'People Support Lead',
      'HR and Staff Welfare'
    );

  for v_scenario_id in
    select s.id
    from public.scenarios s
    where s.title in (select distinct scenario_title from tmp_inject_seed)
  loop
    delete from public.scenario_injects
    where scenario_id = v_scenario_id;
  end loop;

  delete from public.injects i
  where i.title in (select title from tmp_inject_seed)
    and i.sender_org in (select distinct sender_org from tmp_inject_seed);

  insert into public.injects (
    title,
    body,
    channel,
    severity,
    sender_name,
    sender_org,
    created_by
  )
  select
    t.title,
    t.body,
    t.channel,
    t.severity,
    t.sender_name,
    t.sender_org,
    v_admin_id
  from tmp_inject_seed t;

  insert into public.scenario_injects (
    scenario_id,
    inject_id,
    scheduled_at,
    order_index
  )
  select
    s.id,
    i.id,
    t.scheduled_at,
    t.order_index
  from tmp_inject_seed t
  join public.scenarios s
    on s.title = t.scenario_title
  join public.injects i
    on i.title = t.title
   and i.body = t.body
   and coalesce(i.sender_org, '') = coalesce(t.sender_org, '')
   and coalesce(i.sender_name, '') = coalesce(t.sender_name, '')
  where not exists (
    select 1
    from public.scenario_injects si
    where si.scenario_id = s.id
      and si.inject_id = i.id
      and si.order_index = t.order_index
  );
end $$;
