FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
