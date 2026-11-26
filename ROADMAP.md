# Registro de entrega y pendientes

## Etapa 1 — Base (ENTREGADA)
| Área | Archivos | Estado de verificación |
|---|---|---|
| Esquema BD | `supabase/sql/01_schema.sql` | **No ejecutado** (no había PostgreSQL disponible). Revisado a mano. |
| Seguridad / RLS / triggers / auditoría | `supabase/sql/02_security.sql` | **No ejecutado.** Revisado a mano. |
| Storage | `supabase/sql/03_storage.sql` | **No ejecutado.** |
| Primer superadmin | `supabase/sql/04_bootstrap.sql` | **No ejecutado.** |
| Edge Function usuarios | `supabase/functions/admin-users`, `_shared/*` | **No ejecutada ni desplegada.** |
| Frontend base | `src/**`, config Vite/Tailwind/TS | **No compilado** (sin acceso a npm). Solo se comprobó que no hay errores de sintaxis. |
| Pruebas unitarias | `src/lib/*.test.ts` | La lógica se ejecutó con Node y pasó; **no con Vitest**. |
| Despliegue | `.github/workflows/deploy.yml`, `public/404.html` | **No ejecutado.** |

## Etapa 2 — Módulos académicos (PENDIENTE)
Estructura académica (cursos, divisiones, materias, aulas, asignaciones), alumnos (CRUD, perfil, tutores, ficha médica, importación Excel/CSV con validación), inscripciones, asistencia, justificaciones (con archivos), libro de calificaciones, horarios con detección de conflictos. Incluye pruebas SQL de RLS.

## Etapa 3 — Inteligencia artificial (PENDIENTE)
Edge Functions de IA (planificaciones, evaluaciones, adaptación de textos, flashcards, alertas tempranas), lectura de PDF/Word/imágenes, editor y exportación.

## Etapa 4 — Comunicación y recursos (PENDIENTE)
Repositorio de materiales, calendario, reservas, mensajería con Realtime, notificaciones.

## Etapa 5 — Reportes y cierre (PENDIENTE)
Dashboard directivo con filtros, PDF (boletines, certificados, informes), portal de familias, auditoría visible, revisión final y pruebas.
