#!/usr/bin/env bash
# =============================================================================
# Deploy no Render com verificação e ROLLBACK automático.
#
#   1. guarda o deploy atualmente "live" (ponto de retorno)
#   2. dispara um deploy do commit atual
#   3. espera o Render marcar o deploy como "live" (ou falhar)
#   4. healthcheck externo (/ready) com várias tentativas
#   5. se 3 ou 4 falharem → POST /rollback para o deploy guardado no passo 1
#
# Variáveis: RENDER_API_KEY, SERVICE_ID, HEALTH_URL (vazio = sem healthcheck
# HTTP, ex.: worker), COMMIT.
# =============================================================================
set -euo pipefail

API="https://api.render.com/v1"
AUTH=(-H "Authorization: Bearer ${RENDER_API_KEY}" -H "Accept: application/json")
TEMPO_MAXIMO_DEPLOY=900   # 15 min
TENTATIVAS_HEALTH=12      # 12 × 10s = 2 min

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

anterior=$(curl -fsS "${AUTH[@]}" "${API}/services/${SERVICE_ID}/deploys?limit=10" \
  | jq -r '[.[] | .deploy | select(.status == "live")][0].id // empty')
log "Deploy live atual (ponto de rollback): ${anterior:-nenhum}"

novo=$(curl -fsS "${AUTH[@]}" -H "Content-Type: application/json" \
  -X POST "${API}/services/${SERVICE_ID}/deploys" \
  -d "{\"commitId\": \"${COMMIT}\", \"clearCache\": \"do_not_clear\"}" | jq -r '.id')
log "Deploy disparado: ${novo} (commit ${COMMIT:0:7})"

rollback() {
  local motivo="$1"
  echo "::error::${motivo}"
  if [[ -n "${anterior}" ]]; then
    log "↩️  ROLLBACK para ${anterior}"
    curl -fsS "${AUTH[@]}" -H "Content-Type: application/json" \
      -X POST "${API}/services/${SERVICE_ID}/rollback" -d "{\"deployId\": \"${anterior}\"}" > /dev/null
    echo "::warning::Rollback executado para o deploy ${anterior}. Investigue antes de tentar de novo."
  else
    echo "::error::Sem deploy anterior para rollback — intervenção manual necessária."
  fi
  exit 1
}

inicio=$(date +%s)
while true; do
  status=$(curl -fsS "${AUTH[@]}" "${API}/services/${SERVICE_ID}/deploys/${novo}" | jq -r '.status')
  log "status: ${status}"
  case "${status}" in
    live) break ;;
    build_failed|update_failed|canceled|pre_deploy_failed|deactivated)
      rollback "Deploy ${novo} terminou com status ${status}" ;;
  esac
  if (( $(date +%s) - inicio > TEMPO_MAXIMO_DEPLOY )); then
    rollback "Deploy ${novo} excedeu ${TEMPO_MAXIMO_DEPLOY}s"
  fi
  sleep 15
done

if [[ -z "${HEALTH_URL}" ]]; then
  log "✅ Deploy live (serviço sem healthcheck HTTP externo)"
  exit 0
fi

for i in $(seq 1 "${TENTATIVAS_HEALTH}"); do
  if curl -fsS --max-time 5 -o /dev/null "${HEALTH_URL}"; then
    log "✅ Healthcheck OK (${HEALTH_URL}) na tentativa ${i}"
    exit 0
  fi
  log "healthcheck falhou (${i}/${TENTATIVAS_HEALTH}); nova tentativa em 10s"
  sleep 10
done

rollback "Healthcheck ${HEALTH_URL} falhou após o deploy ${novo}"
