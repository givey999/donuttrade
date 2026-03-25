# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package files for dependency installation
COPY packages/mc-bot/package.json ./packages/mc-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @donuttrade/mc-bot

# Copy source code
COPY packages/mc-bot/ ./packages/mc-bot/

# Build
RUN pnpm --filter @donuttrade/mc-bot build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/mc-bot ./packages/mc-bot
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/mc-bot

CMD ["node", "dist/index.js"]
