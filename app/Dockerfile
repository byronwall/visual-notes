# syntax=docker/dockerfile:1.6

# -------- base deps --------
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

# -------- deps install (cached) --------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
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
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV UMAP_PYTHON_BIN=/app/.venv/bin/python
WORKDIR /app

# System deps for Prisma + Python UMAP worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
# Enable pnpm via Corepack in runtime
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts

RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/python -m pip install --no-cache-dir -r ./scripts/requirements-umap.txt

EXPOSE 3000
CMD ["sh","-c","pnpm start-prod"]
