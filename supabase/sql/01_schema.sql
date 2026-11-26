-- =====================================================================
-- AULA DIGITAL · 01_schema.sql
-- Esquema completo: tipos, tablas, relaciones, índices y restricciones.
-- Ejecutar PRIMERO, en un proyecto Supabase nuevo (SQL Editor).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist with schema extensions;

-- ---------- Tipos ----------
create type public.app_role as enum ('superadmin','directivo','secretaria','docente','familia');
create type public.user_status as enum ('active','suspended');
create type public.student_status as enum ('activo','baja','egresado','pase');
create type public.enrollment_status as enum ('inscripto','condicional','baja','promovido','repitente');
create type public.attendance_status as enum ('presente','ausente','tardanza','retiro_anticipado');
create type public.justification_status as enum ('pendiente','aprobada','rechazada');
create type public.scale_kind as enum ('numerica','conceptual');
create type public.assessment_kind as enum ('examen','trabajo_practico','oral','concepto','recuperatorio','otro');
create type public.event_kind as enum ('feriado','acto','reunion','mesa_examen','jornada','entrega','especial');
create type public.event_scope as enum ('institucion','curso','docente');
create type public.message_kind as enum ('individual','grupal','comunicado');
create type public.reservation_status as enum ('confirmada','cancelada');
create type public.alert_severity as enum ('baja','media','alta');
create type public.alert_status as enum ('nueva','en_seguimiento','descartada','resuelta');
create type public.teacher_attendance_status as enum ('presente','ausente','tardanza','licencia');

-- ---------- Utilidades ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Institución ----------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  cue text,
  cuit text,
  address text,
  city text,
  phone text,
  email text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institutional_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  attendance_mode text not null default 'diaria' check (attendance_mode in ('diaria','por_materia')),
  absence_alert_percent numeric(5,2) not null default 20 check (absence_alert_percent between 0 and 100),
  absence_alert_count integer not null default 15 check (absence_alert_count >= 0),
  family_portal_enabled boolean not null default false,
  ai_enabled boolean not null default false,
  ai_provider text not null default 'anthropic' check (ai_provider in ('anthropic','openai','google')),
  ai_model text,
  document_types jsonb not null default '["boletin","certificado_alumno_regular","reporte_desempeno","informe_asistencia","listado_alumnos","planificacion","evaluacion"]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Usuarios y roles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  dni text,
  phone text,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_institution_idx on public.profiles(institution_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles(user_id);

-- ---------- Estructura académica ----------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (institution_id, year)
);
create unique index academic_years_one_current on public.academic_years(institution_id) where is_current;

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  position smallint not null default 1,
  check (ends_on > starts_on),
  unique (academic_year_id, name)
);
create index academic_periods_year_idx on public.academic_periods(academic_year_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  unique (institution_id, name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,                -- ej. "1° año", "5° grado"
  level text,                        -- Inicial / Primario / Secundario / Terciario
  position smallint not null default 1,
  unique (institution_id, name)
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  shift_id uuid references public.shifts(id) on delete set null,
  name text not null,                -- ej. "A", "B"
  tutor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, academic_year_id, name)
);
create index divisions_institution_idx on public.divisions(institution_id);
create index divisions_year_idx on public.divisions(academic_year_id);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  unique (institution_id, name)
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  capacity integer check (capacity is null or capacity > 0),
  unique (institution_id, name)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, division_id, subject_id)
);
create index teacher_assignments_teacher_idx on public.teacher_assignments(teacher_id);
create index teacher_assignments_division_idx on public.teacher_assignments(division_id);

-- ---------- Alumnos ----------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  dni text not null check (dni ~ '^[0-9]{6,9}$'),
  birth_date date,
  address text,
  phone text,
  email text,
  admission_date date,
  status public.student_status not null default 'activo',
  pedagogical_notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, dni)
);
create index students_name_idx on public.students(institution_id, lower(last_name), lower(first_name));
create index students_status_idx on public.students(institution_id, status);

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null, -- vínculo con portal de familias
  full_name text not null,
  relationship text,
  dni text,
  phone text,
  emergency_phone text,
  email text,
  is_primary boolean not null default false
);
create index student_guardians_student_idx on public.student_guardians(student_id);
create index student_guardians_user_idx on public.student_guardians(user_id);

create table public.student_medical_information (
  student_id uuid primary key references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  allergies text,
  conditions text,
  medication text,
  health_insurance text,
  emergency_notes text,
  updated_at timestamptz not null default now()
);

create table public.student_accommodations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index student_accommodations_student_idx on public.student_accommodations(student_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  status public.enrollment_status not null default 'inscripto',
  enrolled_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index enrollments_division_idx on public.enrollments(division_id);
create index enrollments_student_idx on public.enrollments(student_id);

-- ---------- Asistencia ----------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  date date not null,
  status public.attendance_status not null,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un registro por alumno/fecha/materia (materia nula = asistencia diaria)
create unique index attendance_unique_idx
  on public.attendance(student_id, date, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index attendance_division_date_idx on public.attendance(division_id, date);
create index attendance_student_idx on public.attendance(student_id, date);

create table public.attendance_justifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  reason text not null,
  file_path text,
  status public.justification_status not null default 'pendiente',
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index attendance_justifications_att_idx on public.attendance_justifications(attendance_id);

create table public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  status public.teacher_attendance_status not null,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  unique (teacher_id, date)
);

-- ---------- Calificaciones ----------
create table public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  kind public.scale_kind not null,
  min_value numeric(5,2),
  max_value numeric(5,2),
  passing_value numeric(5,2),
  decimals smallint not null default 0 check (decimals between 0 and 2),
  concepts jsonb,   -- [{"label":"Muy bueno","value":9}, ...] para escala conceptual
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (institution_id, name),
  check (kind <> 'numerica' or (min_value is not null and max_value is not null and max_value > min_value)),
  check (kind <> 'conceptual' or concepts is not null)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  academic_period_id uuid references public.academic_periods(id) on delete set null,
  grading_scale_id uuid not null references public.grading_scales(id) on delete restrict,
  title text not null,
  kind public.assessment_kind not null default 'examen',
  weight numeric(6,2) not null default 1 check (weight > 0),
  date date,
  recovers_assessment_id uuid references public.assessments(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index assessments_division_subject_idx on public.assessments(division_id, subject_id);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  numeric_value numeric(5,2),
  concept_value text,
  notes text,
  graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index grades_student_idx on public.grades(student_id);

create table public.grade_history (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  grade_id uuid not null,
  assessment_id uuid,
  student_id uuid,
  old_numeric numeric(5,2),
  new_numeric numeric(5,2),
  old_concept text,
  new_concept text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index grade_history_grade_idx on public.grade_history(grade_id);

-- ---------- Horarios ----------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  weekday smallint not null check (weekday between 1 and 6),  -- 1 = lunes
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index schedules_teacher_idx on public.schedules(teacher_id, weekday);
create index schedules_division_idx on public.schedules(division_id, weekday);
create index schedules_classroom_idx on public.schedules(classroom_id, weekday);

-- ---------- Contenido pedagógico / IA ----------
create table public.planning_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  topic text,
  params jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_documents_owner_idx on public.planning_documents(owner_id);

create table public.generated_assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  planning_id uuid references public.planning_documents(id) on delete set null,
  title text not null,
  kind text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  params jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generated_assessments_owner_idx on public.generated_assessments(owner_id);

create table public.text_adaptations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  mode text not null,
  original_text text not null,
  adapted_text text not null,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index text_adaptations_owner_idx on public.text_adaptations(owner_id);

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic text,
  created_at timestamptz not null default now()
);
create index flashcard_decks_owner_idx on public.flashcard_decks(owner_id);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null,
  back text not null,
  image_path text,
  position integer not null default 0
);
create index flashcards_deck_idx on public.flashcards(deck_id);

create table public.early_warning_alerts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null,                       -- descenso_notas | inasistencias | bajo_rendimiento | recurrente
  severity public.alert_severity not null default 'baja',
  evidence jsonb not null default '{}'::jsonb,
  explanation text,                         -- orientativo, generado con IA
  suggestions text,
  status public.alert_status not null default 'nueva',
  generated_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null
);
create index early_warning_student_idx on public.early_warning_alerts(student_id);
create index early_warning_status_idx on public.early_warning_alerts(institution_id, status);

create table public.educational_materials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'documento',
  subject_id uuid references public.subjects(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  topic text,
  year integer,
  file_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  shared boolean not null default false,   -- visible para el resto del personal docente
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index educational_materials_owner_idx on public.educational_materials(owner_id);
create index educational_materials_filter_idx on public.educational_materials(institution_id, subject_id, course_id);

-- ---------- Calendario y reservas ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  description text,
  kind public.event_kind not null default 'especial',
  scope public.event_scope not null default 'institucion',
  course_id uuid references public.courses(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (scope <> 'curso' or course_id is not null),
  check (scope <> 'docente' or teacher_id is not null)
);
create index calendar_events_range_idx on public.calendar_events(institution_id, starts_at);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  kind text not null default 'espacio',
  active boolean not null default true,
  unique (institution_id, name)
);

create table public.resource_reservations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  reserved_by uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  purpose text,
  status public.reservation_status not null default 'confirmada',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Impide reservas superpuestas del mismo recurso (a nivel base de datos)
  constraint resource_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmada')
);
create index resource_reservations_range_idx on public.resource_reservations(resource_id, starts_at);

-- ---------- Mensajería ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  kind public.message_kind not null default 'individual',
  subject text,
  body text not null check (length(trim(body)) > 0),
  thread_id uuid,
  created_at timestamptz not null default now()
);
create index messages_sender_idx on public.messages(sender_id, created_at desc);
create index messages_thread_idx on public.messages(thread_id);

create table public.message_recipients (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index message_recipients_user_idx on public.message_recipients(user_id, read_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

-- ---------- Auditoría ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  institution_id uuid,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_inst_idx on public.audit_logs(institution_id, created_at desc);
create index audit_logs_table_idx on public.audit_logs(table_name, record_id);

-- ---------- Triggers updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['institutions','profiles','students','attendance','grades',
    'planning_documents','generated_assessments','educational_materials','student_medical_information','institutional_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
