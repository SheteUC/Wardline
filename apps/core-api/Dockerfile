# Dockerfile for Core API (NestJS)

FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

FROM base AS dependencies

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/utils/package.json ./packages/utils/
COPY apps/core-api/package.json ./apps/core-api/

# Install dependencies
RUN pnpm install --frozen-lockfile

FROM base AS build

WORKDIR /app

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/core-api/node_modules ./apps/core-api/node_modules

# Copy source code
COPY packages ./packages
COPY apps/core-api ./apps/core-api

# Generate Prisma Client
WORKDIR /app/packages/db
RUN pnpm prisma generate

# Build application
WORKDIR /app/apps/core-api
RUN pnpm build

FROM base AS production

WORKDIR /app

# Copy built application
COPY --from=build /app/apps/core-api/dist ./dist
COPY --from=build /app/apps/core-api/node_modules ./node_modules
COPY --from=build /app/packages ./packages

# Create non-root user
RUN addgroup -g 1000 wardline && \
    adduser -D -u 1000 -G wardline wardline && \
    chown -R wardline:wardline /app

USER wardline

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run the application
CMD ["node", "dist/main.js"]
