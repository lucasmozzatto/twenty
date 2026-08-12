#!/usr/bin/env bash
# Instala o robô de sincronização no VPS: Node.js, dependências e cron a cada
# 30 minutos. Rodar dentro de petbee/sync, como root, DEPOIS de criar o .env.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Crie primeiro o arquivo .env (veja o README.md desta pasta)." >&2
  exit 1
fi

echo "==> Baixando certificado da Amazon RDS (para a conexão SSL)…"
curl -fsSL -o rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

echo "==> Instalando Node.js e dependências…"
command -v node > /dev/null 2>&1 || apt-get install -y -qq nodejs npm > /dev/null
npm install --omit=dev --silent

echo "==> Teste de conexão (sem gravar nada ainda)…"
node -e "
import('mysql2/promise').then(async ({default: mysql}) => {
  const fs = require('fs');
  const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split(/=(.*)/s).slice(0,2).map(s=>s.trim())));
  const db = await mysql.createConnection({ uri: env.PETBEE_MYSQL_URL, ssl: { ca: fs.readFileSync('rds-global-bundle.pem'), checkServerIdentity: () => undefined } });
  const [r] = await db.query('SELECT COUNT(*) AS n FROM humans');
  console.log('MySQL OK —', r[0].n, 'tutores visíveis');
  await db.end();
});"

echo "==> Agendando cron (a cada 30 minutos)…"
CRON_LINE="*/30 * * * * cd $(pwd) && /usr/bin/env node sync-petbee-crm.mjs >> /var/log/twenty-sync.log 2>&1"
(crontab -l 2> /dev/null | grep -v sync-petbee-crm; echo "$CRON_LINE") | crontab -

echo
echo "Pronto. Primeira carga completa: node sync-petbee-crm.mjs --full"
echo "Acompanhar as rodadas automáticas: tail -f /var/log/twenty-sync.log"
