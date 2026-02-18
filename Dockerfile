# Stage 1: Install all dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install ALL dependencies (single npm ci to avoid parallel network issues on small VPS)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production (copy from builder, prune dev deps)
FROM node:20-alpine

WORKDIR /app

# Copy package files and node_modules from builder (avoids a second npm ci)
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Prune dev dependencies (much faster than a full npm ci, no network needed)
RUN npm prune --omit=dev

# Generate Prisma client for production image
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
ENTRYPOINT ["./docker-entrypoint.sh"]
