# syntax=docker/dockerfile:1.7
# =============================================================================
# Turbo Mais — Frontend (multi-stage)
# Usado no docker compose e em hospedagem própria. Em produção o frontend roda
# na Vercel (vercel.json replica os mesmos cabeçalhos e o proxy de /api).
#   build   → Node compila o SPA (Vite) para /app/dist
#   runtime → Nginx (sem Node, sem código-fonte) serve os estáticos, aplica os
#             cabeçalhos de segurança/CSP e faz proxy de /api e /socket.io
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Vazio = mesma origem (o Nginx abaixo faz o proxy da API)
ARG VITE_API_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
# A imagem oficial roda envsubst em /etc/nginx/templates/*.template na subida
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=http://backend:3333 \
    CSP_CONNECT_EXTRA=""
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
