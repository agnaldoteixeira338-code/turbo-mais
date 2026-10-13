# syntax=docker/dockerfile:1.7
# =============================================================================
# Turbo Mais — API/Worker (multi-stage)
#
#   deps      → dependências de PRODUÇÃO (npm ci --omit=dev), cache de camada
#   migrator  → imagem one-shot com Prisma CLI + /database (docker compose)
#   runtime   → imagem final mínima: sem devDeps, sem código de teste, usuário
#               não-root, tini como PID 1 (repassa SIGTERM → graceful shutdown)
#
# O MESMO artefato roda a API (`node src/server.js`) e o worker
# (`node src/worker.js`): build once, run many.
# =============================================================================

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
# Sem --ignore-scripts aqui: o postinstall do Prisma baixa a engine de migração
RUN --mount=type=cache,target=/root/.npm npm ci
COPY scripts ./scripts
# /database vem de um build context adicional (ver docker-compose.yml)
COPY --from=database . /database
CMD ["sh", "-c", "npx prisma migrate deploy --schema /database/schema.prisma && node scripts/seed.js"]

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3333
WORKDIR /app
# tini = init mínimo; o wget do healthcheck já vem no BusyBox do Alpine.
# apk upgrade aplica patches de segurança do sistema publicados após a imagem base.
RUN apk upgrade --no-cache && apk add --no-cache tini

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

USER node
EXPOSE 3333

# Readiness (e não liveness) — ver HealthController para a diferença
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/ready" > /dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
