# Dev stage — mounts src/ at runtime, tsx watch for hot reload
FROM node:24-alpine AS dev
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
# src/ is mounted as a volume at runtime, not baked in
ENTRYPOINT ["npx", "tsx", "watch", "src/index.ts"]

# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage
FROM node:24-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 7576
ENTRYPOINT ["node", "dist/index.js"]
