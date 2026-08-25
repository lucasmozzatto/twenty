#!/usr/bin/env bash
# Publica o app "Cadência Petbee" (motor da régua de follow-up) dentro do Twenty.
#
# Por que um script: esta VPS tem Node 18 e não tem yarn, mas o app exige Node 22+.
# Então tudo roda dentro de um container descartável, com a pasta do app montada.
#
#   ./publicar-cadencia.sh          → PLANO: mostra o que mudaria, não escreve nada
#   ./publicar-cadencia.sh apply    → PUBLICA de verdade no CRM
#
# Roda os testes antes. No fim apaga as dependências e o arquivo de credencial que
# o SDK cria (.twenty), pra não deixar chave nem 150 MB soltos no repositório.
set -euo pipefail

APP=/opt/twenty-repo/packages/twenty-apps/petbee-cadencia
ENV_SYNC=/opt/twenty-repo/petbee/sync/.env
ACAO="${1:-plan}"

case "$ACAO" in
  plan|apply) ;;
  *) echo "uso: $0 [plan|apply]"; exit 1 ;;
esac

# `export` é obrigatório: o `docker run -e TWENTY_API_KEY` (sem valor) lê do
# AMBIENTE, e variável de shell não exportada chega vazia lá dentro.
export TWENTY_API_KEY="$(grep -E '^TWENTY_API_KEY=' "$ENV_SYNC" | cut -d= -f2-)"
if [ -z "$TWENTY_API_KEY" ]; then
  echo "❌ TWENTY_API_KEY não encontrada em $ENV_SYNC"; exit 1
fi

limpar() {
  rm -rf "$APP/.yarn" "$APP/.pnp.cjs" "$APP/.pnp.loader.mjs" "$APP/.twenty"
  git -C /opt/twenty-repo checkout -- packages/twenty-apps/petbee-cadencia/yarn.lock 2>/dev/null || true
}
trap limpar EXIT

docker run --rm \
  -v "$APP":/app -w /app \
  -e TWENTY_API_KEY -e ACAO="$ACAO" \
  node:22-bookworm bash -lc '
    set -e
    corepack enable >/dev/null 2>&1
    echo "→ instalando dependências…"
    yarn install --mode=skip-build >/dev/null 2>&1

    echo "→ testes da régua…"
    node --experimental-strip-types --test \
      src/cadencia/__tests__/regua.test.ts \
      src/cadencia/__tests__/plan.test.ts | grep -E "^# (tests|pass|fail)"

    echo "→ apontando pro CRM…"
    yarn twenty remote:add --url https://crm.petbeetools.com.br \
      --api-key "$TWENTY_API_KEY" --as petbee | tail -3

    if [ "$ACAO" = "apply" ]; then
      echo "→ PUBLICANDO no CRM…"
      # Sem flag: mudanca nao-destrutiva aplica direto. O `-f` do CLI serve so
      # pra autorizar REMOCOES sem perguntar — de proposito nao usamos, pra que
      # um plano com "to destroy" pare e apareca em vez de passar batido.
      yarn twenty apply
    else
      echo "→ plano (nada será escrito):"
      yarn twenty plan
    fi
  '
