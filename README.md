# Aula Digital
Gestión escolar para docentes: alumnos (CSV), asistencia, notas con promedios, horarios sin superposición, herramientas de IA, materiales, alertas tempranas y panel.

## Probar local
```bash
npm install
cp .env.example .env   # editá JWT_SECRET, ADMIN_PASS y ANTHROPIC_API_KEY
npm start              # http://localhost:3000
```
Primer ingreso: usuario/clave de `ADMIN_USER`/`ADMIN_PASS`. Desde "Usuarios" creás a los docentes.

## Publicar (GitHub no ejecuta servidores)
Subí el repo a GitHub y conectalo a Render/Railway/Fly (Web Service, `npm install` / `npm start`). Cargá las variables del `.env` en el panel y agregá un disco persistente para `DB_PATH` (ej. `/data/data.db`).
