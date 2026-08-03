-- Storage bucket for report multimedia evidence (public read).
-- The backend uploads with the anon key, so storage.objects needs
-- SELECT (public) and INSERT (anon) policies scoped to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types, type)
values (
  'evidence',
  'evidence',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp'],
  'STANDARD'::storage.buckettype
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    type = excluded.type;

do $$
begin
  create policy "Allow public read access to buckets"
    on storage.buckets for select to public using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Allow public read access to evidence objects"
    on storage.objects for select to public using (bucket_id = 'evidence');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Allow anon uploads to evidence bucket"
    on storage.objects for insert to anon with check (bucket_id = 'evidence');
exception when duplicate_object then null;
end $$;
