# Aula Digital — versión inicial

Plataforma educativa multiinstitucional. Esta entrega contiene el núcleo inicial:
inicio de sesión Supabase y gestión de instituciones para superadministración.

## Archivos
- `index.html`: aplicación web estática compatible con GitHub Pages.
- `database/schema.sql`: tablas iniciales y políticas RLS.

## 1. Configurar Supabase
1. Abrí el proyecto de Supabase.
2. En SQL Editor ejecutá `database/schema.sql` una sola vez.
3. En Authentication > Users creá tu usuario administrador.
4. En SQL Editor ejecutá, reemplazando el correo:

```sql
update auth.users
set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'super_admin')
where email = 'TU_CORREO@example.com';

select email, raw_app_meta_data
from auth.users
where email = 'TU_CORREO@example.com';
```

5. Cerrá sesión y volvé a iniciar para renovar el token.

## 2. Credenciales
La URL y la publishable key del proyecto están configuradas en `index.html`.
La publishable key está diseñada para el cliente, pero solo es segura junto con RLS.
Nunca agregues una `service_role` o secret key al frontend ni al repositorio.

## 3. Publicar en GitHub Pages
1. Subí `index.html` y la carpeta `database` a la raíz del repositorio.
2. En GitHub abrí Settings > Pages.
3. Elegí Deploy from a branch, rama `main`, carpeta `/ (root)`.
4. Guardá y esperá la publicación.

## Alcance y advertencias
Esta es una primera base administrativa, no el sistema escolar completo.
Todavía no incluye creación segura de administradores institucionales, alumnos,
asistencia, calificaciones, IA, portal familiar ni gestión de documentos.
No cargues datos reales de menores hasta completar y probar el modelo de permisos,
la gestión de usuarios, el almacenamiento privado, las copias de seguridad y la auditoría.
El SQL se debe ejecutar una sola vez; si ya creaste las tablas y políticas manualmente,
no vuelvas a ejecutarlo sin revisar el estado actual.
