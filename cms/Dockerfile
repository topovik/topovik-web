# Strapi admin build needs Node. oven/bun alone is not enough.
# .env is dockerignored — build-time placeholders; runtime uses compose env_file.
FROM node:22-bookworm AS deps
RUN npm install -g bun@1.2.15
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:22-bookworm AS build
RUN npm install -g bun@1.2.15
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337 \
    APP_KEYS="buildKey1,buildKey2,buildKey3,buildKey4" \
    API_TOKEN_SALT="buildApiTokenSalt" \
    ADMIN_JWT_SECRET="buildAdminJwtSecret" \
    TRANSFER_TOKEN_SALT="buildTransferTokenSalt" \
    JWT_SECRET="buildJwtSecret" \
    ENCRYPTION_KEY="0123456789abcdef0123456789abcdef" \
    DATABASE_CLIENT=sqlite \
    DATABASE_FILENAME=.tmp/data.db \
    NODE_OPTIONS="--max-old-space-size=3072"

RUN mkdir -p .tmp && bun run build

FROM node:22-bookworm-slim AS runner
RUN npm install -g bun@1.2.15
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337
COPY --from=build /app ./
RUN mkdir -p public/uploads .tmp
EXPOSE 1337
CMD ["node", "./node_modules/@strapi/strapi/bin/strapi.js", "start"]
