# Robô de sincronização Petbee → Twenty CRM

Espelha os dados da Petbee no Twenty, rodando **no próprio VPS** do CRM, de
hora em hora. Mão única (Petbee → CRM), ancorado nos campos "ID Petbee" —
idempotente, nunca duplica.

**Fonte de leitura: a RÉPLICA read-only** (a cópia que a Petbee empurra via
DMS — a mesma linha que alimenta o Retool), nunca o banco de produção. O
leitor aceita **Postgres ou MySQL** (decidido pelo prefixo da URL); uma
migração futura para BigQuery = reimplementar só as 5 consultas de
`readSource()` — o cérebro (regras + escrita no CRM) não muda.

## Pré-requisito (uma vez, com a infra)

1. Uma **role/usuário somente-leitura** na réplica, escopada às tabelas
   `humans`, `pets`, `pets_humans`, `subscriptions`, `plans`,
   `pet_families`;
2. **Allowlist do IP do VPS** (`2.25.103.17/32`) no acesso da réplica;
3. Entrega de host/porta/banco/engine + credencial por **canal seguro**
   (nunca em chat) — a credencial vai direto no `.env` do VPS.

## Instalação no VPS

```bash
cd /opt/twenty-repo && git pull && cd petbee/sync

# configuração (preencher com os dados entregues pela infra)
cat > .env << 'EOF'
PETBEE_DB_URL=postgres://USUARIO:SENHA@HOST:5432/BANCO
# PETBEE_DB_SCHEMA=petbee        # se as tabelas viverem num schema/prefixo
TWENTY_API_URL=https://crm.petbeetools.com.br
TWENTY_API_KEY=CHAVE_DA_API_DO_TWENTY
# SYNC_CRON_SCHEDULE=0 * * * *   # padrão: de hora em hora
EOF

bash install-cron.sh              # dependências, teste de conexão, cron
node sync-petbee-crm.mjs --test   # confere fonte e CRM sem gravar nada
node sync-petbee-crm.mjs --full   # primeira carga completa (alguns minutos)
```

> Plano B (se um dia for preciso ler o MySQL de origem direto): os scripts
> de túnel SSH continuam nesta pasta (`install-tunnel.sh`) e o leitor
> aceita `mysql://…@127.0.0.1:3307/petbee` via túnel — mas a réplica é o
> caminho padrão e recomendado pela infra.

Depois disso o cron roda sozinho a cada 30 min no modo incremental (só o que
mudou desde a última rodada, com 1h de sobreposição de segurança). Logs em
`/var/log/twenty-sync.log`.

## Regras de negócio embutidas

- **Adoção de leads por e-mail**: ao processar um tutor cujo ID Petbee ainda
  não existe no CRM, o robô procura uma pessoa com o mesmo e-mail **sem** ID
  Petbee (lead criado antes do cadastro no app, ex.: vindo do Bitrix). Se
  achar, atualiza esse registro e carimba o ID nele — o histórico do lead
  (anotações, tarefas, funil) é preservado e nada duplica. Telefone não é
  usado como critério de propósito: formatos variam e um casamento errado é
  pior que uma duplicata.

- **Status da assinatura**: `canceled_at`/`finished` → Cancelada; `blocked` →
  Bloqueada; senão Ativa.
- **Status do cliente** (Person): tem assinatura ativa → Ativo; senão Inativo.
- **Tutor do pet**: quem paga a assinatura; sem assinatura, o vínculo mais
  antigo de `pets_humans` (guarda compartilhada: o 2º guardião existe como
  pessoa, mas o vínculo pet↔tutor é único).
- Valores em centavos no MySQL viram R$ no CRM; `monthly/yearly` viram
  Mensal/Anual; dia de vencimento vem da próxima cobrança.
- Registros com `deleted_at` no MySQL são ignorados (não são apagados do CRM
  — exclusão é decisão manual).

## Campos que o robô NÃO toca

Anotações, tarefas, canal preferido, UTMs, ID Bitrix e tudo que o time editar
no CRM ficam intactos — o robô só escreve os campos espelhados acima.
