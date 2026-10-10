# syntax=docker/dockerfile:1

# Multi-stage build for the NestJS backend.
#
# Build from the REPO ROOT, not from backend/:
#   docker build -f backend/Dockerfile -t ecom-backend .
#
# The build context must be the root because three files this image needs only
# exist there — pnpm-lock.yaml, pnpm-workspace.yaml and
# patches/zxcvbn-ts@2.2.1.patch. There is deliberately no backend/pnpm-lock.yaml:
# a pre-monorepo leftover that still resolved jest/eslint/prettier made
# `pnpm install --frozen-lockfile` inside backend/ fail outright, which is the
# error you get from building with the wrong context.
# The patch is also required: it rewrites zxcvbn-ts's extensionless ESM
# imports, without which
# `import { zxcvbn } from "zxcvbn-ts"` throws ERR_MODULE_NOT_FOUND at runtime.

ARG NODE_VERSION=22

# ─── base ────────────────────────────────────────────────────────────────────
# Corepack ships with Node 22 and reads the pinned pnpm version from the root
# package.json "packageManager" field, so the builder and CI cannot disagree
# about pnpm's behaviour (patchedDependencies handling in particular).
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /app

# ─── deps ────────────────────────────────────────────────────────────────────
# Dependency manifests ONLY — no source, no config.
#
# This layer is the whole point of the build. A commit that touches a `.ts`
# file, a README or a test changes nothing here, so it stays cached and
# `pnpm install` does not re-run. It is re-run only when the lockfile or a
# package.json changes, which is exactly the set of commits that can invalidate
# it.
#
# `patches/` is copied with them (before the install) rather than after,
# because `patchedDependencies` in the root package.json points pnpm at that
# directory during resolution — the install cannot succeed without it.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile

# ─── build ───────────────────────────────────────────────────────────────────
# TS -> JS. The lockfile-derived node_modules from `deps` is reused as-is so
# the compiler is guaranteed to be the one the lockfile pins.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
RUN pnpm --filter backend build

# ─── prod-deps ───────────────────────────────────────────────────────────────
# A production-only dependency tree.
#
# `pnpm install --prod`, NOT `pnpm deploy --prod`. `deploy` requires
# `inject-workspace-packages=true` or --legacy, and in legacy mode it copied the
# *entire* installed tree: the resulting image carried newman, postman-runtime,
# postman-collection, vitest, supertest and typescript — the whole test and API
# tooling, 161 MB of node_modules, none of it reachable at runtime. Measured, not
# assumed; the pruning is asserted at the end of this stage.
FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY backend/package.json ./backend/

# NODE_ENV must be set for the install itself, not just the runner: pnpm reads
# it to decide whether to skip devDependencies. Scripts stay ENABLED because
# argon2 is a native module whose prebuilt binary is fetched by its install
# script, and --ignore-scripts would leave it unbuildable at runtime.
ENV NODE_ENV=production
RUN pnpm install --prod --frozen-lockfile

# `--prod` removes devDependencies but not TypeORM's *optional peer* deps, which
# pnpm auto-installs regardless: typescript (~23 MB), ts-node, @swc/core plus
# its per-platform binaries (~32 MB) and @types/node. They are compiler and test
# tooling — nothing in dist/ loads them — but they are roughly a third of the
# production tree and widen the supply chain for no runtime benefit.
#
# The script prunes them and then FAILS THE BUILD if any dev tooling is still
# present. Listing them explicitly is deliberate: a silently-wrong derivation
# ships a bloated image, whereas a visible list that a dependency bump
# invalidates is caught by the assertion on the next build.
COPY backend/scripts/prune-prod-deps.cjs ./prune-prod-deps.cjs
RUN node prune-prod-deps.cjs prune && node prune-prod-deps.cjs && rm prune-prod-deps.cjs

# ─── runner ──────────────────────────────────────────────────────────────────
# node:22-alpine and nothing else. No compiler, no corepack, no pnpm, no dev
# dependencies, no source files.
FROM node:${NODE_VERSION}-alpine AS runner

# Must match src/main.ts, which binds `process.env.BACKEND_PORT ?? 3000`,
# otherwise EXPOSE advertises a port nothing listens on.
ENV NODE_ENV=production \
    BACKEND_PORT=3001

# WORKDIR is /app/backend, not /app, and that is load-bearing rather than
# cosmetic. pnpm's workspace layout splits the tree in two: the real packages
# live in the hoisted store at node_modules/.pnpm, while node_modules/<pkg>
# symlinks pointing into it sit next to the workspace package. Resolution walks
# UP from the importing file, so an entry point at /app/dist/main.js would search
# /app/node_modules, find no direct dependencies there, and die with
# `Cannot find package 'reflect-metadata'`. Placing the app beside the symlink
# directory makes the store reachable at the relative path they encode
# (../../node_modules/.pnpm/...).
WORKDIR /app/backend

COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/package.json ./package.json

# uid 1000 (`node`), already defined by the base image. Nothing in this app
# writes to disk, so no writable chown/chmod is needed.
USER node

# Documentation only — it does not publish the port. A platform that injects its
# own PORT (Render does) will override BACKEND_PORT.
EXPOSE 3001

# Verified against backend/package.json: "start:prod": "node dist/main".
# Exec form, no shell wrapper, so PID 1 is node itself and SIGTERM reaches it.
CMD ["node", "dist/main"]
