@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Primero instala Node.js desde https://nodejs.org ^(version LTS^) y volve a abrir este archivo. & pause & exit /b)
if not exist node_modules call npm install
start "" http://localhost:3000
call npm start
pause
