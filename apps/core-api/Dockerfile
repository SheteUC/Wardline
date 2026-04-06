# Dockerfile for Core API (NestJS)

FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── Build stage ───────────────────────────────────────────────────────────────
FROM base AS build

WORKDIR /app
ENV NODE_ENV=development

# Copy all manifest files first (layer-cache friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/utils/package.json ./packages/utils/
COPY apps/core-api/package.json ./apps/core-api/

# Install all workspace deps; --shamefully-hoist ensures every binary
# (prisma CLI, nestjs/cli, tsc, turbo, etc.) is in node_modules/.bin
RUN pnpm install --frozen-lockfile --shamefully-hoist --prod=false

# Copy full source for the packages core-api actually depends on
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/utils ./packages/utils
COPY apps/core-api ./apps/core-api

# Re-link workspace dependencies after copying full source; the source copy can
# replace per-package symlinks that pnpm created when only manifests were present.
RUN pnpm install --frozen-lockfile --shamefully-hoist --prod=false --offline

# Generate Prisma Client first
# prisma.config.ts reads DATABASE_URL — dummy value is fine for generate (no DB connection needed)
WORKDIR /app/packages/db
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build all packages and core-api in dependency order via turbo
# turbo respects the build graph: utils/types/config/db → core-api
WORKDIR /app
RUN /app/node_modules/.bin/turbo run build --filter=@wardline/core-api... --no-daemon

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/core-api/dist ./apps/core-api/dist
COPY --from=build /app/apps/core-api/package.json ./apps/core-api/

# Restore workspace package resolution explicitly for runtime. Relying on copied
# pnpm workspace links is brittle across Docker stages.
RUN mkdir -p /app/node_modules/@wardline && \
    ln -s /app/packages/config /app/node_modules/@wardline/config && \
    ln -s /app/packages/db /app/node_modules/@wardline/db && \
    ln -s /app/packages/types /app/node_modules/@wardline/types && \
    ln -s /app/packages/utils /app/node_modules/@wardline/utils && \
    chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

CMD ["node", "apps/core-api/dist/main.js"]
