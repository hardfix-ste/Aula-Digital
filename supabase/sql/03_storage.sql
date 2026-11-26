-- =====================================================================
-- AULA DIGITAL · 03_storage.sql
-- Buckets de Supabase Storage y sus políticas. Ejecutar después de 02.
--
-- Convención de rutas (el primer segmento SIEMPRE es el id de la institución):
--   materials/{institution_id}/{user_id}/{archivo}
--   justifications/{institution_id}/{student_id}/{archivo}
--   institution-assets/{institution_id}/{archivo}
--   ai-sources/{institution_id}/{user_id}/{archivo}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('materials', 'materials', false, 26214400, array[
    'application/pdf','image/png','image/jpeg','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv']),
  ('justifications', 'justifications', false, 10485760, array[
    'application/pdf','image/png','image/jpeg','image/webp']),
  ('institution-assets', 'institution-assets', false, 2097152, array[
    'image/png','image/jpeg','image/webp','image/svg+xml']),
  ('ai-sources', 'ai-sources', false, 15728640, array[
    'application/pdf','image/png','image/jpeg','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: ¿el objeto pertenece a la institución del usuario?
create or replace function public.storage_in_my_institution(_name text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select (storage.foldername(_name))[1] = public.current_institution_id()::text
$$;

-- ---- materials: el dueño gestiona; el personal docente ve lo compartido (vía tabla) ----
create policy materials_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.storage_in_my_institution(name)
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.has_any_role(array['superadmin','directivo']::public.app_role[])
      or exists (select 1 from public.educational_materials m
                 where m.file_path = storage.objects.name and m.shared and public.has_role('docente'))
    ));
create policy materials_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.storage_in_my_institution(name)
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.has_any_role(array['superadmin','directivo','secretaria','docente']::public.app_role[]));
create policy materials_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.storage_in_my_institution(name)
    and ((storage.foldername(name))[2] = auth.uid()::text or public.is_superadmin()));
create policy materials_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.storage_in_my_institution(name)
    and ((storage.foldername(name))[2] = auth.uid()::text or public.is_superadmin()));

-- ---- justifications: documentación sensible de alumnos ----
create policy justifications_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'justifications' and public.storage_in_my_institution(name)
    and (public.is_staff() or public.teaches_student(((storage.foldername(name))[2])::uuid)
         or public.is_guardian_of(((storage.foldername(name))[2])::uuid)));
create policy justifications_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'justifications' and public.storage_in_my_institution(name)
    and (public.has_any_role(array['superadmin','secretaria']::public.app_role[])
         or public.teaches_student(((storage.foldername(name))[2])::uuid)));
create policy justifications_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'justifications' and public.storage_in_my_institution(name)
    and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));

-- ---- institution-assets: logo y recursos institucionales ----
create policy assets_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'institution-assets' and public.storage_in_my_institution(name));
create policy assets_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'institution-assets' and public.storage_in_my_institution(name) and public.is_superadmin());
create policy assets_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'institution-assets' and public.storage_in_my_institution(name) and public.is_superadmin());
create policy assets_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'institution-assets' and public.storage_in_my_institution(name) and public.is_superadmin());

-- ---- ai-sources: archivos que el docente sube para que la IA los procese ----
create policy ai_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'ai-sources' and public.storage_in_my_institution(name)
    and (storage.foldername(name))[2] = auth.uid()::text);
create policy ai_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ai-sources' and public.storage_in_my_institution(name)
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.has_any_role(array['superadmin','directivo','docente']::public.app_role[]));
create policy ai_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ai-sources' and public.storage_in_my_institution(name)
    and (storage.foldername(name))[2] = auth.uid()::text);
