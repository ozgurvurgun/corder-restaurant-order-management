FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
# pnpm 12 blocks dependency build scripts unless allowlisted; Nest does not need them here.
RUN corepack enable pnpm && pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml .npmrc ./
RUN apk add --no-cache libwebp-tools ffmpeg \
  && corepack enable pnpm \
  && pnpm install --frozen-lockfile --prod --ignore-scripts \
  && pnpm store prune \
  && mkdir -p /app/uploads \
  && chown -R node:node /app
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node scripts ./scripts
USER node
VOLUME ["/app/uploads"]
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/live || exit 1
CMD ["node", "dist/main.js"]
