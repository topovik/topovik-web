# Next 16 turbopack page-data collection breaks under Bun runtime.
# Install with Bun, build/run with Node.
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
ARG NEXT_PUBLIC_SITE_URL=https://topovik.com
ARG NEXT_PUBLIC_STRAPI_URL=https://topovik.com
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ARG STRAPI_URL=http://127.0.0.1:1337
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    STRAPI_URL=$STRAPI_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"
# Force Node for next build (do not use `bun run build`)
RUN node ./node_modules/next/dist/bin/next build \
  && rm -rf .next/standalone/public .next/standalone/.next/static \
  && cp -a public .next/standalone/public \
  && mkdir -p .next/standalone/.next \
  && cp -a .next/static .next/standalone/.next/static

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
RUN useradd -m -u 1001 nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
