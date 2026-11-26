-- =====================================================================
-- AULA DIGITAL · 04_bootstrap.sql
-- Creación del primer superadministrador + datos iniciales de la institución.
--
-- PASOS:
-- 1) Ejecutá este archivo (solo define la función).
-- 2) En Supabase: Authentication > Users > Add user (correo + contraseña,
--    marcá "Auto Confirm User").
-- 3) En el SQL Editor ejecutá:
--      select public.bootstrap_superadmin('tu-correo@ejemplo.com', 'Nombre de tu institución', 'Nombre', 'Apellido');
--
-- La función solo funciona UNA vez: si ya existe un superadministrador, falla.
-- No es invocable desde la API (permisos revocados): solo desde el SQL Editor.
-- =====================================================================

create or replace function public.bootstrap_superadmin(
  _email text,
  _institution_name text default 'Mi institución',
  _first_name text default 'Administrador',
  _last_name text default 'General'
) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  _uid uuid;
  _inst uuid;
  _year_id uuid;
  _y int := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::int;
begin
  if exists (select 1 from public.user_roles where role = 'superadmin') then
    raise exception 'Ya existe un superadministrador. Esta función solo puede usarse una vez.';
  end if;

  select id into _uid from auth.users where lower(email) = lower(_email);
  if _uid is null then
    raise exception 'No existe un usuario de Auth con el correo %. Crealo primero en Authentication > Users.', _email;
  end if;

  insert into public.institutions(name) values (_institution_name) returning id into _inst;
  insert into public.institutional_settings(institution_id) values (_inst);

  insert into public.profiles(id, institution_id, first_name, last_name)
  values (_uid, _inst, _first_name, _last_name);
  insert into public.user_roles(user_id, institution_id, role) values (_uid, _inst, 'superadmin');

  -- Ciclo lectivo actual (marzo a diciembre, editable luego en Configuración)
  insert into public.academic_years(institution_id, year, starts_on, ends_on, is_current)
  values (_inst, _y, make_date(_y, 3, 1), make_date(_y, 12, 20), true)
  returning id into _year_id;

  insert into public.academic_periods(institution_id, academic_year_id, name, starts_on, ends_on, position) values
    (_inst, _year_id, '1er trimestre', make_date(_y, 3, 1),  make_date(_y, 5, 31), 1),
    (_inst, _year_id, '2do trimestre', make_date(_y, 6, 1),  make_date(_y, 9, 15), 2),
    (_inst, _year_id, '3er trimestre', make_date(_y, 9, 16), make_date(_y, 12, 20), 3);

  insert into public.shifts(institution_id, name) values
    (_inst, 'Mañana'), (_inst, 'Tarde'), (_inst, 'Vespertino'), (_inst, 'Jornada completa');

  -- Escalas de calificación habituales en Argentina (editables)
  insert into public.grading_scales(institution_id, name, kind, min_value, max_value, passing_value, decimals, is_default)
  values (_inst, 'Numérica 1 a 10', 'numerica', 1, 10, 6, 0, true);
  insert into public.grading_scales(institution_id, name, kind, concepts, passing_value)
  values (_inst, 'Conceptual', 'conceptual',
    '[{"label":"Excelente","value":10},{"label":"Muy bueno","value":9},{"label":"Bueno","value":7},{"label":"Regular","value":5},{"label":"Insuficiente","value":3}]'::jsonb,
    6);

  return format('Listo: superadministrador %s creado para la institución "%s".', _email, _institution_name);
end $$;

revoke all on function public.bootstrap_superadmin(text, text, text, text) from public, anon, authenticated;
