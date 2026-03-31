# DonutTrade Authentication Setup Guide

This guide walks you through setting up the three authentication methods for DonutTrade: Microsoft OAuth, Discord OAuth, and Email/Password. Each method lets users sign up and log in, but all users must complete in-game payment verification before their account is activated.

**Prerequisites:**
- The DonutTrade API is deployed and running (or you have a local dev environment)
- You have access to the `.env` file at the project root
- You know your domain (e.g., `donuttrade.com` for production, `moldo.go.ro:9443` for dev)

---

## Table of Contents

1. [Microsoft OAuth Setup](#1-microsoft-oauth-setup)
2. [Discord OAuth Setup](#2-discord-oauth-setup)
3. [Email and Password Setup](#3-email-and-password-setup)
4. [JWT Secrets](#4-jwt-secrets)
5. [Verifying Your Configuration](#5-verifying-your-configuration)

---

## 1. Microsoft OAuth Setup

Microsoft OAuth allows users to log in with their personal Microsoft account (the same account they use for Outlook, Xbox, etc.). DonutTrade uses this for **identity only** — it reads the user's Microsoft ID and email, nothing else.

### Step 1: Go to Azure Portal

1. Open [Azure Portal](https://portal.azure.com) and sign in with your Microsoft account.
2. In the search bar at the top, type **"App registrations"** and click it.
3. Click **"+ New registration"**.

### Step 2: Register the Application

Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `DonutTrade` (or whatever you want to call it) |
| **Supported account types** | Select **"Personal Microsoft accounts only"** |
| **Redirect URI** | Platform: **Web**, URI: see below |

**Redirect URI values:**
- For local development: `http://localhost:3000/auth/callback`
- For production: `https://yourdomain.com/auth/microsoft/callback`

> You can add multiple redirect URIs later. For now, add at least one.

Click **"Register"**.

### Step 3: Copy Your Client ID

After registration, you'll land on the app's **Overview** page. Copy the **Application (client) ID** — this is your `MICROSOFT_CLIENT_ID`.

It looks like a UUID: `214728de-2c44-4234-b82b-37d6ef43ef21`

### Step 4: Create a Client Secret

1. In the left sidebar, click **"Certificates & secrets"**.
2. Click **"+ New client secret"**.
3. Give it a description (e.g., `DonutTrade Production`) and pick an expiry (24 months is the max).
4. Click **"Add"**.
5. **Immediately copy the "Value" column** — this is your `MICROSOFT_CLIENT_SECRET`. You will NOT be able to see it again after you leave this page.

> If you lose the secret, you'll need to create a new one and update your `.env` file.

### Step 5: Verify API Permissions

1. In the left sidebar, click **"API permissions"**.
2. You should see **Microsoft Graph** with these permissions already added by default:
   - `openid` — Sign users in
   - `email` — View users' email address
   - `profile` — View users' basic profile
   - `offline_access` — Maintain access (needed for refresh tokens)
3. If any are missing, click **"+ Add a permission"** → **Microsoft Graph** → **Delegated permissions** and add them.
4. These are all **delegated permissions** (meaning they act on behalf of the user), so they do NOT require admin consent.

### Step 6: Add Your Redirect URIs

If you need to add more redirect URIs (e.g., both dev and production):

1. In the left sidebar, click **"Authentication"**.
2. Under **"Web" > "Redirect URIs"**, add all the URIs you need:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/microsoft/callback` (production)
3. Click **"Save"**.

### Step 7: Update Your `.env` File

Add these values to your `.env`:

```env
MICROSOFT_CLIENT_ID=214728de-2c44-4234-b82b-37d6ef43ef21
MICROSOFT_CLIENT_SECRET=your-secret-value-from-step-4
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback
```

> For local development, set the redirect URI to `http://localhost:3000/auth/callback`.

### How It Works Behind the Scenes

When a user clicks "Sign in with Microsoft":
1. They're redirected to Microsoft's login page
2. After login, Microsoft redirects back to your `MICROSOFT_REDIRECT_URI` with a one-time code
3. DonutTrade exchanges that code for tokens, reads the user's Microsoft ID and email from the ID token
4. The user is then asked to enter their Minecraft username and complete payment verification

The scopes DonutTrade requests are: `openid email profile offline_access`. These are standard OpenID Connect scopes — no Xbox or Minecraft permissions are involved.

---

## 2. Discord OAuth Setup

Discord OAuth allows users to log in with their Discord account. DonutTrade reads their Discord ID and username.

### Step 1: Go to Discord Developer Portal

1. Open [Discord Developer Portal](https://discord.com/developers/applications) and log in.
2. Click **"New Application"** in the top-right corner.
3. Give it a name (e.g., `DonutTrade`) and click **"Create"**.

### Step 2: Copy Your Client ID and Secret

1. You'll land on the **General Information** page.
2. Copy the **Application ID** — this is your `DISCORD_CLIENT_ID`.
3. Click **"OAuth2"** in the left sidebar.
4. Under **Client Secret**, click **"Reset Secret"** (or **"Copy"** if one already exists).
5. Copy the secret — this is your `DISCORD_CLIENT_SECRET`.

### Step 3: Add Redirect URIs

Still on the **OAuth2** page:

1. Scroll down to **"Redirects"**.
2. Click **"Add Redirect"** and enter:
   - For development: `http://localhost:3000/auth/discord/callback`
   - For production: `https://yourdomain.com/auth/discord/callback`
3. Click **"Save Changes"**.

### Step 4: Update Your `.env` File

Add these values to your `.env`:

```env
DISCORD_CLIENT_ID=your-application-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback
```

> For local development, use `http://localhost:3000/auth/discord/callback`.

### What Scopes Does DonutTrade Use?

DonutTrade requests two scopes from Discord:

- `identify` — Read the user's Discord ID, username, and avatar
- `email` — Read the user's email address (optional, used if available)

These are both read-only and don't let DonutTrade do anything in the user's Discord account (no sending messages, joining servers, etc.).

### How It Works Behind the Scenes

When a user clicks "Sign in with Discord":
1. They're redirected to Discord's authorization page
2. Discord asks them to approve the `identify` and `email` scopes
3. Discord redirects back to your `DISCORD_REDIRECT_URI` with a one-time code
4. DonutTrade exchanges that code for tokens, then calls Discord's API to get the user's ID and username
5. The user is then asked to enter their Minecraft username and complete payment verification

---

## 3. Email and Password Setup

Email/password auth lets users sign up with an email address and password. DonutTrade sends a 6-digit verification code to confirm the email is real before proceeding.

### Step 1: Create a Resend Account

DonutTrade uses [Resend](https://resend.com) to send verification emails. Resend was chosen because it's simple, developer-friendly, and has a generous free tier.

1. Go to [resend.com](https://resend.com) and create an account.
2. You get **3,000 emails/month for free** (100/day), which is more than enough for most use cases.

### Step 2: Add and Verify Your Domain

To send emails from your own domain (e.g., `noreply@donuttrade.com`), you need to prove you own it:

1. In the Resend dashboard, go to **"Domains"** and click **"Add Domain"**.
2. Enter your domain (e.g., `donuttrade.com`).
3. Resend will give you **DNS records** to add. These typically include:
   - A **TXT** record for SPF (tells email providers Resend is allowed to send on your behalf)
   - A **CNAME** record for DKIM (cryptographic signature proving emails are authentic)
   - Optionally a **DMARC** record (policy for handling unauthenticated emails)
4. Add these records in your domain registrar's DNS settings (e.g., Cloudflare, Namecheap, GoDaddy).
5. Wait for verification — it usually takes a few minutes, but DNS can take up to 48 hours.

> **If you don't have a custom domain:** You can use Resend's shared domain (`onboarding@resend.dev`) for testing, but emails may land in spam. For production, you should use your own domain.

### Step 3: Create an API Key

1. In the Resend dashboard, go to **"API Keys"**.
2. Click **"Create API Key"**.
3. Give it a name (e.g., `DonutTrade Production`), select **"Sending access"** permission, and optionally restrict it to your domain.
4. Copy the API key — it starts with `re_` followed by a long string.

### Step 4: Update Your `.env` File

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM_ADDRESS=noreply@donuttrade.com
```

> The `EMAIL_FROM_ADDRESS` must be from a domain you've verified in Resend, or use `onboarding@resend.dev` for testing.

### How Email Verification Works

When a user signs up with email/password:
1. They enter their email and choose a password
2. DonutTrade sends a **6-digit verification code** to their email
3. The code expires in **15 minutes**
4. The user enters the code on the website to verify their email
5. If the code expires, they can request a new one (up to **3 resend attempts**, with a **1-minute cooldown** between resends)
6. Once verified, they enter their Minecraft username and proceed to payment verification

### Password Requirements

Passwords must meet these rules:
- At least **8 characters** long
- At least **one uppercase letter** (A-Z)
- At least **one lowercase letter** (a-z)
- At least **one number** (0-9)

Passwords are hashed with **bcrypt** (12 salt rounds) before storage. The plain-text password is never saved or logged.

---

## 4. JWT Secrets

All three auth methods use JWT tokens for session management after login. You need to generate two secrets:

### Generate Secrets

Run this command twice to get two different secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each run gives you a 64-character hex string like:
```
a1b2c3d4e5f6...
```

### Update Your `.env` File

```env
JWT_ACCESS_SECRET=your-first-64-char-hex-string
JWT_REFRESH_SECRET=your-second-64-char-hex-string
```

> These must be **at least 32 characters** long. The 64-character hex strings from the command above are ideal.
>
> **Never reuse the same secret for both.** If someone cracks one, the other stays secure.

### What Are These For?

- **`JWT_ACCESS_SECRET`** — Signs short-lived access tokens (valid 15 minutes). These are sent with every API request to prove the user is logged in.
- **`JWT_REFRESH_SECRET`** — Signs long-lived refresh tokens (valid 30 days). These are used to get new access tokens without making the user log in again.

---

## 5. Verifying Your Configuration

After setting everything up, here's how to confirm it's working.

### Check Your `.env` File

Your complete auth-related `.env` entries should look like this:

```env
# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-uuid-here
MICROSOFT_CLIENT_SECRET=your-secret-here
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-app-id
DISCORD_CLIENT_SECRET=your-discord-secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback

# Email (Resend)
RESEND_API_KEY=re_your_api_key
EMAIL_FROM_ADDRESS=noreply@donuttrade.com

# JWT
JWT_ACCESS_SECRET=your-64-char-hex-string-1
JWT_REFRESH_SECRET=your-64-char-hex-string-2
```

### Start the API and Check Logs

```bash
cd packages/api
npm run dev
```

On startup, the API logs a redacted config summary. Look for:

```
MICROSOFT_CLIENT_ID: [SET]
MICROSOFT_CLIENT_SECRET: [REDACTED]
DISCORD_CLIENT_ID: [SET]
DISCORD_CLIENT_SECRET: [REDACTED]
RESEND_API_KEY: [REDACTED]
JWT_ACCESS_SECRET: [REDACTED]
JWT_REFRESH_SECRET: [REDACTED]
```

If any say `[NOT SET]`, that variable is missing from your `.env`.

### Common Issues

| Problem | Fix |
|---------|-----|
| Microsoft login gives "redirect_uri mismatch" | The redirect URI in your `.env` must **exactly match** one of the URIs registered in Azure Portal (including http vs https, trailing slashes, port numbers) |
| Discord login gives "Invalid OAuth2 redirect_uri" | Same as above — the redirect URI must exactly match what's in Discord Developer Portal |
| Emails land in spam | Verify your domain's DNS records in Resend. Make sure SPF, DKIM, and DMARC records are all set up |
| "OAuth is not configured" error on `/auth/microsoft` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, or `MICROSOFT_REDIRECT_URI` is missing from `.env` |
| JWT errors on login | Make sure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are at least 32 characters long |
| Microsoft secret stopped working | Client secrets expire. Check the expiry date in Azure Portal and create a new one if needed |

---

## What Happens After Auth: Payment Verification

Regardless of which method a user signs up with, they must verify their Minecraft username by sending an in-game payment:

1. After signing up, the user enters their Minecraft username on the website
   - Java Edition players enter their username as-is (e.g., `Givey`)
   - Bedrock Edition players prefix with a dot (e.g., `.Givey`)
2. The server generates a **random amount between $1 and $1,000**
3. The user has **15 minutes** to pay that exact amount to the DonutTrade bot in-game using `/pay`
4. The verification bot (a Mineflayer bot connected to the Minecraft server) watches for incoming payments
5. If the amount matches, the account is verified and the user can start trading
6. If time runs out, the verification expires and the user can try again with a new random amount

This verification proves the user actually owns the Minecraft account they claimed. The payment amount is random to prevent someone from guessing or reusing a verification from another user.
