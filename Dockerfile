FROM node:20-alpine AS base

# ── Dependencies ────────────────────────────────────────────
FROM base AS deps

# better-sqlite3 needs build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci

# ── Build ───────────────────────────────────────────────────
FROM base AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Production ──────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (includes server.js, package.json, bundled node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The standalone output bundles most deps, but better-sqlite3 native addon
# needs the full module. Copy it from the deps stage (same Alpine base = compatible binary).
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=deps /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Create data directory for SQLite persistence (Render Disk mount point)
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
