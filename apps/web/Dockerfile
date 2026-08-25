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
