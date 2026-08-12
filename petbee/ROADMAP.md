# Roadmap — CRM Petbee (Twenty)

Memória viva do projeto. Atualizado em 2026-08-12.

## Estado atual (feito ✅)

- **CRM em produção própria**: Twenty self-hosted em VPS Hostinger (KVM 2),
  `crm.petbeetools.com.br`, HTTPS automático (Caddy), firewall, backup diário
  03h30 (14 dias, `/opt/twenty-backups`), versão fixada via `TAG`.
- **Login**: Google SSO restrito a `@petbee.com.br` (app Interno no Google
  Cloud); login por senha desativado; workspace por convite.
- **Modelo**: Tutor (Person estendido) 1—N Pets 1—N Assinatura N—1 Plano,
  âncoras "ID Petbee" em tudo; catálogo de planos = `catalog.Plans`
  (Básico/Plus/Premium/Senior).
- **Base completa carregada e espelhada**: 7.731 tutores, 10.038 pets (992
  clones da origem deduplicados), 5.378 assinaturas (3.410 ativas), via robô
  em `petbee/sync` lendo a **réplica read-only** (Postgres do Retool DB,
  empurrada por DMS — nunca a produção). Cron de 1h (`SYNC_CRON_SCHEDULE`).
- **Enriquecimento**: aniversário e cidade/UF do tutor, falecido (227) e
  microchip do pet, addons/próxima cobrança/cortesia da assinatura.
- **Regras do robô**: upsert por âncora; adoção de leads por e-mail; dedup de
  pets clonados (prioridade: assinatura ativa); campos editados pelo time
  nunca são tocados; rate limit tratado com espera; linhas inválidas são
  puladas e reportadas, nunca travam a carga.
- Workflows de demonstração do Twenty removidos (um deles disparou 7.731
  execuções na carga).

## Próximas fases

### Migração do Bitrix24 (comercial) — em etapas
- **Fase 0 — Raio-X**: inventário do Bitrix via API (funis, etapas, negócios
  abertos, campos custom usados, leads puros) + inventário dos cenários do
  Make. Migra-se o que se usa, não o que se acumulou.
- **Fase 1 — Modelo comercial no Twenty**: Opportunities (kanban nativo) com
  as etapas dos funis, campos custom equivalentes, âncora `idBitrix` em
  negócio/empresa (Person já tem).
- **Fase 2 — Dados em lotes**: piloto de ~20 negócios → validação → base
  toda. Contatos entram pela adoção por e-mail (cliente Petbee existente se
  funde ao lead do funil — nunca duplica).
- **Fase 3 — Automações: matar o Make → n8n self-hosted**. Decisão: substituir
  o Make por estrutura própria open source (n8n), rodando no MESMO VPS
  (bloco a mais no `petbee/deploy/docker-compose.yml`, subdomínio próprio
  via Caddy). Cada cenário reconstruído no n8n já aponta para o Twenty —
  aposenta o cenário do Make e a dependência do Bitrix de uma vez. Make e
  n8n rodam em paralelo até cada cenário provar.
- **Fase 4 — Virada**: time vendendo no Twenty, Bitrix congelado, delta
  final, cancelar **Bitrix e Make**.

### Fase de eventos (com o dev — quando 1h de latência doer)
- EventBridge → Lambda (na VPC, lendo a réplica) → API do Twenty, só para os
  eventos que exigem minutos (assinatura bloqueada/cancelada, cliente novo).
- Cron relaxa para diário (madrugada) como reconciliador. Pauta discutida e
  aprovada em conceito; artefatos sob demanda.

## Pendências de manutenção

- **CTO**: trocar a senha da réplica (retool_db) de forma COORDENADA — a
  credencial passou por chats e o DMS pode usá-la; criar credencial
  somente-leitura dedicada ao CRM.
- **Trocar a API key do Twenty** usada pelo robô (passou por chat): criar
  nova → atualizar `.env` do VPS → revogar a antiga, nessa ordem.
- **Migrar este fork para `github.com/petbee`** (Settings → Transfer
  ownership; endereço antigo redireciona; ajustar remote no VPS).
- Backup externo dos dumps (rclone → Google Drive) ou snapshots Hostinger.
- Views do time (Clientes ativos, kanban de assinaturas, lista de
  reconquista com as 1.968 canceladas) e convites @petbee.com.br.
- Planilha dos 48 grupos de CPF duplicado (limpeza na origem) e aviso ao
  time do bug de cadastro repetido de pets no app.
