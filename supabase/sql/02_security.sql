-- =====================================================================
-- AULA DIGITAL · 02_security.sql
-- Funciones auxiliares, triggers de integridad/auditoría y políticas RLS.
-- Ejecutar DESPUÉS de 01_schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funciones auxiliares (SECURITY DEFINER: leen tablas sin disparar RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_institution_id() returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.has_any_role(_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and p.status = 'active' and ur.role = any(_roles)
  )
$$;

create or replace function public.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array[_role])
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['superadmin']::public.app_role[])
$$;

-- Personal con lectura transversal: superadmin, directivo, secretaría
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['superadmin','directivo','secretaria']::public.app_role[])
$$;

create or replace function public.current_academic_year_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.academic_years
  where institution_id = public.current_institution_id() and is_current limit 1
$$;

create or replace function public.teaches_division(_division uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('docente') and exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid() and ta.division_id = _division)
$$;

create or replace function public.teaches_subject_in_division(_division uuid, _subject uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('docente') and exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid() and ta.division_id = _division and ta.subject_id = _subject)
$$;

create or replace function public.teaches_course(_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('docente') and exists (
    select 1 from public.teacher_assignments ta
    join public.divisions d on d.id = ta.division_id
    where ta.teacher_id = auth.uid() and d.course_id = _course)
$$;

create or replace function public.teaches_student(_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('docente') and exists (
    select 1 from public.enrollments e
    join public.teacher_assignments ta on ta.division_id = e.division_id
    where e.student_id = _student and ta.teacher_id = auth.uid()
      and e.academic_year_id = public.current_academic_year_id())
$$;

create or replace function public.is_guardian_of(_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('familia')
    and coalesce((select s.family_portal_enabled from public.institutional_settings s
                  where s.institution_id = public.current_institution_id()), false)
    and exists (select 1 from public.student_guardians g
                where g.student_id = _student and g.user_id = auth.uid())
$$;

create or replace function public.can_grade_assessment(_assessment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a
    where a.id = _assessment and a.institution_id = public.current_institution_id()
      and (public.is_superadmin() or public.teaches_subject_in_division(a.division_id, a.subject_id)))
$$;

create or replace function public.can_write_attendance(_division uuid, _subject uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['superadmin','secretaria']::public.app_role[])
    or (case when _subject is null then public.teaches_division(_division)
             else public.teaches_subject_in_division(_division, _subject) end)
$$;

create or replace function public.is_message_sender(_message uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.messages m where m.id = _message and m.sender_id = auth.uid())
$$;

create or replace function public.is_message_recipient(_message uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.message_recipients r where r.message_id = _message and r.user_id = auth.uid())
$$;

create or replace function public.same_institution_user(_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = _user and p.institution_id = public.current_institution_id() and p.status = 'active')
$$;

-- ---------------------------------------------------------------------
-- 2. Triggers de integridad (la base valida, no solo el frontend)
-- ---------------------------------------------------------------------

-- 2.1 Superposición de horarios: docente, aula y curso
create or replace function public.check_schedule_overlap() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.schedules s
             where s.id is distinct from new.id and s.academic_year_id = new.academic_year_id
               and s.weekday = new.weekday and s.teacher_id = new.teacher_id
               and s.start_time < new.end_time and s.end_time > new.start_time) then
    raise exception 'CONFLICTO_HORARIO: el docente ya tiene otra clase en ese día y horario' using errcode = '23P01';
  end if;
  if new.classroom_id is not null and exists (select 1 from public.schedules s
             where s.id is distinct from new.id and s.academic_year_id = new.academic_year_id
               and s.weekday = new.weekday and s.classroom_id = new.classroom_id
               and s.start_time < new.end_time and s.end_time > new.start_time) then
    raise exception 'CONFLICTO_HORARIO: el aula ya está asignada en ese día y horario' using errcode = '23P01';
  end if;
  if exists (select 1 from public.schedules s
             where s.id is distinct from new.id and s.academic_year_id = new.academic_year_id
               and s.weekday = new.weekday and s.division_id = new.division_id
               and s.start_time < new.end_time and s.end_time > new.start_time) then
    raise exception 'CONFLICTO_HORARIO: el curso ya tiene otra materia en ese día y horario' using errcode = '23P01';
  end if;
  return new;
end $$;
create trigger schedules_overlap before insert or update on public.schedules
  for each row execute function public.check_schedule_overlap();

-- 2.2 Validación de notas contra la escala y la inscripción del alumno
create or replace function public.validate_grade() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.assessments%rowtype; s public.grading_scales%rowtype;
begin
  select * into a from public.assessments where id = new.assessment_id;
  if not found then raise exception 'La evaluación no existe'; end if;
  select * into s from public.grading_scales where id = a.grading_scale_id;
  new.institution_id := a.institution_id;
  if not exists (select 1 from public.enrollments e
                 where e.student_id = new.student_id and e.division_id = a.division_id and e.status <> 'baja') then
    raise exception 'El alumno no está inscripto en el curso de esta evaluación' using errcode = '23514';
  end if;
  if s.kind = 'numerica' then
    if new.concept_value is not null then raise exception 'Esta escala es numérica' using errcode = '23514'; end if;
    if new.numeric_value is not null and (new.numeric_value < s.min_value or new.numeric_value > s.max_value) then
      raise exception 'La nota debe estar entre % y %', s.min_value, s.max_value using errcode = '23514';
    end if;
  else
    if new.numeric_value is not null then raise exception 'Esta escala es conceptual' using errcode = '23514'; end if;
    if new.concept_value is not null and not exists (
         select 1 from jsonb_array_elements(s.concepts) c where c->>'label' = new.concept_value) then
      raise exception 'El concepto no pertenece a la escala' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is not null then new.graded_by := auth.uid(); end if;
  return new;
end $$;
create trigger grades_validate before insert or update on public.grades
  for each row execute function public.validate_grade();

-- 2.3 Historial de modificaciones de calificaciones
create or replace function public.log_grade_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or old.numeric_value is distinct from new.numeric_value
     or old.concept_value is distinct from new.concept_value then
    insert into public.grade_history(institution_id, grade_id, assessment_id, student_id,
      old_numeric, new_numeric, old_concept, new_concept, changed_by)
    values (new.institution_id, new.id, new.assessment_id, new.student_id,
      case when tg_op = 'UPDATE' then old.numeric_value end, new.numeric_value,
      case when tg_op = 'UPDATE' then old.concept_value end, new.concept_value, auth.uid());
  end if;
  return new;
end $$;
create trigger grades_history after insert or update on public.grades
  for each row execute function public.log_grade_change();

-- 2.4 Asistencia: registra quién cargó el dato
create or replace function public.attendance_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then new.recorded_by := auth.uid(); end if;
  return new;
end $$;
create trigger attendance_stamp before insert or update on public.attendance
  for each row execute function public.attendance_stamp();

-- 2.5 Perfiles: un usuario común no puede cambiar su institución ni su estado
create or replace function public.protect_profile_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_superadmin() then
    if new.id <> old.id or new.institution_id <> old.institution_id or new.status <> old.status then
      raise exception 'No tenés permiso para modificar esos campos' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- 2.6 Notificación automática al recibir un mensaje
create or replace function public.notify_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select institution_id, sender_name, subject, kind into m from public.messages where id = new.message_id;
  insert into public.notifications(institution_id, user_id, title, body, link)
  values (m.institution_id, new.user_id,
          case when m.kind = 'comunicado' then 'Nuevo comunicado' else 'Nuevo mensaje' end,
          coalesce(m.subject, 'De ' || m.sender_name), '/mensajes');
  return new;
end $$;
create trigger message_recipients_notify after insert on public.message_recipients
  for each row execute function public.notify_on_message();

-- 2.7 Auditoría genérica (la información médica se registra SIN contenido)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare _old jsonb; _new jsonb; _row jsonb; _inst uuid;
begin
  _old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  _new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  _row := coalesce(_new, _old);
  if tg_table_name = 'student_medical_information' then _old := null; _new := null; end if;
  begin _inst := (_row->>'institution_id')::uuid; exception when others then _inst := null; end;
  insert into public.audit_logs(institution_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (_inst, auth.uid(), tg_op, tg_table_name, coalesce(_row->>'id', _row->>'student_id'), _old, _new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['institutions','institutional_settings','profiles','user_roles','students',
    'student_guardians','student_medical_information','student_accommodations','enrollments',
    'attendance','attendance_justifications','assessments','grades','teacher_assignments','schedules',
    'grading_scales','academic_years','divisions']
  loop
    execute format('create trigger audit_row after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Endurecimiento: el rol anónimo no accede a nada del esquema público
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- 3.1 Institución y configuración
create policy institutions_select on public.institutions for select to authenticated
  using (id = public.current_institution_id());
create policy institutions_update on public.institutions for update to authenticated
  using (id = public.current_institution_id() and public.is_superadmin())
  with check (id = public.current_institution_id() and public.is_superadmin());

create policy settings_select on public.institutional_settings for select to authenticated
  using (institution_id = public.current_institution_id());
create policy settings_update on public.institutional_settings for update to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin())
  with check (institution_id = public.current_institution_id() and public.is_superadmin());

-- 3.2 Perfiles y roles
create policy profiles_select on public.profiles for select to authenticated
  using (institution_id = public.current_institution_id()
         and (id = auth.uid() or not public.has_role('familia')));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin())
  with check (institution_id = public.current_institution_id() and public.is_superadmin());
-- Altas y bajas de perfiles: solo vía Edge Function (service role)

create policy user_roles_select on public.user_roles for select to authenticated
  using (institution_id = public.current_institution_id()
         and (user_id = auth.uid() or public.has_any_role(array['superadmin','directivo']::public.app_role[])));
create policy user_roles_write on public.user_roles for all to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin())
  with check (institution_id = public.current_institution_id() and public.is_superadmin());

-- 3.3 Estructura académica: lectura para la institución, escritura solo superadmin
do $$
declare t text;
begin
  foreach t in array array['academic_years','academic_periods','shifts','courses','divisions',
                           'subjects','classrooms','grading_scales','resources']
  loop
    execute format('create policy %I on public.%I for select to authenticated
                    using (institution_id = public.current_institution_id())', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (institution_id = public.current_institution_id() and public.is_superadmin())
                    with check (institution_id = public.current_institution_id() and public.is_superadmin())',
                    t || '_write', t);
  end loop;
end $$;

create policy teacher_assignments_select on public.teacher_assignments for select to authenticated
  using (institution_id = public.current_institution_id() and (public.is_staff() or teacher_id = auth.uid()));
create policy teacher_assignments_write on public.teacher_assignments for all to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin())
  with check (institution_id = public.current_institution_id() and public.is_superadmin());

create policy schedules_select on public.schedules for select to authenticated
  using (institution_id = public.current_institution_id());
create policy schedules_write on public.schedules for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo']::public.app_role[]));

-- 3.4 Alumnos
create policy students_select on public.students for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(id) or public.is_guardian_of(id)));
create policy students_insert on public.students for insert to authenticated
  with check (institution_id = public.current_institution_id()
              and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));
create policy students_update on public.students for update to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));
create policy students_delete on public.students for delete to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin());

create policy guardians_select on public.student_guardians for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id) or user_id = auth.uid()));
create policy guardians_write on public.student_guardians for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));

-- Información médica: NO accesible para docentes ni familias desde la API directa
create policy medical_select on public.student_medical_information for select to authenticated
  using (institution_id = public.current_institution_id() and public.is_staff());
create policy medical_write on public.student_medical_information for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));

create policy accommodations_select on public.student_accommodations for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id) or public.is_guardian_of(student_id)));
create policy accommodations_write on public.student_accommodations for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria','directivo']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria','directivo']::public.app_role[]));

create policy enrollments_select on public.enrollments for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id) or public.is_guardian_of(student_id)));
create policy enrollments_write on public.enrollments for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria']::public.app_role[]));

-- 3.5 Asistencia
create policy attendance_select on public.attendance for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_division(division_id) or public.is_guardian_of(student_id)));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (institution_id = public.current_institution_id()
              and public.can_write_attendance(division_id, subject_id));
create policy attendance_update on public.attendance for update to authenticated
  using (institution_id = public.current_institution_id() and public.can_write_attendance(division_id, subject_id))
  with check (institution_id = public.current_institution_id() and public.can_write_attendance(division_id, subject_id));
create policy attendance_delete on public.attendance for delete to authenticated
  using (institution_id = public.current_institution_id() and public.is_superadmin());

create policy justifications_select on public.attendance_justifications for select to authenticated
  using (institution_id = public.current_institution_id()
         and exists (select 1 from public.attendance a where a.id = attendance_id));
create policy justifications_insert on public.attendance_justifications for insert to authenticated
  with check (institution_id = public.current_institution_id()
              and public.has_any_role(array['superadmin','secretaria','docente']::public.app_role[])
              and exists (select 1 from public.attendance a where a.id = attendance_id));
create policy justifications_update on public.attendance_justifications for update to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria','directivo']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','secretaria','directivo']::public.app_role[]));

create policy teacher_attendance_select on public.teacher_attendance for select to authenticated
  using (institution_id = public.current_institution_id() and (public.is_staff() or teacher_id = auth.uid()));
create policy teacher_attendance_write on public.teacher_attendance for all to authenticated
  using (institution_id = public.current_institution_id() and public.is_staff())
  with check (institution_id = public.current_institution_id() and public.is_staff());

-- 3.6 Calificaciones
create policy assessments_select on public.assessments for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_division(division_id)));
create policy assessments_write on public.assessments for all to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_superadmin() or public.teaches_subject_in_division(division_id, subject_id)))
  with check (institution_id = public.current_institution_id()
         and (public.is_superadmin() or public.teaches_subject_in_division(division_id, subject_id)));

create policy grades_select on public.grades for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.can_grade_assessment(assessment_id) or public.is_guardian_of(student_id)));
create policy grades_write on public.grades for all to authenticated
  using (public.can_grade_assessment(assessment_id))
  with check (public.can_grade_assessment(assessment_id));

create policy grade_history_select on public.grade_history for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.can_grade_assessment(assessment_id)));

-- 3.7 Contenido pedagógico y IA (propiedad del docente)
do $$
declare t text;
begin
  foreach t in array array['planning_documents','generated_assessments','text_adaptations','flashcard_decks']
  loop
    execute format('create policy %I on public.%I for all to authenticated
      using (institution_id = public.current_institution_id() and owner_id = auth.uid()
             and public.has_any_role(array[''superadmin'',''directivo'',''docente'']::public.app_role[]))
      with check (institution_id = public.current_institution_id() and owner_id = auth.uid()
             and public.has_any_role(array[''superadmin'',''directivo'',''docente'']::public.app_role[]))',
      t || '_owner', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (institution_id = public.current_institution_id()
             and public.has_any_role(array[''superadmin'',''directivo'']::public.app_role[]))',
      t || '_supervision', t);
  end loop;
end $$;

create policy flashcards_owner on public.flashcards for all to authenticated
  using (institution_id = public.current_institution_id()
         and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = auth.uid()))
  with check (institution_id = public.current_institution_id()
         and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = auth.uid()));
create policy flashcards_supervision on public.flashcards for select to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo']::public.app_role[]));

create policy early_alerts_select on public.early_warning_alerts for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id)));
create policy early_alerts_update on public.early_warning_alerts for update to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id)))
  with check (institution_id = public.current_institution_id()
         and (public.is_staff() or public.teaches_student(student_id)));
-- Las alertas solo se crean desde Edge Functions (service role). Los usuarios solo pueden cambiar su estado.
revoke update on public.early_warning_alerts from authenticated;
grant update (status, reviewed_by) on public.early_warning_alerts to authenticated;

create policy materials_select on public.educational_materials for select to authenticated
  using (institution_id = public.current_institution_id()
         and (owner_id = auth.uid()
              or public.has_any_role(array['superadmin','directivo']::public.app_role[])
              or (shared and public.has_role('docente'))));
create policy materials_insert on public.educational_materials for insert to authenticated
  with check (institution_id = public.current_institution_id() and owner_id = auth.uid()
              and public.has_any_role(array['superadmin','directivo','secretaria','docente']::public.app_role[]));
create policy materials_update on public.educational_materials for update to authenticated
  using (institution_id = public.current_institution_id() and (owner_id = auth.uid() or public.is_superadmin()))
  with check (institution_id = public.current_institution_id() and (owner_id = auth.uid() or public.is_superadmin()));
create policy materials_delete on public.educational_materials for delete to authenticated
  using (institution_id = public.current_institution_id() and (owner_id = auth.uid() or public.is_superadmin()));

-- 3.8 Calendario y reservas
create policy events_select on public.calendar_events for select to authenticated
  using (institution_id = public.current_institution_id()
         and (public.is_staff() or scope = 'institucion'
              or (scope = 'docente' and teacher_id = auth.uid())
              or (scope = 'curso' and public.teaches_course(course_id))));
create policy events_write on public.calendar_events for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo','secretaria']::public.app_role[]))
  with check (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo','secretaria']::public.app_role[]));

create policy reservations_select on public.resource_reservations for select to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo','secretaria','docente']::public.app_role[]));
create policy reservations_insert on public.resource_reservations for insert to authenticated
  with check (institution_id = public.current_institution_id() and reserved_by = auth.uid()
              and public.has_any_role(array['superadmin','directivo','secretaria','docente']::public.app_role[]));
create policy reservations_update on public.resource_reservations for update to authenticated
  using (institution_id = public.current_institution_id()
         and (reserved_by = auth.uid() or public.has_any_role(array['superadmin','directivo']::public.app_role[])))
  with check (institution_id = public.current_institution_id()
         and (reserved_by = auth.uid() or public.has_any_role(array['superadmin','directivo']::public.app_role[])));
create policy reservations_delete on public.resource_reservations for delete to authenticated
  using (institution_id = public.current_institution_id()
         and (reserved_by = auth.uid() or public.is_superadmin()));

-- 3.9 Mensajería y notificaciones
create policy messages_select on public.messages for select to authenticated
  using (institution_id = public.current_institution_id()
         and (sender_id = auth.uid() or public.is_message_recipient(id)));
create policy messages_insert on public.messages for insert to authenticated
  with check (institution_id = public.current_institution_id() and sender_id = auth.uid()
              and public.has_any_role(array['superadmin','directivo','secretaria','docente']::public.app_role[])
              and (kind <> 'comunicado'
                   or public.has_any_role(array['superadmin','directivo','secretaria']::public.app_role[])));

create policy recipients_select on public.message_recipients for select to authenticated
  using (user_id = auth.uid() or public.is_message_sender(message_id));
create policy recipients_insert on public.message_recipients for insert to authenticated
  with check (public.is_message_sender(message_id) and public.same_institution_user(user_id));
create policy recipients_update on public.message_recipients for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.message_recipients from authenticated;
grant update (read_at) on public.message_recipients to authenticated;

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 3.10 Auditoría: solo lectura para superadmin y directivo
create policy audit_select on public.audit_logs for select to authenticated
  using (institution_id = public.current_institution_id()
         and public.has_any_role(array['superadmin','directivo']::public.app_role[]));

-- ---------------------------------------------------------------------
-- 4. Realtime para mensajería
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.message_recipients;
  alter publication supabase_realtime add table public.notifications;
exception when others then
  raise notice 'No se pudo configurar Realtime automáticamente: habilitalo desde Database > Replication.';
end $$;
