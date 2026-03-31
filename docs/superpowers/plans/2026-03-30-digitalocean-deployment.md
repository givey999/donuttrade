# DigitalOcean Droplet Deployment Plan

> **For agentic workers:** This is an ops/deployment runbook, not a code implementation plan. Follow steps sequentially. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy DonutTrade from a local laptop to a DigitalOcean Droplet running Docker Compose, reachable at `https://donuttrade.com`

**Architecture:** Same Docker Compose stack as local dev, running on a $24/mo DO Droplet. Caddy handles TLS via Let's Encrypt. Domain points to Droplet IP. GitHub repo enables `git pull` deploys.

**Estimated total time:** 2-3 hours across all tasks

**Monthly cost:** ~$29/mo (Droplet $24 + automated backups $4.80)

---

## Pre-Requisites

You will need:
- A DigitalOcean account (sign up at digitalocean.com, they often give $200 free credit for 60 days)
- A GitHub account
- Your Namecheap account (for donuttrade.com DNS)
- Your `.env` file values (you have these already from local dev)
- SSH key on your laptop (or willingness to create one)

---

## Task 1: Push Code to GitHub

**Status: DONE** — Repo at `https://github.com/meya420/donuttrade` (private).

---

## Task 2: Production Config Files

**Status: DONE** — Production override files created. No source code was modified; the dev setup (`moldo.go.ro:9443`) is untouched.

**Files created:**
- `Caddyfile.production` — Caddy config for `donuttrade.com` on standard port 443
- `docker-compose.production.yml` — Overrides port, Caddyfile, CORS, and build args
- `.env.production.example` — Template for the production `.env` on the Droplet

**How it works:** On the Droplet, you run:
```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```
This merges the production overrides on top of the base config. Locally, `docker compose up -d` still uses the dev config.

- [ ] **Step 1: Update OAuth redirect URIs in provider dashboards (do this before deploying)**

**Microsoft** (https://portal.azure.com → App registrations):
- Add redirect URI: `https://donuttrade.com/auth/microsoft/callback`
- (Keep the old `moldo.go.ro` one too, so dev still works)

**Discord** (https://discord.com/developers/applications):
- Add redirect URI: `https://donuttrade.com/auth/discord/callback`
- (Keep the old one too)

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "chore: add production config for donuttrade.com deployment"
git push
```

---

## Task 3: Create the Droplet

- [ ] **Step 1: Generate an SSH key (if you don't have one)**

On your laptop (Git Bash or PowerShell):
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

Press Enter for default location. Set a passphrase (or leave empty).

This creates:
- `~/.ssh/id_ed25519` (private key — never share)
- `~/.ssh/id_ed25519.pub` (public key — upload to DO)

- [ ] **Step 2: Add SSH key to DigitalOcean**

Go to https://cloud.digitalocean.com/account/security
- Click "Add SSH Key"
- Paste the contents of `~/.ssh/id_ed25519.pub`
- Name it something like "laptop"

- [ ] **Step 3: Create the Droplet**

Go to https://cloud.digitalocean.com/droplets/new

Settings:
- **Region:** Choose the closest to your Minecraft server (e.g., Frankfurt if EU, New York if US)
- **Image:** Ubuntu 24.04 LTS
- **Size:** Regular → **$24/mo** (4 GB RAM / 2 vCPU / 80 GB SSD)
- **Backups:** Enable ($4.80/mo)
- **Authentication:** SSH Key (select the one you just added)
- **Hostname:** `donuttrade`

Click Create Droplet. Note the **IP address** (e.g., `164.90.xxx.xxx`).

- [ ] **Step 4: Verify SSH access**

```bash
ssh root@YOUR_DROPLET_IP
```

You should see the Ubuntu welcome message. Type `exit` to disconnect.

---

## Task 4: Point Domain to Droplet

- [ ] **Step 1: Configure DNS in Namecheap**

Go to https://ap.www.namecheap.com → Domain List → donuttrade.com → Advanced DNS

Delete any existing A records, then add:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `YOUR_DROPLET_IP` | Automatic |
| A Record | `www` | `YOUR_DROPLET_IP` | Automatic |

- [ ] **Step 2: Wait for DNS propagation**

This can take 5-30 minutes. Check with:
```bash
nslookup donuttrade.com
```

You should see your Droplet IP. If it still shows old values, wait a bit longer.

---

## Task 5: Set Up the Droplet

- [ ] **Step 1: SSH in and install Docker**

```bash
ssh root@YOUR_DROPLET_IP
```

Then run:
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

- [ ] **Step 2: Install Git**

```bash
apt install -y git
```

- [ ] **Step 3: Set up automatic security updates**

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Select "Yes" when prompted. This auto-installs security patches.

- [ ] **Step 4: Set up firewall**

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Type `y` to confirm. This blocks all ports except SSH (22), HTTP (80), and HTTPS (443).

- [ ] **Step 5: Create a non-root user (optional but recommended)**

```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Copy SSH key to new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Test: open a NEW terminal and try
# ssh deploy@YOUR_DROPLET_IP
```

If this works, you can disable root SSH login later for extra security.

---

## Task 6: Deploy the Application

- [ ] **Step 1: Clone the repo on the Droplet**

```bash
ssh root@YOUR_DROPLET_IP   # or deploy@YOUR_DROPLET_IP

cd /opt
git clone https://github.com/meya420/donuttrade.git
cd donuttrade
```

(The repo is private — GitHub will ask you to authenticate via browser, just like on your laptop.)

- [ ] **Step 2: Create the .env file**

```bash
nano /opt/donuttrade/.env
```

Use `.env.production.example` as your guide — it has all the production values pre-filled for `donuttrade.com`. Copy it and fill in your secrets:

```bash
cp .env.production.example .env
nano .env
```

Fill in all the empty values (client IDs, secrets, tokens, etc.).

**Important:** Generate strong secrets for JWT and webhook:
```bash
openssl rand -hex 32    # Run this 4 times for: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, BOT_WEBHOOK_SECRET, CODE_SIGNING_SECRET
```

Save with Ctrl+O, Enter, Ctrl+X.

- [ ] **Step 3: Build and start everything**

```bash
cd /opt/donuttrade
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

This will take 5-10 minutes on first build. Watch logs:
```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f
```

You should see:
- Caddy acquiring the Let's Encrypt certificate
- Prisma running migrations
- API starting on port 3001
- Web starting on port 3000
- MC-bot attempting to connect
- Management-bot logging into Discord

Press Ctrl+C to stop following logs (containers keep running).

- [ ] **Step 4: Verify the site**

Open `https://donuttrade.com` in your browser. You should see your landing page.

Test:
- [ ] Landing page loads
- [ ] Login page loads (`/login`)
- [ ] Microsoft OAuth redirect works
- [ ] Discord OAuth redirect works
- [ ] API health check: `curl https://donuttrade.com/health` returns OK

- [ ] **Step 5: Handle MC-Bot Microsoft authentication**

The Minecraft bot needs a one-time browser OAuth login. On the Droplet it has no browser.

**Option A (recommended): Copy the token cache from your laptop**

On your laptop, run the mc-bot locally once to authenticate:
```bash
cd R:\miau
docker compose up mc-bot
```

After authenticating in the browser, the tokens are cached. Copy them to the Droplet:
```bash
# Find the local volume path
docker volume inspect miau_mc_bot_nmp_cache

# Or extract from the container
docker cp donuttrade-mc-bot:/root/.minecraft/nmp-cache ./nmp-cache-backup

# Upload to Droplet
scp -r ./nmp-cache-backup root@YOUR_DROPLET_IP:/tmp/nmp-cache

# On the Droplet, copy into the Docker volume
ssh root@YOUR_DROPLET_IP
docker cp /tmp/nmp-cache donuttrade-mc-bot:/root/.minecraft/nmp-cache
docker compose -f docker-compose.yml -f docker-compose.production.yml restart mc-bot
```

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "chore: deployment verified"
git push
```

---

## Task 7: Set Up Monitoring & Alerts

- [ ] **Step 1: Enable DigitalOcean monitoring**

Go to https://cloud.digitalocean.com/droplets → your Droplet → Monitoring

Install the monitoring agent (if not already installed):
```bash
curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash
```

- [ ] **Step 2: Create alerts**

In the DO dashboard → Monitoring → Create Alert Policy:

| Metric | Threshold | Window |
|---|---|---|
| CPU | > 80% | 5 minutes |
| Memory | > 85% | 5 minutes |
| Disk | > 80% | 15 minutes |

Set notification to your email.

- [ ] **Step 3: Test container auto-restart**

Verify `restart: unless-stopped` works:
```bash
docker kill donuttrade-api
docker ps  # Wait 5-10 seconds, api should be back
```

---

## Task 8: Set Up Simple Deploy Workflow

**For future updates:** When you make changes on your laptop and want to deploy.

- [ ] **Step 1: Create a deploy script on the Droplet**

```bash
cat > /opt/donuttrade/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/donuttrade
echo "Pulling latest code..."
git pull
echo "Building and restarting..."
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
echo "Waiting for health check..."
sleep 10
curl -sf https://donuttrade.com/health && echo " OK" || echo " FAILED"
echo "Deploy complete. Logs:"
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=20
EOF
chmod +x /opt/donuttrade/deploy.sh
```

- [ ] **Step 2: Deploy workflow**

From now on, your deploy process is:

On your laptop:
```bash
git add -A
git commit -m "feat: whatever you changed"
git push
```

On the Droplet:
```bash
ssh root@YOUR_DROPLET_IP
/opt/donuttrade/deploy.sh
```

That's it. Two commands.

---

## Task 9: Production Hardening Checklist

These are not urgent but should be done before real users arrive:

- [ ] **Change database credentials** — Replace `dev:dev` with a strong password in `.env` and `docker-compose.yml`
- [ ] **Remove debug services** — The `redis-commander` and `pgadmin` services are already behind a `debug` profile (won't start by default). Good.
- [ ] **Remove localhost port bindings for Postgres/Redis** — In `docker-compose.yml`, the lines `"127.0.0.1:5432:5432"` and `"127.0.0.1:6379:6379"` expose these on the Droplet's localhost. On a single-server setup this is fine, but you can remove them for extra safety since all services connect via Docker network.
- [ ] **Set up log rotation** — Docker logs can fill disk over time:
```bash
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker
```

---

## Upgrade Path (Future Reference)

| When | Do | Cost after |
|---|---|---|
| **Now** | DO Droplet + self-hosted DB | $29/mo |
| **First paying users** | Add managed PostgreSQL ($15) for backup safety | $44/mo |
| **10+ active users** | Add managed Redis ($15) | $59/mo |
| **Outgrowing Droplet** | Resize to 8GB RAM ($48) or move to App Platform | $63-85/mo |
| **Real scale** | AWS ECS/Fargate or DO Kubernetes | $120+/mo |

---

## Quick Reference Card

Shorthand for all production compose commands:
```bash
# Add this alias on the Droplet (put in ~/.bashrc):
alias dc='docker compose -f docker-compose.yml -f docker-compose.production.yml'
```

Then all commands become `dc up -d`, `dc logs -f`, `dc restart mc-bot`, etc.

| Task | Command |
|---|---|
| SSH into server | `ssh root@YOUR_DROPLET_IP` |
| View all container status | `dc ps` |
| View logs (all) | `dc logs -f` |
| View logs (one service) | `dc logs -f api` |
| Restart a service | `dc restart mc-bot` |
| Deploy update | `git push` then `ssh root@IP /opt/donuttrade/deploy.sh` |
| Database backup (manual) | `docker exec donuttrade-postgres pg_dump -U produser donuttrade > backup.sql` |
| Restore database | `cat backup.sql \| docker exec -i donuttrade-postgres psql -U produser donuttrade` |
| Check disk space | `df -h` |
| Check memory | `free -h` |
| OS security updates | `apt update && apt upgrade -y` |
