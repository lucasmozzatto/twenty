#!/usr/bin/env bash
# Túnel SSH permanente do VPS até o MySQL (RDS) via bastion da Petbee.
# Mantido vivo pelo systemd + autossh; religa sozinho em queda ou reboot.
#
# Pré-requisitos no .env desta pasta:
#   BASTION_SSH=usuario@ip-ou-host-do-bastion
#   BASTION_PORT=22            (opcional)
# Chave SSH esperada em /root/.ssh/crm_tunnel (gerada com ssh-keygen).
#
# O túnel expõe o RDS em 127.0.0.1:3307 — use no .env:
#   PETBEE_MYSQL_URL=mysql://crm_sync:SENHA@127.0.0.1:3307/petbee
set -euo pipefail

cd "$(dirname "$0")"

RDS_HOST=petbeedb.cnwqqikeyx0p.us-east-1.rds.amazonaws.com
LOCAL_PORT=3307

BASTION_SSH=$(grep -E '^BASTION_SSH=' .env | cut -d= -f2- || true)
BASTION_PORT=$(grep -E '^BASTION_PORT=' .env | cut -d= -f2- || true)
BASTION_PORT=${BASTION_PORT:-22}

if [ -z "$BASTION_SSH" ]; then
  echo "Defina BASTION_SSH=usuario@host no arquivo .env desta pasta." >&2
  exit 1
fi
if [ ! -f /root/.ssh/crm_tunnel ]; then
  echo "Chave /root/.ssh/crm_tunnel não encontrada. Gere com:" >&2
  echo "  ssh-keygen -t ed25519 -f /root/.ssh/crm_tunnel -N '' -C crm-tunnel" >&2
  exit 1
fi

apt-get install -y -qq autossh > /dev/null

echo "==> Testando o acesso ao bastion…"
ssh -i /root/.ssh/crm_tunnel -p "$BASTION_PORT" -o StrictHostKeyChecking=accept-new \
  -o BatchMode=yes -o ConnectTimeout=10 "$BASTION_SSH" exit 2> /dev/null \
  || { echo "Não consegui autenticar no bastion — a chave pública já foi instalada lá?" >&2; exit 1; }

echo "==> Criando serviço do túnel (systemd)…"
cat > /etc/systemd/system/twenty-db-tunnel.service << EOF
[Unit]
Description=Tunel SSH ate o MySQL da Petbee (RDS) para o CRM
After=network-online.target
Wants=network-online.target

[Service]
Environment=AUTOSSH_GATETIME=0
ExecStart=/usr/bin/autossh -M 0 -N \\
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \\
  -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new \\
  -i /root/.ssh/crm_tunnel -p ${BASTION_PORT} \\
  -L 127.0.0.1:${LOCAL_PORT}:${RDS_HOST}:3306 ${BASTION_SSH}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now twenty-db-tunnel.service
sleep 3
systemctl is-active twenty-db-tunnel.service && echo "Túnel ativo: 127.0.0.1:${LOCAL_PORT} → ${RDS_HOST}:3306"
