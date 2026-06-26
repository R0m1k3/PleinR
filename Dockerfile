# syntax=docker/dockerfile:1

# ---- deps: install all dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder: build Next.js (standalone) + bundle db scripts ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npm run build:scripts

# ---- runner: minimal production image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Bundled migration + seed scripts and the SQL migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
