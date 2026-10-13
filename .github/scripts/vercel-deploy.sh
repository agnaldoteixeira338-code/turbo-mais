#!/usr/bin/env bash
# =============================================================================
# Deploy do FRONTEND na Vercel com verificação e ROLLBACK automático.
#
#   1. guarda o deploy de produção atual (ponto de retorno)
#   2. build local (vercel build) + deploy do artefato pronto (--prebuilt --prod)
#   3. healthcheck: a home responde E o rewrite /api → Render funciona
#   4. falhou? `vercel rollback` para o deploy guardado no passo 1
#
# Roda da RAIZ do repositório (o projeto na Vercel tem Root Directory = frontend).
# Variáveis: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, FRONTEND_URL.
# =============================================================================
set -euo pipefail

VERCEL="npx --yes vercel@latest"
API="https://api.vercel.com"
TENTATIVAS_HEALTH=12 # 12 × 10s = 2 min

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# Contas pessoais não usam teamId; times usam (IDs começam com team_)
escopo=""
[[ "${VERCEL_ORG_ID}" == team_* ]] && escopo="&teamId=${VERCEL_ORG_ID}"

anterior=$(curl -fsS -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  "${API}/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=production&state=READY&limit=1${escopo}" \
  | jq -r '.deployments[0].uid // empty')
log "Deploy de produção atual (ponto de rollback): ${anterior:-nenhum}"

$VERCEL pull --yes --environment=production --token="${VERCEL_TOKEN}"
$VERCEL build --prod --token="${VERCEL_TOKEN}"
url=$($VERCEL deploy --prebuilt --prod --token="${VERCEL_TOKEN}")
log "Deploy publicado: ${url}"

rollback() {
  echo "::error::$1"
  if [[ -n "${anterior}" ]]; then
    log "↩️  ROLLBACK para ${anterior}"
    $VERCEL rollback "${anterior}" --yes --token="${VERCEL_TOKEN}"
    echo "::warning::Rollback executado para ${anterior}. Investigue antes de tentar de novo."
  else
    echo "::error::Sem deploy anterior para rollback — intervenção manual necessária."
  fi
  exit 1
}

for i in $(seq 1 "${TENTATIVAS_HEALTH}"); do
  # Valida as duas coisas que o usuário precisa: o SPA e a API através do rewrite
  if curl -fsS --max-time 10 -o /dev/null "${FRONTEND_URL}/" \
    && curl -fsS --max-time 10 -o /dev/null "${FRONTEND_URL}/api/docs.json"; then
    log "✅ Healthcheck OK (SPA + rewrite /api) na tentativa ${i}"
    exit 0
  fi
  log "healthcheck falhou (${i}/${TENTATIVAS_HEALTH}); nova tentativa em 10s"
  sleep 10
done

rollback "Healthcheck de ${FRONTEND_URL} falhou após o deploy ${url}"
