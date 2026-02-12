# DonutTrade - Authentication Methods Guide

**Version:** 2.0
**Date:** February 2026

This document describes the three authentication methods available on the DonutTrade platform, their use cases, and technical flows.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Bedrock Edition Disclaimer](#2-bedrock-edition-disclaimer)
3. [Method 1: Microsoft OAuth](#3-method-1-microsoft-oauth)
4. [Method 2: Discord OAuth](#4-method-2-discord-oauth)
5. [Method 3: Classic Email + Password](#5-method-3-classic-email--password)
6. [Payment Verification (Shared Step)](#6-payment-verification-shared-step)
7. [Returning User Login Flows](#7-returning-user-login-flows)
8. [Session Management](#8-session-management)

---

## 1. Overview

DonutTrade offers three ways for users to create an account and sign in. All three methods converge into a shared post-signup flow: the user enters their Minecraft username, then verifies ownership by paying a random amount to the verification bot in-game.

```
                    ┌──────────────────────┐
                    │     SIGNUP PAGE       │
                    │                       │
                    │  [Microsoft OAuth]    │
                    │  [Discord OAuth]      │
                    │  [Email + Password]   │
                    └──────┬───┬───┬────────┘
                           │   │   │
           ┌───────────────┘   │   └───────────────┐
           ▼                   ▼                   ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
    │  Microsoft   │  │   Discord    │  │  Email + Password │
    │  OAuth Flow  │  │  OAuth Flow  │  │  Registration     │
    │              │  │              │  │  + Email Verify   │
    └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
           │                 │                    │
           └────────────┬────┘────────────────────┘
                        ▼
              ┌───────────────────┐
              │  Enter Minecraft  │
              │  Username         │
              │  (with Bedrock    │
              │   disclaimer)     │
              └────────┬──────────┘
                       ▼
              ┌───────────────────┐
              │  Payment          │
              │  Verification     │
              │  (pay 1-1000 to   │
              │   bot in-game)    │
              └────────┬──────────┘
                       ▼
              ┌───────────────────┐
              │  Account Created  │
              │  → Dashboard      │
              └───────────────────┘
```

### Why Three Methods?

| Method | Best For |
|--------|----------|
| **Microsoft OAuth** | Users who want a quick, familiar sign-in using their Microsoft account. One-click login for returning users. |
| **Discord OAuth** | Users active in the gaming community who prefer linking their Discord identity. Common in Minecraft communities. |
| **Email + Password** | Users who prefer traditional credentials without relying on any third-party service. Full control over their account. |

---

## 2. Bedrock Edition Disclaimer

**IMPORTANT: This disclaimer MUST appear everywhere on the platform where a user enters their Minecraft username.**

> **Bedrock Edition Users:** If you have a Minecraft Bedrock Edition account, you must write your username with a dot (`.`) in front.
>
> **Example:**
> - `.givey` — Bedrock Edition account
> - `givey` — Java Edition account

### Implementation Requirements

- Display this disclaimer **directly below** every Minecraft username input field
- Use a visually distinct style (info box, highlighted background)
- Include the example with both formats
- This applies to: signup forms, profile edit pages, admin user management, and any other location where a username is entered

---

## 3. Method 1: Microsoft OAuth

### Use Case

Users who already have a Microsoft account and want a quick, secure sign-up or login. Microsoft is used purely as an identity provider — it verifies who the user is, not what they own in Minecraft.

### When to Use This Method

- The user has a personal Microsoft account (outlook.com, hotmail.com, live.com, or any Microsoft-linked email)
- The user wants a fast one-click sign-in experience for returning visits
- The user prefers OAuth over managing a separate password

### Signup Flow

```
1. User clicks "Sign up with Microsoft" on the signup page
2. User is redirected to Microsoft's OAuth consent screen
   - URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
   - Scopes requested: openid, email, profile, offline_access
3. User grants consent (or logs into their Microsoft account first)
4. Microsoft redirects back to our callback URL with an authorization code
5. Server exchanges the authorization code for an access token + ID token
6. Server extracts the user's Microsoft ID (oid claim) and email from the ID token
7. Server checks if a user with this Microsoft ID already exists:
   - If YES → log them in, issue session tokens, redirect to dashboard
   - If NO → redirect to the Minecraft username entry page (unskippable)
8. User enters their Minecraft username (with Bedrock disclaimer displayed)
9. User is redirected to the payment verification page (unskippable)
10. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
11. Once payment is confirmed → account is created, session tokens issued, redirect to dashboard
```

### Azure App Configuration

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Create or update the application:
   - **Supported account types:** "Personal Microsoft accounts only"
   - **Redirect URI:** `https://yourdomain.com/auth/microsoft/callback` (Web platform)
3. Under **API permissions**, ensure these are consented:
   - `openid` (Sign users in)
   - `email` (View users' email address)
   - `profile` (View users' basic profile)
   - `offline_access` (Maintain access — for refresh tokens)
4. Under **Certificates & secrets**, create a client secret
5. Store `Client ID` and `Client Secret` in environment variables

**Note:** The `XboxLive.signin` scope is **NOT** used. Microsoft OAuth is identity-only.

### Environment Variables

```
MICROSOFT_CLIENT_ID=<your-azure-app-client-id>
MICROSOFT_CLIENT_SECRET=<your-azure-app-client-secret>
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback
```

### Error Scenarios

| Error | Cause | User Experience |
|-------|-------|-----------------|
| User cancels consent | Clicks "Cancel" on Microsoft login | Redirected back to signup page with message |
| Account suspended | Microsoft account is disabled | Error page explaining the issue |
| Token exchange failure | Network or configuration error | Generic error page, retry option |
| Microsoft ID already linked | User already has an account via Microsoft | Logged in automatically |

---

## 4. Method 2: Discord OAuth

### Use Case

Users who are active in the gaming/Minecraft community and prefer linking their Discord account. Discord OAuth is widely used in gaming platforms and feels natural for this user base.

### When to Use This Method

- The user has a Discord account
- The user is active in Minecraft or gaming Discord servers
- The user prefers Discord as their identity provider
- The user doesn't have or doesn't want to use a Microsoft account

### Signup Flow

```
1. User clicks "Sign up with Discord" on the signup page
2. User is redirected to Discord's OAuth consent screen
   - URL: https://discord.com/oauth2/authorize
   - Scopes requested: identify, email
3. User authorizes the DonutTrade application (or logs into Discord first)
4. Discord redirects back to our callback URL with an authorization code
5. Server exchanges the authorization code for an access token
6. Server fetches user info from Discord API (GET /users/@me)
7. Server extracts the user's Discord ID, username, and email
8. Server checks if a user with this Discord ID already exists:
   - If YES → log them in, issue session tokens, redirect to dashboard
   - If NO → redirect to the Minecraft username entry page (unskippable)
9. User enters their Minecraft username (with Bedrock disclaimer displayed)
10. User is redirected to the payment verification page (unskippable)
11. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
12. Once payment is confirmed → account is created, session tokens issued, redirect to dashboard
```

### Discord Application Configuration

1. Go to **Discord Developer Portal** → **Applications** → **New Application**
2. Under **OAuth2**:
   - Add redirect URL: `https://yourdomain.com/auth/discord/callback`
   - Scopes: `identify` (required), `email` (required)
3. Copy the **Client ID** and **Client Secret**
4. Under **Bot** (separate from OAuth):
   - Create a bot for the DonutTrade Discord server (announcements, support, etc.)
   - This bot is separate from the OAuth authentication flow

**Note:** The Discord bot and the Discord OAuth flow are separate things. The bot serves the DonutTrade community Discord server. The OAuth flow authenticates users on the website.

### Environment Variables

```
DISCORD_CLIENT_ID=<your-discord-app-client-id>
DISCORD_CLIENT_SECRET=<your-discord-app-client-secret>
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback
DISCORD_BOT_TOKEN=<your-discord-bot-token>
```

### Error Scenarios

| Error | Cause | User Experience |
|-------|-------|-----------------|
| User cancels authorization | Clicks "Cancel" on Discord login | Redirected back to signup page with message |
| Account disabled | Discord account is disabled/banned | Error page explaining the issue |
| Token exchange failure | Network or configuration error | Generic error page, retry option |
| Discord ID already linked | User already has an account via Discord | Logged in automatically |

---

## 5. Method 3: Classic Email + Password

### Use Case

Users who prefer a traditional registration flow without relying on any third-party OAuth provider. This gives users full control over their credentials.

### When to Use This Method

- The user doesn't want to use Microsoft or Discord for sign-in
- The user prefers managing their own email + password
- The user wants an account independent of third-party services
- The user doesn't have a Microsoft or Discord account

### Signup Flow

```
1. User clicks "Sign up with Email" on the signup page
2. User fills out the registration form:
   - Email address
   - Password
   - Retype password (must match)
   - Minecraft username (with Bedrock disclaimer displayed)
3. Server validates the form:
   - Email format is valid
   - Passwords match
   - Password meets requirements (8+ characters, mixed case + number)
   - Minecraft username format is valid
   - Email is not already registered
4. Server sends a verification email with a 6-digit code
5. User is redirected to the email verification page (unskippable)
6. User enters the 6-digit code from their email
   - Code is valid for 15 minutes
   - Maximum 3 resend attempts
7. If code is valid → redirect to payment verification page (unskippable)
8. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
9. Once payment is confirmed → account is created, session tokens issued, redirect to dashboard
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Stored as bcrypt hash (12 salt rounds)
- Never stored or logged in plain text

### Email Verification

- 6-digit numeric code sent to the user's email
- Valid for 15 minutes after sending
- Maximum 3 resend attempts per registration flow
- Rate limiting: 1 send per 60 seconds

### Email Service: Resend (Recommended)

We recommend **Resend** (resend.com) as the email delivery service:

- Modern, developer-friendly API
- Generous free tier: 3,000 emails/month, 100 emails/day
- Simple integration (single API call to send)
- Good deliverability
- Alternative options: SendGrid, AWS SES, Postmark

### Environment Variables

```
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM_ADDRESS=noreply@donuttrade.com
```

### Error Scenarios

| Error | Cause | User Experience |
|-------|-------|-----------------|
| Email already registered | Email in use by another account | Error message on registration form |
| Passwords don't match | Retyped password differs | Inline form validation error |
| Weak password | Doesn't meet requirements | Inline form validation with requirements list |
| Invalid email | Malformed email address | Inline form validation error |
| Verification code expired | 15 minutes elapsed | "Code expired" message with resend button |
| Too many resend attempts | Exceeded 3 resends | Message to try again later or contact support |
| Username taken | Minecraft username already registered | Error message on username field |

---

## 6. Payment Verification (Shared Step)

### Overview

After completing any of the three signup methods, the user must verify ownership of their Minecraft account by sending an in-game payment to the DonutTrade verification bot. This is the final step before the account is activated.

### Purpose

- Verifies the user actually has access to the Minecraft account they claimed
- Prevents users from registering with someone else's username
- Acts as a lightweight proof-of-ownership without needing Minecraft API access

### How It Works

```
1. User reaches the payment verification page
2. Server generates a random integer between 1 and 1000
3. Page displays:
   ┌─────────────────────────────────────────────────┐
   │  VERIFY YOUR MINECRAFT ACCOUNT                  │
   │                                                  │
   │  Pay exactly $[AMOUNT] to [BOT_USERNAME]         │
   │                                                  │
   │  In-game command:                                │
   │  /pay [BOT_USERNAME] [AMOUNT]                    │
   │                                                  │
   │  Time remaining: 14:32                           │
   │                                                  │
   │  Waiting for payment...                          │
   └─────────────────────────────────────────────────┘
4. A 15-minute countdown timer is displayed
5. The verification bot monitors incoming payments on the DonutSMP server
6. When a matching payment is detected (correct username + exact amount):
   → Account is finalized
   → Session tokens are issued
   → User is redirected to the dashboard
7. If 15 minutes elapse without payment:
   → Verification is marked as EXPIRED (soft delete)
   → User sees "Verification expired" message with a retry button
```

### Verification Bot

The payment verification bot is a **new, separate Minecraft bot** (not the existing legacy bot in `src/`):

- Connects to the DonutSMP server using Mineflayer
- Dedicated account for verification purposes
- Listens for incoming `/pay` payments
- Matches payments against pending verifications (by sender username + exact amount)
- Reports successful verifications to the API

### Soft Delete on Timeout

When the 15-minute timer expires, the system does **NOT** hard-delete the user data. Instead:

1. The verification record is marked as `expired`
2. All previously entered data is preserved (Microsoft/Discord ID, email, Minecraft username)
3. User sees a "Verification expired" page with a **"Try Again"** button
4. Clicking "Try Again":
   - Generates a **new** random amount (1-1000)
   - Resets the 15-minute timer
   - The user does **NOT** need to re-enter their information
5. There is no limit on retry attempts

### Edge Cases

| Scenario | Handling |
|----------|----------|
| User pays wrong amount | Payment not matched; countdown continues; user can try again with correct amount |
| User pays from different username | Payment not matched; only payments from the registered username are accepted |
| Multiple pending verifications for same username | Not possible — one pending verification per username at a time |
| Bot is offline | Verification page shows error; retry when bot is back online |
| Server is under maintenance | Verification page shows maintenance message |

---

## 7. Returning User Login Flows

Once a user has completed signup and payment verification, they can log in using the method they registered with.

### 7.1 Microsoft Login

```
1. User clicks "Login with Microsoft"
2. Microsoft OAuth flow (same as signup)
3. Server matches the Microsoft ID to an existing user
4. Session tokens issued → redirect to dashboard
```

### 7.2 Discord Login

```
1. User clicks "Login with Discord"
2. Discord OAuth flow (same as signup)
3. Server matches the Discord ID to an existing user
4. Session tokens issued → redirect to dashboard
```

### 7.3 Email/Password Login

```
1. User enters email and password on the login form
2. Server validates credentials (bcrypt compare)
3. If valid → session tokens issued → redirect to dashboard
4. If invalid → "Invalid email or password" error
```

### 7.4 Forgot Password

For email/password users only:

```
1. User clicks "Forgot Password" on the login page
2. User enters their email address
3. Server sends a password reset email with a one-time token
4. User clicks the link in the email
5. User enters a new password (must meet password requirements)
6. Password is updated, user is redirected to login
```

- Reset token is valid for 1 hour
- One active reset token per user at a time
- Rate limited: 3 requests per hour per email

---

## 8. Session Management

All three authentication methods use the same session system after login.

### JWT Tokens

| Token | Purpose | Expiry | Storage |
|-------|---------|--------|---------|
| **Access Token** | Authenticates API requests | 15 minutes | Memory / Authorization header |
| **Refresh Token** | Obtains new access tokens | 30 days | HTTP-only cookie + hashed in database |

### Access Token Payload

```json
{
  "sub": "user-uuid",
  "username": "minecraftUsername",
  "authProvider": "microsoft|discord|email",
  "iat": 1706000000,
  "exp": 1706000900
}
```

### Token Refresh Flow

```
1. Client's access token expires
2. Client sends POST /auth/refresh (refresh token sent via cookie)
3. Server validates refresh token against hashed value in database
4. Server issues new access token + rotates refresh token
5. Old refresh token is invalidated
```

### Logout

- `POST /auth/logout` — Revokes the current session (deletes refresh token from database)
- `POST /auth/logout-all` — Revokes all sessions for the user (useful if account is compromised)

### Security Notes

- Refresh tokens are stored as SHA-256 hashes in the database (never in plain text)
- Access tokens are signed with a strong secret (HS256 or RS256)
- Cookies use `HttpOnly`, `Secure`, `SameSite=Strict` flags
- Each session tracks `userAgent` and `ipAddress` for auditing
