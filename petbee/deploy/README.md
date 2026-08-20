# Twenty da Petbee num VPS — passo a passo

Este pacote sobe o CRM completo (Twenty + worker + Postgres + Redis) num VPS,
com HTTPS automático e backup diário. Feito para Ubuntu 22.04/24.04 limpo.

## 1. Contratar o VPS (Hostinger)

- Plano **KVM 2 ou superior** (mínimo 8 GB de RAM, 2 vCPUs, ~100 GB disco).
- Sistema: **Ubuntu 24.04 LTS puro** — sem painel (sem CloudPanel/CyberPanel;
  eles ocupariam as portas 80/443 que o CRM precisa).
- Datacenter: **Brasil (São Paulo)** se disponível — menor latência.
- Anote o **IP** do servidor e a senha de root (ou cadastre uma chave SSH).

## 2. Instalar (4 comandos no terminal do servidor)

Abra o terminal do VPS (a Hostinger tem "Terminal do navegador" no painel) e
cole, um por vez:

```bash
apt-get update && apt-get install -y git
git clone --depth 1 --branch claude/ajustar-finalizar-crm-u1g2lu https://github.com/lucasmozzatto/twenty.git /opt/twenty-repo
cd /opt/twenty-repo/petbee/deploy
bash bootstrap.sh
```

O bootstrap instala o Docker, configura o firewall, gera as senhas internas,
sobe os 5 serviços e agenda o backup diário (03:30, guarda 14 dias em
`/opt/twenty-backups`). Acompanhe a subida com
`docker compose logs -f server` (Ctrl+C para sair).

## 3. Apontar o domínio

No gerenciador de DNS do domínio `petbeetools.com.br`, edite o registro **A**
de `crm` para o IP do VPS. Em alguns minutos o Caddy emite o certificado
HTTPS sozinho e `https://crm.petbeetools.com.br` passa a abrir no VPS.

> Dica de transição suave: antes de trocar o DNS dá para testar acessando o
> IP direto? Não — o HTTPS depende do domínio. O caminho é: migrar o banco
> primeiro (passo 4), conferir pelos logs que subiu, e aí trocar o DNS.

## 4. Migrar os dados do Railway (a "mudança com os móveis")

O objetivo é levar o banco inteiro — objetos, campos, views, usuários,
registros — sem reinstalar nada.

1. No painel do Railway, abra o serviço **Postgres → aba Variables** e copie
   a `DATABASE_PUBLIC_URL` (começa com `postgres://…`).
2. No VPS, dentro de `/opt/twenty-repo/petbee/deploy`:

```bash
# puxa o dump direto do Railway (troque a URL pela copiada)
docker compose exec -T db pg_dump --version   # só para conferir que o db está de pé
docker run --rm postgres:16 pg_dump "postgres://URL_DO_RAILWAY" | gzip > /opt/railway-dump.sql.gz

# zera o banco local e restaura o dump
docker compose stop server worker
docker compose exec -T db psql -U postgres -d postgres -c "DROP DATABASE \"default\" WITH (FORCE); CREATE DATABASE \"default\";"
gunzip -c /opt/railway-dump.sql.gz | docker compose exec -T db psql -U postgres -d default
docker compose start server worker   # as migrações rodam sozinhas na subida
```

3. Confira `docker compose logs -f server` até ver o servidor pronto, então
   troque o DNS (passo 3). Faça login normalmente — tudo deve estar lá.
4. **Importante:** o `SERVER_URL` já é o mesmo domínio, então nada muda para
   quem usa. Mantenha o Railway ligado (sem mexer) por alguns dias como rede
   de segurança; depois cancele.

## 5. Depois da mudança

- **Atualizar o Twenty**: edite `TAG=` no `.env`, depois
  `docker compose pull && docker compose up -d`. Nunca use `latest`.
- **Backup para fora do servidor** (recomendado): instale o rclone
  (`curl https://rclone.org/install.sh | bash`), configure um destino
  (`rclone config` — Google Drive, por exemplo) e acrescente ao final do
  `backup.sh`: `rclone copy "$BACKUP_DIR" seudestino:twenty-backups`.
- **Restaurar um backup**: mesmo procedimento do passo 4, usando o arquivo
  de `/opt/twenty-backups` no lugar do dump do Railway.
- A API key do Twenty continua funcionando (ela vive no banco, que veio
  junto). O robô de sincronização no Retool não precisa de nenhuma mudança.
