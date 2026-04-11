create table if not exists public.notification_announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  kind text not null default 'system' check (kind in ('system', 'product')),
  audience text not null default 'all' check (audience in ('all', 'admins', 'facilitators', 'participants')),
  priority text not null default 'normal' check (priority in ('normal', 'important')),
  title text not null check (char_length(btrim(title)) > 0),
  body text not null check (char_length(btrim(body)) > 0),
  link_path text check (link_path is null or link_path like '/%'),
  published_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles (user_id) on delete set null,
  check (expires_at is null or expires_at > published_at)
);

create index if not exists idx_notification_announcements_org_id
  on public.notification_announcements (org_id);

create index if not exists idx_notification_announcements_published
  on public.notification_announcements (archived, published_at desc);

alter table public.notification_announcements enable row level security;

drop trigger if exists notification_announcements_set_updated_by on public.notification_announcements;
create trigger notification_announcements_set_updated_by
before update on public.notification_announcements
for each row
execute function public.set_updated_by();

create or replace function public.admin_list_notification_announcements(p_org_id uuid default null)
returns setof public.notification_announcements
language sql
security definer
set search_path = public
as $$
  select na.*
  from public.notification_announcements na
  where public.is_admin(auth.uid())
    and na.archived = false
    and (
      (p_org_id is null and na.org_id is null)
      or (p_org_id is not null and (na.org_id = p_org_id or na.org_id is null))
    )
  order by
    case when na.org_id is null then 0 else 1 end,
    na.published_at desc,
    na.created_at desc;
$$;

create or replace function public.admin_create_notification_announcement(
  p_org_id uuid default null,
  p_title text default null,
  p_body text default null,
  p_link_path text default null,
  p_kind text default 'system',
  p_audience text default 'all',
  p_priority text default 'normal',
  p_expires_at timestamptz default null
)
returns public.notification_announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := lower(trim(coalesce(p_kind, 'system')));
  v_audience text := lower(trim(coalesce(p_audience, 'all')));
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
  v_link_path text := nullif(trim(coalesce(p_link_path, '')), '');
  v_row public.notification_announcements;
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can create announcements';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Title is required';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'Body is required';
  end if;

  if v_kind not in ('system', 'product') then
    raise exception 'Invalid announcement kind';
  end if;

  if v_audience not in ('all', 'admins', 'facilitators', 'participants') then
    raise exception 'Invalid audience';
  end if;

  if v_priority not in ('normal', 'important') then
    raise exception 'Invalid priority';
  end if;

  if v_link_path is not null and left(v_link_path, 1) <> '/' then
    raise exception 'Link path must start with /';
  end if;

  if p_org_id is not null and not exists (
    select 1
    from public.organizations o
    where o.id = p_org_id
      and o.archived = false
  ) then
    raise exception 'Organization not found';
  end if;

  insert into public.notification_announcements (
    org_id,
    kind,
    audience,
    priority,
    title,
    body,
    link_path,
    expires_at,
    created_by,
    updated_by
  )
  values (
    p_org_id,
    v_kind,
    v_audience,
    v_priority,
    trim(p_title),
    trim(p_body),
    v_link_path,
    p_expires_at,
    v_uid,
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_archive_notification_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then
    raise exception 'Only admins can archive announcements';
  end if;

  update public.notification_announcements
  set archived = true,
      updated_by = v_uid,
      updated_at = timezone('utc', now())
  where id = p_announcement_id;
end;
$$;

create or replace function public.list_my_notification_announcements()
returns setof public.notification_announcements
language sql
security definer
set search_path = public
as $$
  with me as (
    select
      p.user_id,
      coalesce(nullif(p.active_role::text, ''), p.role::text, 'participant') as current_role,
      (
        select uos.active_org_id
        from public.user_org_settings uos
        where uos.user_id = p.user_id
        limit 1
      ) as active_org_id
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_disabled = false
    limit 1
  )
  select na.*
  from public.notification_announcements na
  cross join me
  where na.archived = false
    and na.published_at <= timezone('utc', now())
    and (na.expires_at is null or na.expires_at > timezone('utc', now()))
    and (
      na.org_id is null
      or na.org_id = me.active_org_id
    )
    and (
      na.audience = 'all'
      or (na.audience = 'admins' and me.current_role = 'admin')
      or (na.audience = 'facilitators' and me.current_role = 'facilitator')
      or (na.audience = 'participants' and me.current_role = 'participant')
    )
  order by na.published_at desc, na.created_at desc
  limit 12;
$$;

grant execute on function public.admin_list_notification_announcements(uuid) to authenticated;
grant execute on function public.admin_create_notification_announcement(uuid, text, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_archive_notification_announcement(uuid) to authenticated;
grant execute on function public.list_my_notification_announcements() to authenticated;
