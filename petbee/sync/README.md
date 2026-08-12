# Robô de sincronização Petbee → Twenty CRM

Espelha o banco oficial da Petbee (MySQL na AWS) no Twenty, rodando **no
próprio VPS** do CRM, a cada 30 minutos. Mão única (Petbee → CRM), ancorado
nos campos "ID Petbee" — idempotente, nunca duplica.

## Pré-requisito (uma vez, com quem administra a AWS)

O RDS `petbeedb` é privado (sem acesso público), então o VPS chega até ele
por **túnel SSH via bastion**:

1. **No VPS**, gerar a chave do túnel e enviar a parte pública ao CTO:
   `ssh-keygen -t ed25519 -f /root/.ssh/crm_tunnel -N '' -C crm-tunnel`
   e `cat /root/.ssh/crm_tunnel.pub`
2. **CTO**: criar no bastion um usuário para essa chave (ideal: sem shell,
   só port-forward, ex.: `command="",restrict,port-forwarding` no
   authorized_keys) e devolver `usuario@host` (e porta, se não for 22).
3. **CTO**: criar o usuário somente-leitura no MySQL:

```sql
CREATE USER 'crm_sync'@'%' IDENTIFIED BY 'UMA_SENHA_FORTE';
GRANT SELECT ON petbee.* TO 'crm_sync'@'%';
```

## Instalação no VPS

```bash
cd /opt/twenty-repo && git pull && cd petbee/sync

# configuração (trocar SENHA, usuario@bastion e a API key)
cat > .env << 'EOF'
BASTION_SSH=usuario@host-do-bastion
PETBEE_MYSQL_URL=mysql://crm_sync:SENHA@127.0.0.1:3307/petbee
TWENTY_API_URL=https://crm.petbeetools.com.br
TWENTY_API_KEY=CHAVE_DA_API_DO_TWENTY
EOF

bash install-tunnel.sh        # sobe o túnel permanente (systemd + autossh)
bash install-cron.sh          # dependências, teste de conexão, cron 30 em 30
node sync-petbee-crm.mjs --full   # primeira carga completa (alguns minutos)
```

> Sem bastion disponível? Alternativa: rodar este mesmo script numa
> instância mínima dentro da VPC (t4g.nano) com o SG dela liberado no
> `petbee-db-sg` — nada muda no código.

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
