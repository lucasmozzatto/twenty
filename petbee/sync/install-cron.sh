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
node sync-petbee-crm.mjs --test

# Cadência configurável via SYNC_CRON_SCHEDULE no .env (padrão: de hora em
# hora). Quando a fase de eventos estiver no ar, troque para diário de
# madrugada (ex.: "0 5 * * *") e rode este script de novo.
SCHEDULE=$(grep -E '^SYNC_CRON_SCHEDULE=' .env | cut -d= -f2- || true)
SCHEDULE=${SCHEDULE:-"0 * * * *"}

echo "==> Agendando cron (${SCHEDULE})…"
CRON_LINE="${SCHEDULE} cd $(pwd) && /usr/bin/env node sync-petbee-crm.mjs >> /var/log/twenty-sync.log 2>&1"
(crontab -l 2> /dev/null | grep -v sync-petbee-crm; echo "$CRON_LINE") | crontab -

echo
echo "Pronto. Primeira carga completa: node sync-petbee-crm.mjs --full"
echo "Acompanhar as rodadas automáticas: tail -f /var/log/twenty-sync.log"
