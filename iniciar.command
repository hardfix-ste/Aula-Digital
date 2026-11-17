#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instala Node.js desde https://nodejs.org (LTS) y volve a abrir este archivo."; read; exit; }
[ -d node_modules ] || npm install
(sleep 2; open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000) &
npm start
