# Phase 0: Implementation & Testing Guide

**Phase**: Project Foundation & Logging Infrastructure
**Status**: Implemented
**Date**: January 2026

---

## Overview

This document provides all commands needed to validate and test the Phase 0 implementation of the DonutTrade platform.

---

## Prerequisites

Before testing, ensure you have:

- **Node.js 20+** installed
- **Docker** and **Docker Compose** installed
- **Git** (for version control)

Verify prerequisites:
```bash
node --version    # Should be v20.x.x or higher
npm --version     # Should be v10.x.x or higher
docker --version  # Should be installed
docker compose version  # Should be v2.x.x
```

---

## Step 1: Start Development Databases

Start PostgreSQL and Redis using Docker Compose:

```bash
# From project root (R:\miau)
docker compose up -d

# Verify containers are running
docker compose ps

# Expected output:
# NAME                    STATUS
# donuttrade-postgres     running (healthy)
# donuttrade-redis        running (healthy)
```

**Troubleshooting:**
```bash
# View container logs if there are issues
docker compose logs postgres
docker compose logs redis

# Restart containers
docker compose restart

# Full reset (removes data)
docker compose down -v
docker compose up -d
```

---

## Step 2: Install Dependencies

Install all workspace dependencies:

```bash
# From project root
npm install
```

**Expected output:**
- No errors
- Workspaces detected: `miau-bot`, `@donuttrade/api`, `@donuttrade/shared`, `@donuttrade/web`, `@donuttrade/bot-bridge`

---

## Step 3: Build Shared Package

Build the shared types package first (other packages depend on it):

```bash
# Build shared package
cd packages/shared
npm run build

# Verify build output exists
ls dist/
# Should show: index.js, index.d.ts, types/, constants/
```

---

## Step 4: Generate Prisma Client

Generate the Prisma client and run initial migration:

```bash
cd packages/api

# Generate Prisma client
npx prisma generate

# Create and run initial migration
npx prisma migrate dev --name init

# Verify database tables created
npx prisma studio
# Opens browser at http://localhost:5555
# You should see the health_checks table
```

---

## Step 5: Start the API Server

Start the API in development mode:

```bash
# From packages/api
npm run dev

# Or from project root
npm run dev --workspace=@donuttrade/api
```

**Expected startup logs (development mode):**
```
[timestamp] INFO  startup.server.starting: Starting DonutTrade API server
[timestamp] DEBUG startup.config.loaded: Configuration loaded
[timestamp] INFO  startup.database.connecting: Connecting to databases...
[timestamp] INFO  database.connect.success: Database connected
[timestamp] INFO  redis.connect.success: Redis connected
[timestamp] INFO  redis.ready: Redis ready
[timestamp] INFO  startup.server.started: Server listening on port 3001
```

---

## Step 6: Validate Health Endpoints

### 6.1 Basic Health Check

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-24T12:00:00.000Z"
}
```

### 6.2 Detailed Health Check

```bash
curl http://localhost:3001/health/detailed
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-24T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "ok",
      "latency": 5
    },
    "redis": {
      "status": "ok",
      "latency": 2
    }
  }
}
```

### 6.3 Readiness Check

```bash
curl http://localhost:3001/health/ready
```

**Expected response:**
```json
{
  "ready": true
}
```

### 6.4 Liveness Check

```bash
curl http://localhost:3001/health/live
```

**Expected response:**
```json
{
  "alive": true
}
```

---

## Step 7: Validate Logging

### 7.1 Check Log Format

With the server running, make a request and observe the logs:

```bash
curl http://localhost:3001/health
```

**Expected log entries (in terminal):**
```
[timestamp] DEBUG http.request.start: GET /health
[timestamp] INFO  http.request.complete: GET /health - 200
```

### 7.2 Verify Correlation ID

Make a request with a custom correlation ID:

```bash
curl -H "x-correlation-id: test-correlation-123" http://localhost:3001/health -v
```

**Verify in response headers:**
```
< x-correlation-id: test-correlation-123
```

### 7.3 Test Error Logging

Request a non-existent route:

```bash
curl http://localhost:3001/non-existent
```

**Expected response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /non-existent not found"
  }
}
```

---

## Step 8: Validate Database Connection

### 8.1 Using Prisma Studio

```bash
cd packages/api
npx prisma studio
```

Opens a browser GUI at `http://localhost:5555` where you can:
- View the `health_checks` table
- Add/edit/delete records manually

### 8.2 Direct Database Query

```bash
# Connect to PostgreSQL
docker exec -it donuttrade-postgres psql -U dev -d donuttrade

# List tables
\dt

# Expected output:
#         List of relations
# Schema |     Name      | Type  | Owner
#--------+---------------+-------+-------
# public | health_checks | table | dev

# Exit
\q
```

---

## Step 9: Validate Redis Connection

```bash
# Connect to Redis CLI
docker exec -it donuttrade-redis redis-cli

# Ping test
PING
# Expected: PONG

# Check server info
INFO server

# Exit
exit
```

---

## Step 10: Run TypeScript Compilation

Verify TypeScript compiles without errors:

```bash
# Compile shared package
cd packages/shared
npm run build

# Compile API package
cd ../api
npm run build

# Check for type errors
npx tsc --noEmit
```

**Expected:** No errors

---

## Verification Checklist

Use this checklist to verify Phase 0 is complete:

### Infrastructure
- [ ] Docker Compose starts without errors
- [ ] PostgreSQL container is healthy
- [ ] Redis container is healthy

### Dependencies
- [ ] `npm install` completes successfully
- [ ] All workspaces recognized

### Build
- [ ] `@donuttrade/shared` builds successfully
- [ ] TypeScript compilation succeeds

### Database
- [ ] Prisma client generates
- [ ] Migration runs successfully
- [ ] Prisma Studio opens and shows tables

### API Server
- [ ] Server starts without errors
- [ ] Startup logs appear in correct format
- [ ] Server listens on port 3001

### Health Endpoints
- [ ] `GET /health` returns `200 OK`
- [ ] `GET /health/detailed` returns all services as `ok`
- [ ] `GET /health/ready` returns `ready: true`
- [ ] `GET /health/live` returns `alive: true`

### Logging
- [ ] Logs output in structured JSON (or pretty-printed in dev)
- [ ] Logs include `correlationId`
- [ ] Logs include `module` and `action`
- [ ] Request/response logging works
- [ ] Error logging works

### Error Handling
- [ ] 404 returns proper JSON error response
- [ ] Errors include `code` and `message`

---

## Troubleshooting Guide

### Database Connection Failed

**Symptoms:** Server fails to start with "Failed to connect to database"

**Solutions:**
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Verify connection string in .env
cat .env | grep DATABASE_URL

# Test direct connection
docker exec -it donuttrade-postgres psql -U dev -d donuttrade -c "SELECT 1"
```

### Redis Connection Failed

**Symptoms:** Server fails to start with "Failed to ping Redis"

**Solutions:**
```bash
# Check if Redis is running
docker compose ps redis

# Check Redis logs
docker compose logs redis

# Test direct connection
docker exec -it donuttrade-redis redis-cli PING
```

### Port Already in Use

**Symptoms:** "Error: listen EADDRINUSE: address already in use :::3001"

**Solutions:**
```bash
# Find process using port 3001
netstat -ano | findstr :3001   # Windows
lsof -i :3001                  # Linux/Mac

# Kill the process or use a different port
# Set PORT=3002 in .env
```

### Module Not Found Errors

**Symptoms:** "Cannot find module '@donuttrade/shared'"

**Solutions:**
```bash
# Rebuild shared package
cd packages/shared
npm run build

# Reinstall dependencies
cd ../..
npm install
```

---

## Project Structure After Phase 0

```
miau/
├── .env                           # Environment variables (gitignored)
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore patterns
├── docker-compose.yml             # Development databases
├── package.json                   # Workspace root
├── tsconfig.base.json             # Base TypeScript config
├── turbo.json                     # Turborepo config
│
├── packages/
│   ├── api/                       # ✅ Implemented
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── index.ts           # Entry point
│   │       ├── config/
│   │       │   └── index.ts       # Configuration
│   │       ├── lib/
│   │       │   ├── context.ts     # Request context
│   │       │   ├── errors.ts      # Error classes
│   │       │   └── logger.ts      # Structured logging
│   │       ├── plugins/
│   │       │   ├── error-handler.ts
│   │       │   ├── request-context.ts
│   │       │   └── request-logging.ts
│   │       ├── routes/
│   │       │   └── health.ts      # Health check routes
│   │       └── services/
│   │           ├── database.ts    # Prisma client
│   │           └── redis.ts       # Redis client
│   │
│   ├── shared/                    # ✅ Implemented
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── constants/
│   │       │   └── index.ts
│   │       └── types/
│   │           └── index.ts
│   │
│   ├── web/                       # 📋 Placeholder
│   │   └── package.json
│   │
│   └── bot-bridge/                # 📋 Placeholder
│       └── package.json
│
├── src/                           # Original bot code
│   ├── package.json               # Bot workspace package
│   ├── index.js
│   ├── bot.js
│   ├── chat.js
│   └── payments.js
│
├── config/
│   └── config.example.json
│
├── logs/
│   ├── payments-in.log
│   └── payments-out.log
│
└── docs/
    ├── DonutTrade-Platform-Specification.md
    ├── Implementation-Plan.md
    └── phase-0-implementation+testing.md   # This file
```

---

## Next Steps

After validating Phase 0, proceed to **Phase 1: Database Schema & User Model**:

1. Update Prisma schema with User model
2. Create user repository
3. Implement database migrations
4. Add user CRUD operations

See `docs/Implementation-Plan.md` for details.

---

## Log Examples

### Successful Startup
```json
{"level":"info","time":1706097600000,"service":"api","correlationId":"abc-123","module":"startup","action":"server.starting","metadata":{"nodeEnv":"development","port":3001},"msg":"Starting DonutTrade API server"}
{"level":"info","time":1706097600100,"service":"api","correlationId":"abc-123","module":"database","action":"connect.success","duration":45,"msg":"Database connected"}
{"level":"info","time":1706097600150,"service":"api","correlationId":"abc-123","module":"redis","action":"connect.success","msg":"Redis connected"}
{"level":"info","time":1706097600200,"service":"api","correlationId":"abc-123","module":"startup","action":"server.started","metadata":{"port":3001,"environment":"development"},"msg":"Server listening on port 3001"}
```

### Health Check Request
```json
{"level":"debug","time":1706097700000,"service":"api","correlationId":"def-456","module":"http","action":"request.start","metadata":{"method":"GET","path":"/health","ip":"::1"},"msg":"GET /health"}
{"level":"info","time":1706097700010,"service":"api","correlationId":"def-456","module":"http","action":"request.complete","duration":10,"metadata":{"method":"GET","path":"/health","statusCode":200},"msg":"GET /health - 200"}
```

### Error Response
```json
{"level":"warn","time":1706097800000,"service":"api","correlationId":"ghi-789","module":"http","action":"error.handled","metadata":{"code":"NOT_FOUND","statusCode":404,"path":"/invalid","method":"GET"},"msg":"Route GET /invalid not found"}
```
