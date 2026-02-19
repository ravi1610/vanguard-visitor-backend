# Stage 1: Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files + prisma schema (needed for prisma generate)
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Single npm ci — only network call in the entire build
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Prune dev dependencies in the builder itself (no network, just removes packages)
RUN npm prune --omit=dev

# Stage 2: Lean production image (no npm install, no network needed)
FROM node:20-alpine

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY package*.json ./
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && mkdir -p uploads

# Set Node.js memory limit and optimize GC for containers
ENV NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"
ENV UV_THREADPOOL_SIZE=4

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
