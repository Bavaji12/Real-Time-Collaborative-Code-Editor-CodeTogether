# Multi-stage Dockerfile for CodeTogether
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies including build tools
RUN npm ci

# Copy source code and assets
COPY . .

# Build frontend and production assets
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets and server sources
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
