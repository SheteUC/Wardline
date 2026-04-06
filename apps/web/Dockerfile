# Next.js (App Router) — monorepo build; `output: "standalone"` in next.config.ts
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS dependencies
WORKDIR /app
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS dev
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=dependencies /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --prod=false --offline
WORKDIR /app/packages/db
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm exec prisma generate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "--filter", "@wardline/web", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=dependencies /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --prod=false --offline
WORKDIR /app/packages/db
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm exec prisma generate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @wardline/web build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

RUN chown -R node:node /app
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/web/server.js"]
