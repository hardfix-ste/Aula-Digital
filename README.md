# Aula Digital
Gestión escolar para docentes: alumnos (CSV), asistencia, notas con promedios, horarios sin superposición, herramientas de IA, materiales, alertas tempranas y panel.

## Probar local
```bash
npm install
npm start              # abrí http://localhost:3000
```
No hace falta ningún archivo `.env`. La primera vez la web te pide crear tu cuenta de administrador. Después, en **Mi cuenta** podés cambiar tu contraseña y cargar la clave de la IA. Desde **Usuarios** creás a los docentes.

## Publicar (GitHub no ejecuta servidores)
Subí el repo a GitHub y conectalo a Render/Railway/Fly (Web Service, `npm install` / `npm start`). Cargá las variables del `.env` en el panel y agregá un disco persistente para `DB_PATH` (ej. `/data/data.db`).

## Más fácil
- **En tu computadora:** instalá Node.js y hacé doble clic en `iniciar.bat` (Windows) o `iniciar.command` (Mac).
- **En internet con Render:** New → Blueprint → elegí tu repositorio. Usa `render.yaml`, que ya incluye un disco para que no se pierdan los datos (plan pago, aprox. USD 7/mes).
