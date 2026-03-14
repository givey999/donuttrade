# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package files for dependency installation
COPY packages/deposit-bot/package.json ./packages/deposit-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @donuttrade/deposit-bot

# Copy source code
COPY packages/deposit-bot/ ./packages/deposit-bot/

# Build
RUN pnpm --filter @donuttrade/deposit-bot build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/deposit-bot ./packages/deposit-bot
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/deposit-bot

CMD ["node", "dist/index.js"]
