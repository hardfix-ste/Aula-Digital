# AULA DIGITAL

Plataforma de gestión educativa (React + Vite + TypeScript + Tailwind + Supabase), publicable en GitHub Pages.

> **Estado: Etapa 1 de 5.** Esta entrega contiene la base completa y segura del sistema.
> Ver [`ROADMAP.md`](./ROADMAP.md) para el detalle de lo que está hecho, lo que falta y qué se verificó realmente.

## Qué incluye la Etapa 1

- Base de datos completa (todas las tablas pedidas + extras), con índices, restricciones, triggers, auditoría y **RLS en todas las tablas**.
- Buckets de Storage con políticas (`materials`, `justifications`, `institution-assets`, `ai-sources`).
- Autenticación (login, recuperación y restablecimiento de contraseña) con sesión segura.
- Roles y permisos: superadministrador, directivo, secretaría, docente y familia.
- Gestión de usuarios (alta, edición, roles, suspensión, baja) mediante Edge Function con verificación de permisos en el servidor.
- Configuración institucional (datos, logo, asistencia, portal de familias, IA).
- Inicio con estadísticas reales y gráfico, modo claro/oscuro, diseño responsive.
- Despliegue automático en GitHub Pages.

---

## 1. Instalar dependencias

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 2. Crear el proyecto en Supabase

1. Entrá a https://supabase.com y creá un proyecto nuevo (guardá la contraseña de la base).
2. En **Project Settings > API** copiá:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_ANON_KEY`
3. Pegalos en `.env.local`. **No uses la `service_role` key en este archivo.**

## 3. Ejecutar el SQL

En **SQL Editor** ejecutá, **en este orden** y de a un archivo (pegar el contenido y "Run"):

1. `supabase/sql/01_schema.sql`
2. `supabase/sql/02_security.sql`
3. `supabase/sql/03_storage.sql`
4. `supabase/sql/04_bootstrap.sql`

Si algún script falla, copiá el mensaje de error completo y avisame: no sigas con el siguiente.

## 4. Buckets de Storage

`03_storage.sql` crea los buckets y sus políticas. Verificá en **Storage** que existan: `materials`, `justifications`, `institution-assets`, `ai-sources` (todos privados).

## 5. Autenticación

En **Authentication > URL Configuration**:

- **Site URL**: `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`
- **Redirect URLs**: agregá la misma URL (y `http://localhost:5173/` para desarrollo).

En **Authentication > Providers > Email**: dejá activado el correo/contraseña. Se recomienda **desactivar "Allow new users to sign up"** (las cuentas las crea el superadministrador).

## 6. Crear el primer superadministrador

1. **Authentication > Users > Add user > Create new user**: correo y contraseña (mínimo 10 caracteres), con **Auto Confirm User**.
2. En el **SQL Editor** ejecutá:

```sql
select public.bootstrap_superadmin('tu-correo@ejemplo.com', 'Nombre de tu institución', 'Nombre', 'Apellido');
```

Esto crea la institución, el ciclo lectivo actual, turnos, escalas de calificación (numérica 1-10 y conceptual) y tu perfil con rol superadministrador. Solo funciona una vez.

## 7. Edge Functions

Requisitos: [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set ALLOWED_ORIGIN=https://TU-USUARIO.github.io
supabase functions deploy admin-users
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente dentro de las funciones: no se copian a ningún archivo.

> Claves de proveedores de IA (a partir de la Etapa 3): se cargan **solo** con `supabase secrets set ANTHROPIC_API_KEY=...` (o la del proveedor elegido). Nunca en el frontend ni en GitHub.

## 8. Publicar en GitHub Pages

1. Creá un repositorio en GitHub y subí todos los archivos de esta carpeta a la rama `main`.
2. **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. **Settings > Secrets and variables > Actions > pestaña Variables > New repository variable**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Hacé un push (o ejecutá el workflow manualmente en la pestaña **Actions**). El sitio queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Notas técnicas de Pages:
- `vite.config.ts` toma la propiedad `base` de `VITE_BASE`, que el workflow define como `/NOMBRE-DEL-REPO/`.
- Las rutas de la aplicación y la recarga de páginas funcionan gracias a `public/404.html` (redirección a `index.html`). Si usás **dominio propio** o un repositorio `usuario.github.io`, cambiá `pathSegmentsToKeep` a `0` en `public/404.html` y definí `VITE_BASE=/`.
- El workflow usa `npm install` porque el proyecto aún no incluye `package-lock.json`. Cuando ejecutes `npm install` localmente por primera vez, subí también el `package-lock.json` generado y podés cambiar el workflow a `npm ci`.

## 9. Dar de alta docentes y otros usuarios

Ingresá como superadministrador > **Usuarios > Nuevo usuario**. Completá datos, generá una contraseña inicial, elegí uno o más roles y entregásela a la persona por un canal seguro. Puede cambiarla con "Olvidé mi contraseña".

Para **suspender** a alguien (conserva sus datos y bloquea el ingreso) usá el ícono de suspensión. Eliminar es irreversible y falla si la persona tiene datos asociados: en ese caso suspendé la cuenta.

## 10. Seguridad: decisiones a conocer

- La información médica (`student_medical_information`) solo la leen superadministrador, directivo y secretaría; solo la editan superadministrador y secretaría. Los docentes no la ven. Si la institución quiere que los docentes vean alergias de sus alumnos, se agrega una política específica (consultalo).
- Los docentes solo ven alumnos, asistencia y notas de las divisiones que tienen asignadas (`teacher_assignments`), verificado en la base.
- Las altas/bajas de usuarios y los cambios de rol solo se hacen por la Edge Function, que valida en el servidor que quien llama sea superadministrador.
- Toda modificación de tablas sensibles queda en `audit_logs` (la información médica se registra sin su contenido).
- Las claves privadas nunca están en el frontend.

## Pruebas

```bash
npm test
```
