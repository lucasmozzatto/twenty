# Robô de sincronização Petbee → Twenty CRM

Espelha o banco oficial da Petbee (MySQL na AWS) no Twenty, rodando **no
próprio VPS** do CRM, a cada 30 minutos. Mão única (Petbee → CRM), ancorado
nos campos "ID Petbee" — idempotente, nunca duplica.

## Pré-requisito (uma vez, com quem administra a AWS)

O VPS precisa enxergar o MySQL, em modo somente-leitura:

1. **Liberar o IP do VPS** no Security Group do banco: entrada TCP porta
   `3306` para `2.25.103.17/32` (só esse IP, nada mais).
2. **Criar um usuário somente-leitura**:

```sql
CREATE USER 'crm_sync'@'%' IDENTIFIED BY 'UMA_SENHA_FORTE';
GRANT SELECT ON petbee.* TO 'crm_sync'@'%';
```

## Instalação no VPS

```bash
cd /opt/twenty-repo && git pull && cd petbee/sync

# criar a configuração (trocar HOST e SENHA pelos valores reais)
cat > .env << 'EOF'
PETBEE_MYSQL_URL=mysql://crm_sync:SENHA@HOST_DO_MYSQL:3306/petbee
TWENTY_API_URL=https://crm.petbeetools.com.br
TWENTY_API_KEY=CHAVE_DA_API_DO_TWENTY
EOF

bash install-cron.sh          # instala dependências, testa conexão, agenda o cron
node sync-petbee-crm.mjs --full   # primeira carga completa (alguns minutos)
```

Depois disso o cron roda sozinho a cada 30 min no modo incremental (só o que
mudou desde a última rodada, com 1h de sobreposição de segurança). Logs em
`/var/log/twenty-sync.log`.

## Regras de negócio embutidas

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
