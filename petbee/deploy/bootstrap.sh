#!/usr/bin/env bash
# Instalação do Twenty (CRM Petbee) num VPS Ubuntu limpo.
# Uso: bash bootstrap.sh   (dentro de petbee/deploy, como root)
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Instalando Docker e utilitários…"
if ! command -v docker > /dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get update -qq && apt-get install -y -qq ufw curl openssl > /dev/null

echo "==> Configurando firewall (SSH, HTTP, HTTPS)…"
ufw allow OpenSSH > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null

if [ ! -f .env ]; then
  echo "==> Gerando .env com segredos aleatórios…"
  cp env.example .env
  sed -i "s|^PG_DATABASE_PASSWORD=.*|PG_DATABASE_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')|" .env
  sed -i "s|^APP_SECRET=.*|APP_SECRET=$(openssl rand -base64 32 | tr -d '\n')|" .env
else
  echo "==> .env já existe — mantido como está."
fi

echo "==> Subindo a stack (server, worker, Postgres, Redis, Caddy)…"
docker compose pull
docker compose up -d

echo "==> Instalando backup diário (03:30, guarda 14 dias em /opt/twenty-backups)…"
chmod +x backup.sh
CRON_LINE="30 3 * * * $(pwd)/backup.sh >> /var/log/twenty-backup.log 2>&1"
(crontab -l 2> /dev/null | grep -v twenty-backup; echo "$CRON_LINE") | crontab -

echo
echo "Pronto! Acompanhe a subida com: docker compose logs -f server"
echo "Quando o DNS do domínio apontar para este servidor, o HTTPS ativa sozinho."
