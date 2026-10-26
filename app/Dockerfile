# syntax=docker/dockerfile:1.7

# -------- OS packages shared by every stage --------
FROM node:24-bookworm-slim AS os
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# -------- pnpm --------
# On top of `os` so Prisma sees OpenSSL and generates the matching engine.
FROM os AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# -------- deps install (cached on the lockfile) --------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
ENV PRISMA_SKIP_POSTINSTALL=1
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts \
  && node -p "require('prisma/package.json').version" > /prisma-version

# -------- build --------
FROM deps AS build
COPY . .
RUN pnpm prisma generate && pnpm build

# -------- Prisma CLI alone, for `migrate deploy` at start --------
# The app bundle in .output carries its own Prisma client and engine. Only the
# CLI comes from here, so runtime does not need the full dev node_modules.
FROM base AS prisma-cli
COPY --from=deps /prisma-version /prisma-version
WORKDIR /opt/prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  echo '{"name":"prisma-cli","private":true}' > package.json \
  && pnpm add --config.node-linker=hoisted "prisma@$(cat /prisma-version)"

# -------- runtime --------
FROM os AS runtime
ENV NODE_ENV=production
ENV UMAP_PYTHON_BIN=/app/.venv/bin/python
ENV PATH=/opt/prisma/node_modules/.bin:$PATH

# Python UMAP worker. Before the app files, so a commit does not reinstall it.
COPY scripts/requirements-umap.txt ./scripts/requirements-umap.txt
RUN --mount=type=cache,id=pip,target=/root/.cache/pip \
  python3 -m venv /app/.venv \
  && /app/.venv/bin/python -m pip install -r ./scripts/requirements-umap.txt \
  && cd /app/.venv/lib/python3*/site-packages \
  && find . -depth -type d \( -name tests -o -name __pycache__ \) -exec rm -rf {} + \
  && rm -rf pip pip-* setuptools setuptools-* pkg_resources _distutils_hack distutils-precedence.pth

COPY --from=prisma-cli /opt/prisma /opt/prisma
COPY prisma ./prisma
COPY scripts/umap_model.py ./scripts/umap_model.py
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["sh","-c","prisma migrate deploy && node .output/server/backfill-search-text.mjs && node .output/server/index.mjs"]
