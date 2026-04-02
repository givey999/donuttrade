# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package files for dependency installation
COPY packages/management-bot/package.json ./packages/management-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @donuttrade/management-bot

# Copy source code
COPY packages/management-bot/ ./packages/management-bot/

# Build
RUN pnpm --filter @donuttrade/management-bot build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/management-bot ./packages/management-bot
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/management-bot

# Copy compliance panel images
COPY docs/rules.png docs/proof.png ./assets/

CMD ["node", "dist/index.js"]
