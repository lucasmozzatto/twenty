#!/usr/bin/env bash
# Sobe o n8n (automações) ao lado do Twenty neste mesmo VPS.
# Rodar como root, DEPOIS de apontar o DNS de n8n.petbeetools.com.br para cá.
# Uso: bash petbee/deploy/add-n8n.sh   (de qualquer pasta)
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Rode primeiro o bootstrap.sh (não achei o .env)." >&2
  exit 1
fi

echo "==> Garantindo as variáveis do n8n no .env…"
grep -q '^N8N_DOMAIN=' .env || echo 'N8N_DOMAIN=n8n.petbeetools.com.br' >> .env
# A chave cifra as credenciais salvas dentro do n8n (WhatsApp, Twenty, etc.).
# É gerada UMA vez e nunca deve mudar — mudar = recadastrar tudo.
grep -q '^N8N_ENCRYPTION_KEY=' .env \
  || echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

echo "==> Criando o banco próprio do n8n no Postgres (se ainda não existir)…"
if ! docker compose exec -T db psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='n8n'" | grep -q 1; then
  docker compose exec -T db psql -U postgres -c 'CREATE DATABASE n8n' > /dev/null
  echo "    banco n8n criado ✓"
else
  echo "    banco n8n já existia ✓"
fi

echo "==> Baixando e subindo o n8n…"
docker compose pull n8n
docker compose up -d n8n
# Recria o Caddy para ele enxergar o novo domínio e emitir o certificado
docker compose up -d --force-recreate caddy

DOMAIN=$(grep '^N8N_DOMAIN=' .env | cut -d= -f2-)
echo
echo "Pronto! Abra https://${DOMAIN} e crie AGORA a conta de dono (o primeiro"
echo "acesso define quem manda na instância). Acompanhe com:"
echo "  docker compose logs -f n8n"
