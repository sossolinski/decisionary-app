create table if not exists public.inject_media (
  id uuid primary key default gen_random_uuid(),
  inject_id uuid not null references public.injects (id) on delete cascade,
  storage_path text not null unique,
  mime_type text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (user_id) on delete set null
);

create index if not exists idx_inject_media_inject_id
on public.inject_media (inject_id, sort_order asc, created_at asc);

alter table public.inject_media enable row level security;

create or replace function public.can_access_inject(p_inject_id uuid, p_uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.can_facilitate(p_uid)
    or public.is_admin(p_uid)
    or exists (
      select 1
      from public.scenario_injects si
      where si.inject_id = p_inject_id
        and public.can_read_scenario(si.scenario_id, p_uid)
    )
    or exists (
      select 1
      from public.session_injects si
      where si.inject_id = p_inject_id
        and public.can_access_session(si.session_id, p_uid)
    );
$$;

drop policy if exists inject_media_select on public.inject_media;
create policy inject_media_select on public.inject_media
for select
to authenticated
using (public.can_access_inject(inject_id, auth.uid()));

drop policy if exists inject_media_insert on public.inject_media;
create policy inject_media_insert on public.inject_media
for insert
to authenticated
with check (
  public.can_facilitate(auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists inject_media_update on public.inject_media;
create policy inject_media_update on public.inject_media
for update
to authenticated
using (
  public.can_facilitate(auth.uid())
  or public.is_admin(auth.uid())
)
with check (
  public.can_facilitate(auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists inject_media_delete on public.inject_media;
create policy inject_media_delete on public.inject_media
for delete
to authenticated
using (
  public.can_facilitate(auth.uid())
  or public.is_admin(auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inject-media',
  'inject-media',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inject_media_storage_read on storage.objects;
create policy inject_media_storage_read on storage.objects
for select
to authenticated
using (
  bucket_id = 'inject-media'
  and (
    public.can_facilitate(auth.uid())
    or public.is_admin(auth.uid())
    or exists (
      select 1
      from public.inject_media im
      join public.session_injects si on si.inject_id = im.inject_id
      where im.storage_path = storage.objects.name
        and public.can_access_session(si.session_id, auth.uid())
    )
    or exists (
      select 1
      from public.inject_media im
      join public.scenario_injects si on si.inject_id = im.inject_id
      where im.storage_path = storage.objects.name
        and public.can_read_scenario(si.scenario_id, auth.uid())
    )
  )
);

drop policy if exists inject_media_storage_insert on storage.objects;
create policy inject_media_storage_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inject-media'
  and (
    public.can_facilitate(auth.uid())
    or public.is_admin(auth.uid())
  )
);

drop policy if exists inject_media_storage_update on storage.objects;
create policy inject_media_storage_update on storage.objects
for update
to authenticated
using (
  bucket_id = 'inject-media'
  and (
    public.can_facilitate(auth.uid())
    or public.is_admin(auth.uid())
  )
)
with check (
  bucket_id = 'inject-media'
  and (
    public.can_facilitate(auth.uid())
    or public.is_admin(auth.uid())
  )
);

drop policy if exists inject_media_storage_delete on storage.objects;
create policy inject_media_storage_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inject-media'
  and (
    public.can_facilitate(auth.uid())
    or public.is_admin(auth.uid())
  )
);

create or replace function public.cleanup_inject_media_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'inject-media'
    and name = old.storage_path;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_inject_media_storage_object on public.inject_media;
create trigger trg_cleanup_inject_media_storage_object
after delete on public.inject_media
for each row
execute function public.cleanup_inject_media_storage_object();

grant execute on function public.can_access_inject(uuid, uuid) to authenticated;
