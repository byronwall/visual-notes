# syntax=docker/dockerfile:1.6

# -------- base deps --------
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

# -------- deps install (cached) --------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
ENV PRISMA_SKIP_POSTINSTALL=1
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts

# -------- build --------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm prisma generate && pnpm build

# -------- runtime --------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# System deps for Prisma engine in alpine
RUN apk add --no-cache openssl libc6-compat
# Enable pnpm via Corepack in runtime
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["sh","-c","pnpm start-prod"]
