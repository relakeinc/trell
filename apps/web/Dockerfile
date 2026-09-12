# syntax=docker/dockerfile:1
# Build context is the monorepo ROOT (see docker-compose.yml).
FROM node:22-slim AS builder
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

# Generate Prisma client for the web app (schema copied from api)
RUN pnpm --filter @trell/web exec prisma generate

# NEXT_PUBLIC_* are baked into the client bundle at build time.
# docker-compose.yml passes them as build args (see .env.example).
ARG NEXT_PUBLIC_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SDK_URL=http://localhost:8787/sdk/trell.js
ARG NEXT_PUBLIC_INGEST_URL=http://localhost:8787/v1/events
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL NEXT_PUBLIC_SDK_URL=$NEXT_PUBLIC_SDK_URL NEXT_PUBLIC_INGEST_URL=$NEXT_PUBLIC_INGEST_URL

# Build shared (types/constants), generate the Prisma client (schema lives in apps/api),
# then build the Next.js dashboard.
RUN pnpm --filter @trell/shared build
RUN pnpm --filter @trell/api db:generate
RUN pnpm --filter @trell/web build

# Runtime: reuse the built repo (self-host; size can be trimmed later with pnpm deploy).
FROM node:22-slim
ENV NODE_ENV=production PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo
COPY --from=builder /repo ./
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && pnpm start"]
