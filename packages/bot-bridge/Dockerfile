# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package files for dependency installation
COPY packages/bot-bridge/package.json ./packages/bot-bridge/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @donuttrade/bot-bridge

# Copy source code
COPY packages/bot-bridge/ ./packages/bot-bridge/

# Build
RUN pnpm --filter @donuttrade/bot-bridge build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/bot-bridge ./packages/bot-bridge
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/bot-bridge

CMD ["node", "dist/index.js"]
