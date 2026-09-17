#!/usr/bin/env bash
# Publica o app "Conferência Petbee" (conferência funil × banco) dentro do Twenty.
#
# Mesma mecânica do publicar-paineis.sh: esta VPS tem Node 18 e não tem yarn,
# e o app exige Node 22+, então tudo roda num container descartável com a pasta
# do app montada.
#
#   ./publicar-conferencia.sh           → PLANO: mostra o que mudaria, não escreve nada
#   ./publicar-conferencia.sh apply     → PUBLICA de verdade no CRM
#   ./publicar-conferencia.sh remover   → PUBLICA autorizando APAGAR o que saiu do código
#
# Diferença em relação à cadência: este app é somente leitura. O papel dele não
# tem permissão de escrita, então o pior caso de um erro aqui é uma lista
# errado — nunca um negócio alterado.
#
# No fim apaga as dependências e o arquivo de credencial que o SDK cria
# (.twenty), pra não deixar chave nem 150 MB soltos no repositório.
set -euo pipefail

APP=/opt/twenty-repo/packages/twenty-apps/petbee-conferencia
ENV_SYNC=/opt/twenty-repo/petbee/sync/.env
ACAO="${1:-plan}"

case "$ACAO" in
  plan|apply|remover) ;;
  *) echo "uso: $0 [plan|apply|remover]"; exit 1 ;;
esac

# Aviso antes de um comando que apaga, porque este é o único que apaga.
if [ "$ACAO" = "remover" ]; then
  echo "⚠  Este comando APAGA do CRM tudo que saiu do código."
  echo "   Rode antes o plano (./publicar-conferencia.sh) e confira a linha 'to destroy'."
  printf "   Digite APAGAR para continuar: "
  read -r RESPOSTA
  if [ "$RESPOSTA" != "APAGAR" ]; then echo "cancelado."; exit 1; fi
fi

# `export` é obrigatório: o `docker run -e TWENTY_API_KEY` (sem valor) lê do
# AMBIENTE, e variável de shell não exportada chega vazia lá dentro.
export TWENTY_API_KEY="$(grep -E '^TWENTY_API_KEY=' "$ENV_SYNC" | cut -d= -f2-)"
if [ -z "$TWENTY_API_KEY" ]; then
  echo "❌ TWENTY_API_KEY não encontrada em $ENV_SYNC"; exit 1
fi

limpar() {
  rm -rf "$APP/.yarn" "$APP/.pnp.cjs" "$APP/.pnp.loader.mjs" "$APP/.twenty"
  git -C /opt/twenty-repo checkout -- packages/twenty-apps/petbee-conferencia/yarn.lock 2>/dev/null || true
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

    echo "→ conferindo o código…"
    yarn typecheck

    echo "→ apontando pro CRM…"
    yarn twenty remote:add --url https://crm.petbeetools.com.br \
      --api-key "$TWENTY_API_KEY" --as petbee | tail -3

    if [ "$ACAO" = "remover" ]; then
      echo "→ PUBLICANDO no CRM, com REMOCOES autorizadas…"
      # O `-f` autoriza os deletes sem perguntar. O container nao tem terminal
      # interativo, entao sem ele o CLI travaria na pergunta de confirmacao.
      # Fica num comando separado pra ninguem apagar sem querer.
      yarn twenty apply -f
    elif [ "$ACAO" = "apply" ]; then
      echo "→ PUBLICANDO no CRM…"
      # Sem flag: mudanca nao-destrutiva aplica direto. O `-f` do CLI serve so
      # pra autorizar REMOCOES sem perguntar — de proposito nao usamos aqui, pra
      # que um plano com "to destroy" pare e apareca em vez de passar batido.
      yarn twenty apply
    else
      echo "→ plano (nada será escrito):"
      yarn twenty plan
    fi
  '
