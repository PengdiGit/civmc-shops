-- Directory ad banner uploads: uploads/directory-ads/{auth.uid()}/…

drop policy if exists "verified upload to own folder" on storage.objects;

create policy "verified upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and public.is_verified()
    and (storage.foldername(name))[1] in ('comments', 'avatars', 'shops', 'directory-ads')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "staff directory ad upload" on storage.objects;

create policy "staff directory ad upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'directory-ads'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.is_head() or public.is_admin())
  );
