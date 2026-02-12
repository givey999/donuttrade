# DonutTrade Platform - Complete Specification Document

**Version:** 2.0
**Date:** February 2026 (Updated for multi-method authentication)
**Status:** Draft for Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Overview](#2-platform-overview)
3. [User Stories & Use Cases](#3-user-stories--use-cases)
4. [Authentication System](#4-authentication-system)
5. [User Interface Specification](#5-user-interface-specification)
6. [Administrator Interface](#6-administrator-interface)
7. [Data Model Specification](#7-data-model-specification)
8. [API Specification](#8-api-specification)
9. [Bot Integration Architecture](#9-bot-integration-architecture)
10. [Technology Stack Recommendations](#10-technology-stack-recommendations)
11. [Security Considerations](#11-security-considerations)
12. [Glossary](#12-glossary)

---

## 1. Executive Summary

DonutTrade is a web-based trading platform that enables players of the DonutSMP Minecraft server to safely exchange in-game items for in-game currency without the risk of scams. The platform acts as an escrow service where:

- Users deposit money via in-game `/pay` commands (detected by an automated bot)
- Users deposit items through a manual admin-verified process
- Users list items for sale at user-defined prices
- Users purchase items from other users with automatic balance transfers
- Users withdraw money or items through admin-fulfilled requests

**Key Design Decisions:**
- **Authentication**: Three methods — Microsoft OAuth, Discord OAuth, Email/Password — with in-game payment verification to prove Minecraft account ownership
- **Item Catalog**: Admin-configurable and expandable over time
- **Commission**: Admin-configurable rate on all marketplace transactions
- **Notifications**: In-app only (no email/SMS)
- **Listing Expiration**: 24 hours default, 48 hours with 10,000,000 premium fee
- **Admin System**: Role-based with fully customizable permissions
- **Pricing**: User-defined (sellers set their own prices)

**Disclaimer**: This platform is not affiliated with the DonutSMP Minecraft server.

---

## 2. Platform Overview

### 2.1 Core Functionality

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DonutTrade Platform                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   DEPOSIT   │    │ MARKETPLACE │    │  WITHDRAW   │            │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤            │
│  │ • Money     │    │ • Browse    │    │ • Money     │            │
│  │   (via bot) │    │ • List      │    │   (via bot) │            │
│  │ • Items     │    │ • Purchase  │    │ • Items     │            │
│  │   (manual)  │    │ • Cancel    │    │   (manual)  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    TRANSACTION LEDGER                        │  │
│  │  All deposits, purchases, sales, withdrawals tracked         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 User Roles

| Role | Description |
|------|-------------|
| **Guest** | Unauthenticated visitor; can view landing page only |
| **User** | Authenticated player; can deposit, trade, withdraw |
| **Admin (Custom Roles)** | Staff with configurable permissions for fulfillment, moderation, settings |

### 2.3 Platform Currency

- All transactions use the in-game currency from DonutSMP
- Amounts support K/M/B/T suffixes (1K = 1,000; 1M = 1,000,000; 1B = 1,000,000,000; 1T = 1,000,000,000,000)
- Platform stores amounts as decimal with 2 decimal places precision

---

## 3. User Stories & Use Cases

### 3.1 Authentication Use Cases

#### UC-AUTH-01: New User Registration via Microsoft OAuth
**Actor**: Guest
**Precondition**: User has a personal Microsoft account
**Flow**:
1. User clicks "Sign up with Microsoft" on the signup page
2. User is redirected to Microsoft OAuth consent screen (scopes: openid, email, profile)
3. User grants permission and completes Microsoft OAuth
4. System receives authorization code and exchanges for tokens
5. System extracts Microsoft user ID and email from ID token
6. System checks if a user with this Microsoft ID already exists
7. Since this is a new user, system creates a pending user record with `authProvider: 'microsoft'`
8. User is redirected to the Minecraft username entry page (unskippable)
9. User enters their Minecraft username (with Bedrock disclaimer displayed)
10. User is redirected to the payment verification page (unskippable)
11. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
12. Verification bot detects the payment and reports it to the API
13. System marks user as verified, issues session tokens
14. User redirected to dashboard

**Postcondition**: User account exists with Microsoft identity and verified Minecraft username

#### UC-AUTH-02: New User Registration via Discord OAuth
**Actor**: Guest
**Precondition**: User has a Discord account
**Flow**:
1. User clicks "Sign up with Discord" on the signup page
2. User is redirected to Discord OAuth consent screen (scopes: identify, email)
3. User authorizes the DonutTrade application
4. System exchanges code for access token and fetches Discord user info
5. System checks if a user with this Discord ID already exists
6. Since this is a new user, system creates a pending user record with `authProvider: 'discord'`
7. User is redirected to the Minecraft username entry page (unskippable)
8. User enters their Minecraft username (with Bedrock disclaimer displayed)
9. User is redirected to the payment verification page (unskippable)
10. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
11. Verification bot detects the payment and reports it to the API
12. System marks user as verified, issues session tokens
13. User redirected to dashboard

**Postcondition**: User account exists with Discord identity and verified Minecraft username

#### UC-AUTH-03: New User Registration via Email/Password
**Actor**: Guest
**Flow**:
1. User clicks "Sign up with Email" on the signup page
2. User fills out the registration form: email, password, retype password, Minecraft username
3. System validates form (password match, strength, email format, username format)
4. System sends verification email with 6-digit code via Resend
5. User is redirected to email verification page (unskippable)
6. User enters the 6-digit code from their email
7. System verifies the code
8. User is redirected to the payment verification page (unskippable)
9. User pays a random amount (1-1000) to the verification bot in-game within 15 minutes
10. Verification bot detects the payment and reports it to the API
11. System marks user as verified, issues session tokens
12. User redirected to dashboard

**Postcondition**: User account exists with email identity and verified Minecraft username

#### UC-AUTH-04: Minecraft Username Entry (Shared Step)
**Actor**: New user (any auth method)
**Flow**:
1. User reaches the username entry page after identity verification
2. Page displays the Bedrock edition disclaimer prominently
3. User enters their Minecraft username
   - Java users enter username directly (e.g., "PlayerName")
   - Bedrock users enter username with "." prefix (e.g., ".PlayerName")
4. System validates username format and checks for uniqueness
5. System saves the username and redirects to payment verification

**Postcondition**: Minecraft username associated with the user's account

#### UC-AUTH-05: Payment Verification (Shared Step)
**Actor**: New user (any auth method)
**Flow**:
1. User reaches the payment verification page
2. System generates a random amount between 1 and 1000
3. Page displays: "Pay $[amount] to [BotUsername] using: /pay [BotUsername] [amount]"
4. A 15-minute countdown timer is displayed
5. User logs into DonutSMP and sends the payment in-game
6. Verification bot detects the matching payment
7. System marks the user as verified and issues session tokens
8. User is redirected to dashboard

**Postcondition**: User has proven ownership of their Minecraft account

#### UC-AUTH-06: Verification Timeout and Retry
**Actor**: New user (any auth method)
**Flow**:
1. User reaches payment verification page but does not pay within 15 minutes
2. System marks the verification as expired (soft delete)
3. User sees "Verification expired" page with a "Try Again" button
4. User clicks "Try Again"
5. System generates a new random amount and resets the 15-minute timer
6. User data (identity, username) is preserved — no need to re-enter
7. User pays the new amount in-game

**Postcondition**: User can retry verification without re-entering any information

#### UC-AUTH-07: Returning User Login (Microsoft)
**Actor**: Registered User
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth (may be instant if session exists)
3. System matches Microsoft ID to existing verified account
4. System issues new platform session tokens
5. User redirected to dashboard

**Postcondition**: User logged in with refreshed session

#### UC-AUTH-08: Returning User Login (Discord)
**Actor**: Registered User
**Flow**:
1. User clicks "Login with Discord"
2. User completes Discord OAuth
3. System matches Discord ID to existing verified account
4. System issues new platform session tokens
5. User redirected to dashboard

**Postcondition**: User logged in with refreshed session

#### UC-AUTH-09: Returning User Login (Email/Password)
**Actor**: Registered User
**Flow**:
1. User enters email and password on login form
2. System validates credentials (bcrypt compare)
3. System issues new platform session tokens
4. User redirected to dashboard

**Postcondition**: User logged in

#### UC-AUTH-10: Forgot Password
**Actor**: Registered User (email auth only)
**Flow**:
1. User clicks "Forgot Password" on login page
2. User enters email address
3. System sends password reset email with one-time token
4. User clicks link in email
5. User enters new password (must meet requirements)
6. System updates password hash
7. User redirected to login page

**Postcondition**: Password updated; user can log in with new password

#### UC-AUTH-11: Session Persistence
**Actor**: Registered User
**Flow**:
1. User logs in via any method
2. System issues platform refresh token (30 days) in HttpOnly cookie
3. On return visits within 30 days:
   - System refreshes platform access token automatically
4. On platform refresh token expiry:
   - User must re-authenticate via their original auth method

**Postcondition**: User remains logged in across browser sessions

### 3.2 Balance Deposit Use Cases

#### UC-DEP-01: Deposit Money via In-Game Payment
**Actor**: User
**Precondition**: User is logged in
**Flow**:
1. User navigates to "Deposit" page
2. System displays bot's in-game username
3. System shows instruction: "Send money using: /pay BotUsername <amount>"
4. User executes `/pay BotUsername 50000` in Minecraft
5. Bot detects chat message: "Username paid you $50K."
6. Bot logs payment to `payments-in.log`
7. Bridge service detects new log entry
8. Bridge service calls API with payment details
9. API matches username to registered user
10. API credits user balance, creates transaction record
11. API sends real-time notification via WebSocket
12. User sees updated balance and notification

**Postcondition**: User balance increased by deposited amount

**Alternative Flow - Unmatched Payment**:
- If username doesn't match any registered user:
  - Payment logged as "unmatched" for admin review
  - Can be manually assigned by admin

#### UC-DEP-02: Deposit Items
**Actor**: User
**Precondition**: User is logged in, has items to deposit
**Flow**:
1. User navigates to "Deposit Items" page
2. System displays available item catalog
3. User selects item type (e.g., "Zombie Spawner")
4. User enters quantity (e.g., 5)
5. User clicks "Request Deposit"
6. System creates item deposit record with status "pending"
7. System displays: "An administrator will contact you in-game to collect your items"
8. Admin sees pending deposit in admin panel
9. Admin contacts user in-game
10. Admin collects items from user
11. Admin marks deposit as "fulfilled" in admin panel
12. System credits items to user's inventory
13. User receives notification: "Your 5x Zombie Spawner deposit has been credited"

**Postcondition**: User inventory contains deposited items

### 3.3 Marketplace Use Cases

#### UC-MKT-01: Create Sell Listing
**Actor**: User
**Precondition**: User has items in inventory
**Flow**:
1. User navigates to "Sell Items" page
2. System displays user's inventory
3. User selects item (e.g., "Zombie Spawner")
4. User enters quantity to sell (e.g., 3)
5. User enters price per unit (e.g., 500,000)
6. User selects listing duration:
   - 24 hours (free)
   - 48 hours (costs 10,000,000)
7. System calculates and displays:
   - Total listing price: 1,500,000
   - Commission (at current rate, e.g., 5%): 75,000
   - Net proceeds if sold: 1,425,000
8. User confirms listing
9. If 48h selected: System deducts premium fee from balance
10. System reserves items from inventory (deducted immediately)
11. System creates listing with status "active"
12. Listing appears on marketplace

**Postcondition**: Active listing visible to all users; seller's inventory reduced

#### UC-MKT-02: Browse Marketplace
**Actor**: User
**Flow**:
1. User navigates to "Marketplace" page
2. System displays active listings (paginated, 20 per page)
3. User can filter by:
   - Item category
   - Item type
   - Price range (min/max)
   - Seller username
4. User can sort by:
   - Price (low to high / high to low)
   - Date listed (newest / oldest)
   - Quantity
5. Each listing shows:
   - Item name and icon
   - Quantity available
   - Price per unit
   - Total price
   - Seller username
   - Time remaining until expiration
6. User clicks listing for detail view

#### UC-MKT-03: Purchase Item
**Actor**: User (Buyer)
**Precondition**: User has sufficient balance
**Flow**:
1. User views listing detail
2. System displays:
   - Item details
   - Quantity: 3
   - Price per unit: 500,000
   - Total price: 1,500,000
   - User's current balance
3. User clicks "Buy Now"
4. System validates:
   - Listing still active
   - User has sufficient balance
   - User is not the seller
5. System executes transaction atomically:
   - Deducts total price from buyer balance
   - Credits seller balance (minus commission)
   - Transfers items to buyer inventory
   - Updates listing status to "sold"
   - Creates transaction records for both parties
6. Both parties receive notifications
7. Buyer sees items in inventory

**Postcondition**: Buyer has items; seller has money (minus commission)

**Alternative Flow - Insufficient Balance**:
- System displays error: "Insufficient balance. You need 1,500,000 but only have 1,200,000"
- Prompts user to deposit more funds

#### UC-MKT-04: Cancel Listing
**Actor**: User (Seller)
**Flow**:
1. User navigates to "My Listings"
2. User selects active listing
3. User clicks "Cancel Listing"
4. System confirms cancellation
5. System returns items to seller's inventory
6. System updates listing status to "cancelled"
7. Note: Premium listing fee is NOT refunded

**Postcondition**: Listing removed; items returned to inventory

#### UC-MKT-05: Listing Expiration (Automated)
**Actor**: System
**Trigger**: Listing's `expires_at` timestamp passes
**Flow**:
1. Background job runs every minute
2. Job identifies listings where `status = 'active'` AND `expires_at < NOW()`
3. For each expired listing:
   - Update status to "expired"
   - Return items to seller's inventory
   - Create notification for seller
4. Seller receives: "Your listing for 3x Zombie Spawner has expired. Items returned to inventory."

### 3.4 Withdrawal Use Cases

#### UC-WTH-01: Withdraw Money
**Actor**: User
**Precondition**: User has balance to withdraw
**Flow**:
1. User navigates to "Withdraw" page
2. User selects "Withdraw Money"
3. System displays current balance and withdrawal limits
4. User enters amount to withdraw (e.g., 100,000)
5. System validates amount is within limits
6. User confirms their Minecraft username
7. User submits withdrawal request
8. System:
   - Deducts amount from available balance (reserved)
   - Creates withdrawal record with status "pending"
9. User sees: "Withdrawal pending. An admin will send the payment in-game."
10. Admin sees pending withdrawal in admin panel
11. Admin clicks "Process" - status changes to "processing"
12. System queues command: `/pay Username 100000`
13. Bot executes payment command in-game
14. Admin verifies payment sent successfully
15. Admin marks withdrawal as "completed"
16. User receives notification: "Your withdrawal of $100,000 has been sent"

**Postcondition**: User's in-game balance increased; platform balance decreased

#### UC-WTH-02: Withdraw Items
**Actor**: User
**Precondition**: User has items in inventory
**Flow**:
1. User navigates to "Withdraw" page
2. User selects "Withdraw Items"
3. System displays user's inventory
4. User selects item and quantity
5. User submits withdrawal request
6. System:
   - Reserves items (deducted from available inventory)
   - Creates item withdrawal record with status "pending"
7. User sees: "Withdrawal pending. An admin will deliver in-game."
8. Admin sees pending item withdrawal
9. Admin clicks "Process" - status changes to "processing"
10. Admin meets user in-game
11. Admin gives items to user
12. Admin marks withdrawal as "completed"
13. System finalizes item deduction
14. User receives notification

**Postcondition**: User has items in-game; platform inventory decreased

#### UC-WTH-03: Cancel Withdrawal Request
**Actor**: User
**Precondition**: Withdrawal status is "pending" (not yet processing)
**Flow**:
1. User navigates to withdrawal history
2. User selects pending withdrawal
3. User clicks "Cancel"
4. System:
   - Returns reserved funds/items to available balance
   - Updates withdrawal status to "cancelled"
5. User sees funds/items available again

### 3.5 Notification Use Cases

#### UC-NOT-01: View Notifications
**Actor**: User
**Flow**:
1. User sees notification badge in header (count of unread)
2. User clicks notification icon
3. Dropdown shows recent notifications
4. Each notification shows:
   - Type icon
   - Title
   - Message preview
   - Time ago
   - Read/unread indicator
5. User clicks "View All" for full notification page

#### UC-NOT-02: Real-Time Notification
**Actor**: User (connected via WebSocket)
**Trigger**: System event (deposit credited, listing sold, etc.)
**Flow**:
1. System creates notification in database
2. System emits WebSocket event to user's session
3. User's browser receives event
4. UI updates:
   - Notification badge increments
   - Toast notification appears
   - If on relevant page, data refreshes

---

## 4. Authentication System

> **NOTE (February 2026):** This section has been rewritten to reflect the new multi-method authentication system. The previous Microsoft → Xbox → XSTS → Minecraft API chain has been replaced with three simpler methods. See `docs/Auth-Migration-Changelog.md` for details on what changed and why. See `docs/Authentication-Methods-Guide.md` for the complete guide to each method.

### 4.1 Authentication Overview

DonutTrade supports three authentication methods. All converge into a shared flow: Minecraft username entry → in-game payment verification.

```
              ┌──────────────────────────────────────┐
              │          3 SIGNUP METHODS             │
              │                                       │
              │  1. Microsoft OAuth (identity only)   │
              │  2. Discord OAuth                     │
              │  3. Email + Password                  │
              └──────────┬───────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Enter Minecraft     │
              │  Username            │
              │  (Bedrock: add ".")  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Pay random amount   │
              │  (1-1000) to bot     │
              │  within 15 minutes   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Account Verified    │
              │  → Dashboard         │
              └──────────────────────┘
```

### 4.2 Prerequisites: Azure AD Application Setup

Before implementing authentication, you must register an application in Azure Active Directory.

#### 4.2.1 Azure AD App Registration (for Microsoft OAuth)

1. Navigate to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Configure the application:
   - **Name**: `DonutTrade`
   - **Supported account types**: **"Personal Microsoft accounts only"**
   - **Redirect URI**: `https://yourdomain.com/auth/microsoft/callback` (Web platform)
3. Under **Certificates & secrets**: Create a **Client secret**

#### 4.2.2 Required OAuth Scopes

| Scope | Required | Purpose |
|-------|----------|---------|
| `openid` | **Yes** | OpenID Connect (sign users in) |
| `email` | **Yes** | Access user's email address |
| `profile` | **Yes** | Access user's basic profile |
| `offline_access` | Recommended | Obtain Microsoft refresh tokens |

**Scope string:**
```
openid email profile offline_access
```

**Note:** `XboxLive.signin` is **NOT** used. Microsoft OAuth is identity-only — no Xbox Live or Minecraft API calls.

#### 4.2.3 Discord Application Setup

1. Navigate to **Discord Developer Portal** → **Applications** → **New Application**
2. Under **OAuth2**: Add redirect URL `https://yourdomain.com/auth/discord/callback`
3. Scopes: `identify`, `email`
4. Copy Client ID and Client Secret

#### 4.2.4 Email Service Setup (Resend)

1. Create account at **resend.com**
2. Obtain API key
3. Verify sending domain (or use Resend's default for development)

#### 4.2.5 Environment Variables

```env
# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-app-client-id
DISCORD_CLIENT_SECRET=your-discord-app-client-secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback
DISCORD_BOT_TOKEN=your-discord-bot-token

# Email Service (Resend)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM_ADDRESS=noreply@donuttrade.com

# Verification Bot
VERIFICATION_BOT_USERNAME=DonutTradeVerify
VERIFICATION_WEBHOOK_SECRET=your-random-secret

# JWT
JWT_ACCESS_SECRET=your-64-char-hex-secret
JWT_REFRESH_SECRET=your-64-char-hex-secret
```

### 4.3 Authentication Methods

#### 4.3.1 Method 1: Microsoft OAuth

- Scopes: `openid email profile offline_access`
- Extracts Microsoft user ID (`oid` claim) and email from ID token
- No Xbox Live, XSTS, or Minecraft API calls
- Existing user → log in; New user → redirect to username entry

#### 4.3.2 Method 2: Discord OAuth

- Scopes: `identify email`
- Fetches Discord user info from `/users/@me`
- Extracts Discord user ID, username, email
- Existing user → log in; New user → redirect to username entry

#### 4.3.3 Method 3: Email + Password

- User enters email, password, retype password, Minecraft username
- Password hashed with bcrypt (12 rounds), must meet strength requirements
- 6-digit verification code sent via Resend
- After email verification → redirect to payment verification

#### 4.3.4 Payment Verification (Shared Step)

- Random amount 1-1000 generated
- User must pay exact amount to verification bot on DonutSMP within 15 minutes
- Verification bot (Mineflayer) detects payment and reports to API
- On timeout: soft delete (mark expired, allow retry preserving all user data)

### 4.4 External API Endpoints Reference

#### Microsoft OAuth2 Endpoints
| Endpoint | URL |
|----------|-----|
| Authorization | `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize` |
| Token Exchange | `https://login.microsoftonline.com/consumers/oauth2/v2.0/token` |

**Note**: Must use `/consumers` tenant for personal Microsoft accounts.

#### Discord OAuth2 Endpoints
| Endpoint | URL |
|----------|-----|
| Authorization | `https://discord.com/oauth2/authorize` |
| Token Exchange | `https://discord.com/api/oauth2/token` |
| User Info | `https://discord.com/api/users/@me` |

### 4.5 Platform Auth API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/microsoft` | GET | Initiate Microsoft OAuth flow |
| `/auth/microsoft/callback` | GET | Handle Microsoft OAuth callback |
| `/auth/discord` | GET | Initiate Discord OAuth flow |
| `/auth/discord/callback` | GET | Handle Discord OAuth callback |
| `/auth/email/register` | POST | Email + password registration |
| `/auth/email/verify` | POST | Verify email with 6-digit code |
| `/auth/email/login` | POST | Email + password login |
| `/auth/email/forgot-password` | POST | Request password reset |
| `/auth/email/reset-password` | POST | Reset password with token |
| `/auth/set-username` | POST | Set Minecraft username (shared step) |
| `/auth/verification/start` | POST | Start payment verification |
| `/auth/verification/status` | GET | Check verification status |
| `/auth/verification/retry` | POST | Retry expired verification |
| `/auth/me` | GET | Current user profile (protected) |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Logout current session |
| `/auth/logout-all` | POST | Logout all sessions (protected) |
| `/internal/verification/confirm` | POST | Bot reports payment (internal) |

### 4.6 Bedrock Edition Disclaimer

**IMPORTANT:** Everywhere on the platform where the user needs to enter their Minecraft username, there must be a disclaimer saying: If they have a Minecraft Bedrock Edition account, they should write their username with a dot (".") in front.

**Example:** `.givey` — Bedrock Edition account; `givey` — Java Edition account

### 4.7 Session Management

- **Access Token**: JWT, 15-minute expiry, contains `sub`, `username`, `authProvider`
- **Refresh Token**: 30-day expiry, stored as SHA-256 hash in database, HTTP-only cookie
- Token rotation on refresh (old token invalidated)
- Logout revokes session; logout-all revokes all user sessions

### 4.8 Verification Bot

A separate Mineflayer bot dedicated to payment verification:
- Connects to DonutSMP server as a dedicated bot account
- Listens for incoming `/pay` payments matching pending verifications
- Reports successful verifications to the API via internal webhook
- Auto-reconnects on disconnect

> **Note:** Previous versions of this specification described a Xbox Live → XSTS → Minecraft API chain which is no longer used. See `docs/Auth-Migration-Changelog.md` for the full list of removed components.

---

## 5. User Interface Specification

### 5.1 Design Principles

- **Mobile-First**: Design for mobile screens first, then scale up
- **Responsive**: Fluid layouts that work from 320px to 4K
- **Clean & Modern**: Minimalist design with clear visual hierarchy
- **Accessible**: WCAG 2.1 AA compliance
- **Fast**: Optimistic UI updates, skeleton loading states

### 5.2 Page Structure

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER                                                         │
│ ┌────────┐  ┌──────────────────────────┐  ┌────┐ ┌──────────┐ │
│ │ Logo   │  │ Navigation               │  │ 🔔 │ │ Profile  │ │
│ └────────┘  └──────────────────────────┘  └────┘ └──────────┘ │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                        MAIN CONTENT                            │
│                                                                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ FOOTER                                                         │
│ © 2026 DonutTrade • Not affiliated with DonutSMP • Terms       │
└────────────────────────────────────────────────────────────────┘
```

### 5.3 Page Specifications

#### 5.3.1 Landing Page (`/`)
**Access**: All visitors

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                         HERO SECTION                         │
│                                                              │
│        Trade Minecraft Items Safely on DonutSMP             │
│                                                              │
│    No more scams. Secure escrow trading for spawners,       │
│    gear, and more.                                          │
│                                                              │
│              [ Start Trading ]  [ Learn More ]              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      HOW IT WORKS                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 1. Deposit  │  │ 2. Trade    │  │ 3. Withdraw │         │
│  │ Send money  │  │ Buy & sell  │  │ Get items   │         │
│  │ or items    │  │ safely      │  │ in-game     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                       DISCLAIMER                             │
│  ⚠️ This platform is not affiliated with DonutSMP           │
└─────────────────────────────────────────────────────────────┘
```

**"Start Trading" Button Behavior**:
- If logged in → Navigate to `/marketplace`
- If not logged in → Show modal with options:
  - "Login with Microsoft"
  - "Login with Discord"
  - "Sign up with Email"

#### 5.3.2 Dashboard (`/dashboard`)
**Access**: Authenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, {username}!                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 💰 Balance       │  │ 📦 Inventory     │                │
│  │ $1,234,567       │  │ 15 items         │                │
│  │ [ Deposit ]      │  │ [ View ]         │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 📋 Active        │  │ 🔔 Notifications │                │
│  │ Listings: 3      │  │ 2 unread         │                │
│  │ [ Manage ]       │  │ [ View ]         │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Recent Activity                                             │
│  ─────────────────────────────────────────────────────────  │
│  • Deposit credited: +$50,000           2 hours ago         │
│  • Listing sold: Zombie Spawner x2      5 hours ago         │
│  • Purchase: Skeleton Spawner           1 day ago           │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.3 Marketplace (`/marketplace`)
**Access**: Authenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Marketplace                                    [ Sell Item ]│
├─────────────────────────────────────────────────────────────┤
│  Filters:                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Category ▼   │ │ Item Type ▼  │ │ Price: $0 - $10M    │  │
│  └──────────────┘ └──────────────┘ └─────────────────────┘  │
│                                                              │
│  Sort: [ Price ▼ ] [ Date ▼ ] [ Quantity ▼ ]               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 Zombie Spawner                        $500,000   │   │
│  │ Quantity: 3 | Seller: Player123 | Expires: 23h     │   │
│  │                                        [ Buy Now ]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔵 Skeleton Spawner                      $450,000   │   │
│  │ Quantity: 1 | Seller: Player456 | Expires: 12h     │   │
│  │                                        [ Buy Now ]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [ 1 ] [ 2 ] [ 3 ] ... [ 10 ]  (Pagination)                │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.4 Deposit Page (`/deposit`)
**Access**: Authenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Deposit                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💰 Deposit Money                                    │   │
│  │                                                      │   │
│  │  Send money to our bot in-game:                     │   │
│  │                                                      │   │
│  │  /pay DonutTradeBot <amount>                        │   │
│  │                                                      │   │
│  │  Your deposit will be credited automatically.       │   │
│  │                                                      │   │
│  │  Recent Deposits:                                   │   │
│  │  • $50,000 - Credited - 2h ago                     │   │
│  │  • $100,000 - Credited - 1d ago                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📦 Deposit Items                                    │   │
│  │                                                      │   │
│  │  Select item:     [ Zombie Spawner ▼ ]              │   │
│  │  Quantity:        [ 1          ]                    │   │
│  │                                                      │   │
│  │  [ Request Deposit ]                                │   │
│  │                                                      │   │
│  │  An admin will contact you in-game to collect.     │   │
│  │                                                      │   │
│  │  Pending Deposits:                                  │   │
│  │  • Zombie Spawner x5 - Pending - 3h ago            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.5 Create Listing Page (`/sell`)
**Access**: Authenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Create Listing                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your Inventory:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Zombie Spawner     x10    [ Select ]                │   │
│  │ Skeleton Spawner   x5     [ Select ]                │   │
│  │ Blaze Spawner      x2     [ Select ]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Selected: Zombie Spawner                                   │
│                                                              │
│  Quantity to sell:  [ 3        ] (max: 10)                 │
│  Price per unit:    [ 500,000  ] $                         │
│                                                              │
│  Listing Duration:                                          │
│  ○ 24 hours (Free)                                         │
│  ○ 48 hours (Costs $10,000,000)                           │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Summary:                                                    │
│  Total Price:       $1,500,000                             │
│  Commission (5%):   -$75,000                               │
│  You'll Receive:    $1,425,000                             │
│                                                              │
│  [ Create Listing ]                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.6 Withdraw Page (`/withdraw`)
**Access**: Authenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Withdraw                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💰 Withdraw Money                                   │   │
│  │                                                      │   │
│  │  Available Balance: $1,234,567                      │   │
│  │                                                      │   │
│  │  Amount:  [ 100,000    ] $                          │   │
│  │                                                      │   │
│  │  Minecraft Username: PlayerName (verified)          │   │
│  │                                                      │   │
│  │  [ Request Withdrawal ]                             │   │
│  │                                                      │   │
│  │  An admin will send the payment in-game.           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📦 Withdraw Items                                   │   │
│  │                                                      │   │
│  │  Your Inventory:                                    │   │
│  │  • Zombie Spawner x7   [ Withdraw ▼ ]              │   │
│  │  • Skeleton Spawner x3 [ Withdraw ▼ ]              │   │
│  │                                                      │   │
│  │  An admin will deliver items in-game.              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Pending Withdrawals:                                        │
│  • $100,000 - Processing - 1h ago                          │
│  • Zombie Spawner x2 - Pending - 30m ago                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.7 Login / Register Page (`/auth/login`)
**Access**: Unauthenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    Welcome to DonutTrade                     │
│                                                              │
│         Choose how you'd like to sign in or register        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [ Sign in with Microsoft ]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [ Sign in with Discord ]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│                        ── or ──                              │
│                                                              │
│  Email:     [ user@example.com     ]                        │
│  Password:  [ ••••••••             ]                        │
│                                                              │
│  [ Log In ]                      [ Forgot Password? ]       │
│                                                              │
│  Don't have an account? [ Register with Email ]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Microsoft/Discord buttons redirect to respective OAuth flows
- Email/Password form validates locally before submitting
- After successful login (any method), redirect based on account status:
  - No username set → `/auth/set-username`
  - Username set but not verified → `/auth/verify-payment`
  - Fully verified → `/dashboard`

#### 5.3.8 Email Registration Page (`/auth/register`)
**Access**: Unauthenticated users only

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                   Create Your Account                        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Email:            [ user@example.com         ]             │
│  Password:         [ ••••••••                 ]             │
│  Confirm Password: [ ••••••••                 ]             │
│                                                              │
│  Password requirements:                                     │
│  ✓ At least 8 characters                                   │
│  ✓ At least one uppercase letter                           │
│  ✓ At least one lowercase letter                           │
│  ✓ At least one number                                     │
│                                                              │
│  [ Create Account ]                                         │
│                                                              │
│  Already have an account? [ Log In ]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**After submission**: Redirect to `/auth/verify-email`

#### 5.3.9 Email Verification Page (`/auth/verify-email`)
**Access**: Users with unverified email

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                   Verify Your Email                          │
│                                                              │
│  We sent a 6-digit code to user@example.com                │
│                                                              │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
│  │ _ │ │ _ │ │ _ │ │ _ │ │ _ │ │ _ │                     │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                     │
│                                                              │
│  [ Verify ]                                                 │
│                                                              │
│  Didn't receive it? [ Resend Code ]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.10 Set Username Page (`/auth/set-username`)
**Access**: Authenticated users who haven't set a Minecraft username
**Restrictions**: This page cannot be bypassed - user must enter username

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│               Enter Your Minecraft Username                  │
│                                                              │
│  This is the username you use on DonutSMP.                  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Minecraft Username: [ PlayerName          ]                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  BEDROCK PLAYERS:                                    │   │
│  │  If you play Bedrock Edition, add a "." before your │   │
│  │  name. Example: .givey                              │   │
│  │                                                      │   │
│  │  Java players enter their name as-is.               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [ Continue ]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Username validation: 3-16 characters, alphanumeric + underscore (with optional `.` prefix for Bedrock)
- No back/skip option - username is required to proceed
- On submit: redirect to `/auth/verify-payment`

#### 5.3.11 Payment Verification Page (`/auth/verify-payment`)
**Access**: Authenticated users with username set but not yet verified
**Restrictions**: Cannot be bypassed

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│              Verify Your Minecraft Account                   │
│                                                              │
│  To prove you own this Minecraft account, send a small     │
│  payment to our verification bot in-game.                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Username: PlayerName                                       │
│                                                              │
│  Send exactly this amount to our bot:                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │   /pay VerifyBot $347                               │   │
│  │                                                      │   │
│  │   [ Copy Command ]                                  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Time remaining: 12:45                                      │
│  ████████████░░░░░░░░░  (progress bar)                     │
│                                                              │
│  Waiting for payment...                                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Timed out or need a new amount? [ Retry Verification ]    │
│  Wrong username? [ Change Username ]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Random amount between 1-1000 generated server-side
- 15-minute countdown timer
- Page polls or uses WebSocket to check verification status
- On success: animated checkmark, then redirect to `/dashboard`
- On timeout: show "Verification expired" with retry button
- Retry generates a new random amount and resets the timer
- "Change Username" goes back to `/auth/set-username`

### 5.4 Mobile Responsiveness

**Breakpoints**:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile Adaptations**:
- Navigation collapses to hamburger menu
- Cards stack vertically
- Filters collapse to expandable panel
- Tables become scrollable or card-based
- Touch-friendly tap targets (min 44px)

---

## 6. Administrator Interface

### 6.1 Admin Dashboard (`/admin`)
**Access**: Users with any admin role

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Admin Dashboard                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Pending    │ │ Pending    │ │ Pending    │ │ Active   │ │
│  │ Item Deps  │ │ Withdrawals│ │ Item Wthd  │ │ Users    │ │
│  │    12      │ │     5      │ │     8      │ │   1,234  │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Today's Statistics                                    │  │
│  │ Volume: $15,234,567 | Commission: $761,728           │  │
│  │ New Users: 23 | Transactions: 156                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Recent Admin Activity:                                      │
│  • Admin1 fulfilled withdrawal #123 - 5m ago               │
│  • Admin2 fulfilled item deposit #456 - 12m ago            │
│  • Admin1 banned user BadActor - 1h ago                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Admin Navigation

```
Admin Panel
├── Dashboard
├── Users
│   ├── All Users
│   └── Banned Users
├── Fulfillment
│   ├── Item Deposits (pending)
│   ├── Money Withdrawals (pending)
│   └── Item Withdrawals (pending)
├── Transactions
│   ├── Deposits
│   ├── Listings
│   └── All Transactions
├── Catalog
│   ├── Items
│   └── Categories
├── Settings
│   ├── Platform Settings
│   ├── Roles & Permissions
│   └── Audit Logs
```

### 6.3 Fulfillment Workflows

#### 6.3.1 Item Deposit Fulfillment (`/admin/fulfillment/item-deposits`)

**List View**:
| User | Item | Qty | Requested | Status | Actions |
|------|------|-----|-----------|--------|---------|
| Player123 | Zombie Spawner | 5 | 2h ago | Pending | [Fulfill] [Cancel] |
| Player456 | Blaze Spawner | 2 | 30m ago | Pending | [Fulfill] [Cancel] |

**Fulfill Action**:
1. Admin clicks [Fulfill]
2. Modal appears:
   - "Confirm you have received 5x Zombie Spawner from Player123"
   - Optional notes field
   - [Confirm] [Cancel]
3. On confirm:
   - Status → "received"
   - Items credited to user inventory
   - Notification sent to user
   - Admin action logged

#### 6.3.2 Money Withdrawal Fulfillment (`/admin/fulfillment/withdrawals`)

**List View**:
| User | Amount | Requested | Status | Actions |
|------|--------|-----------|--------|---------|
| Player123 | $100,000 | 1h ago | Pending | [Process] [Cancel] |
| Player789 | $500,000 | 2h ago | Processing | [Complete] [Fail] |

**Process Action**:
1. Admin clicks [Process]
2. Status → "processing"
3. System queues command: `/pay Player123 100000`
4. Bot executes command
5. Admin sees confirmation
6. Admin clicks [Complete]
7. Status → "completed"
8. Notification sent to user

**Fail Action** (if something goes wrong):
1. Admin clicks [Fail]
2. Enter reason
3. Status → "failed"
4. Funds returned to user balance
5. Notification sent to user

#### 6.3.3 Item Withdrawal Fulfillment (`/admin/fulfillment/item-withdrawals`)

Similar to item deposits but in reverse:
1. Admin clicks [Process]
2. Meets user in-game
3. Gives items to user
4. Clicks [Complete]
5. Items deducted from platform inventory
6. User notified

### 6.4 User Management (`/admin/users`)

**Features**:
- Search by username, email
- Filter by status (active, banned)
- Sort by registration date, balance, transaction count

**User Detail View**:
- Profile information
- Current balance
- Inventory
- Transaction history
- Active listings
- Pending withdrawals
- Role assignments
- Ban/unban controls
- Manual balance adjustment (with required reason)

**Balance Adjustment**:
```
┌─────────────────────────────────────────────────────────────┐
│  Adjust Balance for Player123                                │
├─────────────────────────────────────────────────────────────┤
│  Current Balance: $1,234,567                                │
│                                                              │
│  Adjustment Type:  ○ Add  ○ Deduct                          │
│  Amount:           [ 50,000     ]                           │
│  Reason:           [ Refund for failed withdrawal #123 ]    │
│                    (Required)                                │
│                                                              │
│  [ Apply Adjustment ]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Verification Management**:

Admins can view verification status and reset verification for users:

```
┌─────────────────────────────────────────────────────────────┐
│  Verification Information                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Auth Provider:         Discord                             │
│  Minecraft Username:    PlayerName                          │
│  Verification Status:   Verified                            │
│  Verified at:           2026-02-10 14:32                    │
│                                                              │
│  [ Reset Verification ]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Reset Verification Modal**:
```
┌─────────────────────────────────────────────────────────────┐
│  Reset Verification for Player123                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Current Username:    PlayerName                            │
│  Verified at:         2026-02-10 14:32                      │
│                                                              │
│  Reason for reset: [ User changed Minecraft username      ] │
│                    (Required)                                │
│                                                              │
│  This will require the user to re-enter their username     │
│  and complete payment verification again.                   │
│                                                              │
│              [ Cancel ]         [ Reset Verification ]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Admin API Endpoint**:
```
POST /admin/users/:id/reset-verification
Body: { "reason": "User changed Minecraft username" }
Requires Permission: users.reset_verification
```

**Audit Log Entry for Verification Reset**:
```
[2026-02-10 15:45:22] Admin1 (192.168.1.1)
Action: user.verification_reset
Target: User abc123
Details: {
  previous_username: "PlayerName",
  previous_status: "verified",
  reason: "User changed Minecraft username"
}
```

### 6.5 Catalog Management (`/admin/catalog`)

**Item List**:
| Name | Minecraft ID | Category | Status | Actions |
|------|--------------|----------|--------|---------|
| Zombie Spawner | minecraft:spawner | Spawners | Active | [Edit] [Disable] |
| Diamond Sword | minecraft:diamond_sword | Weapons | Active | [Edit] [Disable] |

**Add/Edit Item**:
```
┌─────────────────────────────────────────────────────────────┐
│  Add New Item                                                │
├─────────────────────────────────────────────────────────────┤
│  Display Name:    [ Zombie Spawner           ]              │
│  Minecraft ID:    [ minecraft:spawner        ]              │
│  Category:        [ Spawners ▼               ]              │
│  Description:     [ Spawns zombies when...   ]              │
│  Icon URL:        [ https://...              ]              │
│                                                              │
│  Price Limits (optional):                                    │
│  Minimum Price:   [ 100,000     ]                           │
│  Maximum Price:   [ 10,000,000  ]                           │
│                                                              │
│  Status:          ○ Enabled  ○ Disabled                     │
│                                                              │
│  [ Save Item ]                                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 Platform Settings (`/admin/settings`)

| Setting | Current Value | Description |
|---------|---------------|-------------|
| Commission Rate | 5% | Percentage taken from sales |
| Default Listing Duration | 24 hours | Standard listing time |
| Premium Listing Duration | 48 hours | Extended listing time |
| Premium Listing Fee | $10,000,000 | Cost for extended listings |
| Min Withdrawal Amount | $1,000 | Minimum withdrawal |
| Max Withdrawal Amount | $100,000,000 | Maximum withdrawal |
| Maintenance Mode | Off | Disable trading temporarily |

### 6.7 Role & Permission Management (`/admin/settings/roles`)

**Permissions Matrix**:

| Permission | Super Admin | Moderator | Fulfillment |
|------------|-------------|-----------|-------------|
| users.view | ✓ | ✓ | ✓ |
| users.edit | ✓ | ✓ | ✗ |
| users.ban | ✓ | ✓ | ✗ |
| users.reset_verification | ✓ | ✗ | ✗ |
| deposits.view | ✓ | ✓ | ✓ |
| deposits.fulfill | ✓ | ✗ | ✓ |
| withdrawals.view | ✓ | ✓ | ✓ |
| withdrawals.fulfill | ✓ | ✗ | ✓ |
| catalog.manage | ✓ | ✗ | ✗ |
| settings.manage | ✓ | ✗ | ✗ |
| roles.manage | ✓ | ✗ | ✗ |

**Available Permissions**:
- `users.view` - View user profiles
- `users.edit` - Edit user details, adjust balances
- `users.ban` - Ban/unban users
- `users.reset_verification` - Reset payment verification for a user
- `deposits.view` - View deposit requests
- `deposits.fulfill` - Mark item deposits as fulfilled
- `withdrawals.view` - View withdrawal requests
- `withdrawals.fulfill` - Process and complete withdrawals
- `listings.view` - View all listings
- `listings.moderate` - Remove listings, resolve disputes
- `catalog.manage` - Add/edit/remove catalog items
- `settings.manage` - Change platform settings
- `roles.manage` - Create/edit roles and permissions

### 6.8 Audit Logs (`/admin/settings/logs`)

**Log Entry Format**:
```
[2026-01-18 14:32:15] Admin1 (192.168.1.1)
Action: withdrawal.fulfill
Target: Withdrawal #123
Details: { amount: 100000, user: "Player123", status: "completed" }
```

**Filters**:
- Date range
- Admin user
- Action type
- Target type

---

## 7. Data Model Specification

### 7.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │───────│ user_roles  │───────│    roles    │
└─────────────┘       └─────────────┘       └─────────────┘
      │                                            │
      │                                            │
      │                                     ┌──────┴──────┐
      │                                     │role_perms   │
      │                                     └──────┬──────┘
      │                                            │
      │                                     ┌──────┴──────┐
      │                                     │ permissions │
      │                                     └─────────────┘
      │
      ├───────────────┬───────────────┬───────────────┐
      │               │               │               │
      ▼               ▼               ▼               ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│ deposits  │  │item_deps  │  │ listings  │  │withdrawals│
└───────────┘  └───────────┘  └───────────┘  └───────────┘
                    │               │
                    │               │
                    ▼               ▼
              ┌───────────┐  ┌───────────┐
              │item_catalog│  │user_inv   │
              └───────────┘  └───────────┘
                    │
                    │
                    ▼
              ┌───────────┐
              │transactions│
              └───────────┘
```

### 7.2 Table Definitions

#### 7.2.1 users
Primary user accounts with multi-method authentication support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| auth_provider | VARCHAR(20) | NOT NULL | 'microsoft', 'discord', or 'email' |
| microsoft_id | VARCHAR(255) | UNIQUE | Microsoft OAuth subject ID (NULL if not Microsoft auth) |
| discord_id | VARCHAR(255) | UNIQUE | Discord user ID (NULL if not Discord auth) |
| discord_username | VARCHAR(100) | | Discord display name |
| email | VARCHAR(255) | UNIQUE | User email address |
| email_verified | BOOLEAN | NOT NULL, DEFAULT false | Whether email has been verified (email auth only) |
| password_hash | VARCHAR(255) | | Bcrypt hash of password (email auth only) |
| minecraft_username | VARCHAR(32) | UNIQUE | MC username for trading (Bedrock prefixed with `.`) |
| verification_status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 'pending', 'awaiting_payment', 'verified', 'expired' |
| verification_amount | INTEGER | | Random amount (1-1000) for payment verification |
| verification_expires_at | TIMESTAMP | | When verification attempt expires (15 min from creation) |
| verified_at | TIMESTAMP | | When payment verification was completed |
| balance | DECIMAL(20,2) | NOT NULL, DEFAULT 0.00 | Available balance |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Registration time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |
| last_login_at | TIMESTAMP | | Last successful login |
| banned_at | TIMESTAMP | | Ban timestamp (NULL = not banned) |
| ban_reason | TEXT | | Reason for ban |

**Indexes**:
- `idx_users_minecraft_username` on `minecraft_username`
- `idx_users_microsoft_id` on `microsoft_id` WHERE `microsoft_id IS NOT NULL`
- `idx_users_discord_id` on `discord_id` WHERE `discord_id IS NOT NULL`
- `idx_users_email` on `email` WHERE `email IS NOT NULL`
- `idx_users_verification_status` on `verification_status` WHERE `verification_status != 'verified'`

**Constraints**:
- CHECK: `auth_provider IN ('microsoft', 'discord', 'email')`
- CHECK: `verification_status IN ('pending', 'awaiting_payment', 'verified', 'expired')`
- CHECK: At least one provider ID is set based on `auth_provider`
- CHECK: `password_hash IS NOT NULL` when `auth_provider = 'email'`

**Notes**:
- `auth_provider` records how the user initially signed up
- `minecraft_username` is self-reported by the user, then verified via in-game payment
- Bedrock players prefix their username with `.` (e.g., `.givey`)
- `verification_amount` is randomly generated (1-1000) when user enters username
- On verification timeout, status changes to `expired` but user data is preserved (soft delete)
- Users can retry verification, which generates a new amount and resets the timer
- `password_hash` uses bcrypt with 12 salt rounds (email auth only)
- `email_verified` only applies to email auth; OAuth providers are trusted for email

#### 7.2.2 roles
Custom admin roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(50) | NOT NULL, UNIQUE | Role name (e.g., "Super Admin") |
| description | TEXT | | Role description |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |

#### 7.2.3 permissions
Available system permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Permission key (e.g., "users.ban") |
| description | TEXT | | Human-readable description |

#### 7.2.4 role_permissions
Many-to-many: roles ↔ permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| role_id | UUID | FK → roles.id, ON DELETE CASCADE | Role reference |
| permission_id | UUID | FK → permissions.id, ON DELETE CASCADE | Permission reference |
| | | PK (role_id, permission_id) | Composite primary key |

#### 7.2.5 user_roles
Many-to-many: users ↔ roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | UUID | FK → users.id, ON DELETE CASCADE | User reference |
| role_id | UUID | FK → roles.id, ON DELETE CASCADE | Role reference |
| granted_by | UUID | FK → users.id | Admin who granted role |
| granted_at | TIMESTAMP | DEFAULT NOW() | Grant timestamp |
| | | PK (user_id, role_id) | Composite primary key |

#### 7.2.6 item_catalog
Admin-configurable list of tradeable items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Internal name |
| minecraft_id | VARCHAR(100) | NOT NULL | MC item ID (e.g., "minecraft:spawner") |
| display_name | VARCHAR(100) | NOT NULL | User-facing name |
| description | TEXT | | Item description |
| category | VARCHAR(50) | | Category grouping |
| icon_url | VARCHAR(500) | | URL to item icon |
| min_price | DECIMAL(20,2) | | Optional minimum price |
| max_price | DECIMAL(20,2) | | Optional maximum price |
| enabled | BOOLEAN | DEFAULT true | Whether item is tradeable |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

#### 7.2.7 deposits
Money deposits from in-game payments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id | Credited user (NULL if unmatched) |
| amount | DECIMAL(20,2) | NOT NULL | Parsed amount |
| amount_raw | VARCHAR(50) | | Original string (e.g., "50K.") |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, credited, disputed |
| bot_log_timestamp | TIMESTAMP | | When bot detected payment |
| detected_username | VARCHAR(16) | NOT NULL | Username from chat message |
| credited_at | TIMESTAMP | | When credited to user |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| notes | TEXT | | Admin notes |

**Indexes**:
- `idx_deposits_user_id` on `user_id`
- `idx_deposits_status` on `status`
- `idx_deposits_detected_username` on `detected_username`

#### 7.2.8 item_deposits
Item deposit requests requiring admin fulfillment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Requesting user |
| catalog_item_id | UUID | FK → item_catalog.id, NOT NULL | Item type |
| quantity | INTEGER | NOT NULL, DEFAULT 1 | Number of items |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, received, cancelled |
| fulfilled_by | UUID | FK → users.id | Admin who fulfilled |
| fulfilled_at | TIMESTAMP | | Fulfillment time |
| created_at | TIMESTAMP | DEFAULT NOW() | Request time |
| notes | TEXT | | Admin notes |

**Indexes**:
- `idx_item_deposits_user_id` on `user_id`
- `idx_item_deposits_status` on `status`

#### 7.2.9 user_inventory
User's deposited items available for trading.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Owner |
| catalog_item_id | UUID | FK → item_catalog.id, NOT NULL | Item type |
| quantity | INTEGER | NOT NULL, DEFAULT 0 | Available quantity |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |
| | | UNIQUE (user_id, catalog_item_id) | One row per user-item pair |

**Indexes**:
- `idx_user_inventory_user_id` on `user_id`

#### 7.2.10 listings
Marketplace listings for sale.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| seller_id | UUID | FK → users.id, NOT NULL | Seller |
| catalog_item_id | UUID | FK → item_catalog.id, NOT NULL | Item type |
| quantity | INTEGER | NOT NULL | Number for sale |
| price_per_unit | DECIMAL(20,2) | NOT NULL | Price per item |
| total_price | DECIMAL(20,2) | NOT NULL | Total listing price |
| commission_rate | DECIMAL(5,4) | NOT NULL | Snapshot of rate at creation |
| is_premium | BOOLEAN | DEFAULT false | 48h listing |
| expires_at | TIMESTAMP | NOT NULL | Expiration time |
| status | VARCHAR(20) | DEFAULT 'active' | active, sold, expired, cancelled |
| sold_at | TIMESTAMP | | Sale timestamp |
| buyer_id | UUID | FK → users.id | Buyer (if sold) |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |

**Indexes**:
- `idx_listings_active` on `(status, expires_at)` WHERE `status = 'active'`
- `idx_listings_seller_id` on `seller_id`
- `idx_listings_catalog_item_id` on `catalog_item_id`

#### 7.2.11 withdrawals
Money withdrawal requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Requesting user |
| amount | DECIMAL(20,2) | NOT NULL | Withdrawal amount |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, processing, completed, failed, cancelled |
| fulfilled_by | UUID | FK → users.id | Processing admin |
| fulfilled_at | TIMESTAMP | | Completion time |
| transaction_id | VARCHAR(100) | | Bot command reference |
| created_at | TIMESTAMP | DEFAULT NOW() | Request time |
| notes | TEXT | | Admin notes |

**Indexes**:
- `idx_withdrawals_user_id` on `user_id`
- `idx_withdrawals_status` on `status`

#### 7.2.12 item_withdrawals
Item withdrawal requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Requesting user |
| catalog_item_id | UUID | FK → item_catalog.id, NOT NULL | Item type |
| quantity | INTEGER | NOT NULL | Quantity to withdraw |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, processing, completed, failed, cancelled |
| fulfilled_by | UUID | FK → users.id | Processing admin |
| fulfilled_at | TIMESTAMP | | Completion time |
| created_at | TIMESTAMP | DEFAULT NOW() | Request time |
| notes | TEXT | | Admin notes |

#### 7.2.13 transactions
Complete audit trail of all financial movements.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Affected user |
| type | VARCHAR(30) | NOT NULL | Transaction type (see below) |
| amount | DECIMAL(20,2) | | Positive = credit, Negative = debit |
| balance_after | DECIMAL(20,2) | | User balance after transaction |
| reference_type | VARCHAR(50) | | Related table name |
| reference_id | UUID | | Related record ID |
| description | TEXT | | Human-readable description |
| created_at | TIMESTAMP | DEFAULT NOW() | Transaction time |

**Transaction Types**:
- `deposit` - Money deposited from in-game
- `item_deposit` - Items deposited
- `purchase` - Bought items from marketplace
- `sale` - Sold items on marketplace
- `commission` - Commission deducted from sale
- `listing_fee` - Premium listing fee
- `withdrawal` - Money withdrawn
- `item_withdrawal` - Items withdrawn
- `refund` - Refund for failed withdrawal
- `adjustment` - Manual admin adjustment

**Indexes**:
- `idx_transactions_user_id` on `(user_id, created_at DESC)`

#### 7.2.14 notifications
In-app notifications for users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, NOT NULL | Recipient |
| type | VARCHAR(50) | NOT NULL | Notification type |
| title | VARCHAR(200) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification body |
| data | JSONB | | Additional structured data |
| read_at | TIMESTAMP | | When marked as read |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |

**Indexes**:
- `idx_notifications_user_id` on `(user_id, created_at DESC)`
- `idx_notifications_unread` on `(user_id)` WHERE `read_at IS NULL`

#### 7.2.15 settings
Platform configuration key-value store.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | VARCHAR(100) | PK | Setting key |
| value | TEXT | NOT NULL | Setting value |
| description | TEXT | | Description |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |
| updated_by | UUID | FK → users.id | Admin who updated |

**Default Settings**:
| Key | Default Value | Description |
|-----|---------------|-------------|
| commission_rate | 0.05 | 5% commission |
| listing_duration_default | 86400 | 24 hours in seconds |
| listing_duration_premium | 172800 | 48 hours in seconds |
| premium_listing_fee | 10000000 | 10M fee |
| min_withdrawal | 1000 | Minimum withdrawal |
| max_withdrawal | 100000000 | Maximum withdrawal |
| maintenance_mode | false | Trading disabled |

#### 7.2.16 admin_logs
Audit log for all admin actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| admin_id | UUID | FK → users.id, NOT NULL | Acting admin |
| action | VARCHAR(100) | NOT NULL | Action type |
| target_type | VARCHAR(50) | | Target table |
| target_id | UUID | | Target record |
| details | JSONB | | Action details |
| ip_address | INET | | Admin's IP |
| created_at | TIMESTAMP | DEFAULT NOW() | Action time |

**Indexes**:
- `idx_admin_logs_created_at` on `created_at DESC`

#### 7.2.17 sessions
User authentication sessions (platform-level).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Session identifier |
| user_id | UUID | FK → users.id, NOT NULL, ON DELETE CASCADE | Session owner |
| refresh_token_hash | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hash of refresh token |
| user_agent | TEXT | | Browser/client user agent |
| ip_address | INET | | Client IP address |
| expires_at | TIMESTAMP | NOT NULL | Session expiration time |
| created_at | TIMESTAMP | DEFAULT NOW() | Session creation time |
| last_used_at | TIMESTAMP | DEFAULT NOW() | Last activity time |

**Indexes**:
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_expires_at` on `expires_at`
- `idx_sessions_refresh_token_hash` on `refresh_token_hash`

**Notes**:
- Refresh tokens are stored as SHA-256 hashes, never plaintext
- Sessions should be cleaned up by a scheduled job when `expires_at < NOW()`
- `last_used_at` updated on each token refresh

#### 7.2.18 auth_states
Temporary storage for OAuth state parameters (CSRF protection).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| state | VARCHAR(64) | PK | Random state parameter |
| redirect_url | VARCHAR(500) | | URL to redirect after auth |
| created_at | TIMESTAMP | DEFAULT NOW() | State creation time |
| expires_at | TIMESTAMP | NOT NULL | State expiration (15 minutes) |

**Notes**:
- States should be deleted after use or on expiration
- Used to prevent CSRF attacks during OAuth flow

---

## 8. API Specification

### 8.1 Base URL
```
Production: https://api.donuttrade.com/v1
Development: http://localhost:3000/api/v1
```

### 8.2 Authentication
All endpoints except `/auth/*` require JWT Bearer token:
```
Authorization: Bearer <access_token>
```

### 8.3 Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 150
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "You need $1,500,000 but only have $1,200,000"
  }
}
```

### 8.4 Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/microsoft` | Initiate Microsoft OAuth (redirects to Microsoft login) |
| GET | `/auth/microsoft/callback` | Microsoft OAuth callback - exchanges code for identity |
| GET | `/auth/discord` | Initiate Discord OAuth (redirects to Discord login) |
| GET | `/auth/discord/callback` | Discord OAuth callback - exchanges code for identity |
| POST | `/auth/email/register` | Register with email and password |
| POST | `/auth/email/verify` | Verify email with 6-digit code |
| POST | `/auth/email/resend-code` | Resend email verification code |
| POST | `/auth/email/login` | Login with email and password |
| POST | `/auth/email/forgot-password` | Request password reset email |
| POST | `/auth/email/reset-password` | Reset password with token |
| POST | `/auth/set-username` | Set Minecraft username (shared across all methods) |
| GET | `/auth/verification-status` | Get current payment verification status |
| POST | `/auth/retry-verification` | Generate new verification amount and reset timer |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/refresh` | Refresh platform access token |
| POST | `/auth/logout` | Logout current session |
| POST | `/auth/logout-all` | Logout all sessions |

**Authentication Flow Detail:**
```
GET /auth/microsoft
  → Redirects to: https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
  → Scopes: openid email profile offline_access

GET /auth/microsoft/callback?code=...&state=...
  → Server exchanges code for ID token
  → Extracts Microsoft user ID and email from ID token
  → Creates/finds user record
  → Returns: { access_token, refresh_token (in cookie), user }

GET /auth/discord
  → Redirects to: https://discord.com/oauth2/authorize
  → Scopes: identify email

GET /auth/discord/callback?code=...&state=...
  → Server exchanges code for access token
  → Fetches Discord user info (id, username, email)
  → Creates/finds user record
  → Returns: { access_token, refresh_token (in cookie), user }

POST /auth/email/register
  Body: { "email": "...", "password": "..." }
  → Creates user, sends 6-digit verification code via Resend
  → Returns: { success: true, message: "Verification code sent" }

POST /auth/set-username
  Body: { "username": "PlayerName" }
  → Validates username format (Bedrock prefix with "." if applicable)
  → Generates random verification amount (1-1000)
  → Sets 15-minute timer
  → Returns: { success: true, verificationAmount: 347, expiresAt: "..." }

GET /auth/me
  → Returns: {
      id, minecraft_username, auth_provider,
      verification_status, balance, created_at
    }
```

#### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get profile |
| GET | `/users/me/balance` | Get balance |
| GET | `/users/me/inventory` | Get inventory |
| GET | `/users/me/transactions` | Transaction history |
| GET | `/users/me/notifications` | Get notifications |
| PATCH | `/users/me/notifications/:id/read` | Mark read |
| POST | `/users/me/notifications/read-all` | Mark all read |

#### Deposits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deposits` | User's deposits |
| POST | `/item-deposits` | Request item deposit |
| GET | `/item-deposits` | User's item deposits |
| DELETE | `/item-deposits/:id` | Cancel pending deposit |

#### Marketplace
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/marketplace` | Browse listings |
| GET | `/marketplace/:id` | Listing details |
| GET | `/marketplace/categories` | Get categories |
| GET | `/marketplace/items` | Available items |

#### Listings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/listings` | Create listing |
| GET | `/listings/my` | User's listings |
| DELETE | `/listings/:id` | Cancel listing |

#### Purchases
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/purchases` | Buy listing |
| GET | `/purchases` | Purchase history |

#### Withdrawals
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/withdrawals/balance` | Request money withdrawal |
| POST | `/withdrawals/items` | Request item withdrawal |
| GET | `/withdrawals` | Withdrawal history |
| DELETE | `/withdrawals/:id` | Cancel pending withdrawal |

#### Admin endpoints omitted for brevity - follow same RESTful pattern under `/admin/*`

### 8.5 WebSocket Events

**Connection**: `wss://api.donuttrade.com/socket`

**Client → Server**:
- `subscribe:notifications` - Subscribe to user notifications
- `unsubscribe:notifications` - Unsubscribe

**Server → Client**:
- `notification:new` - New notification
- `balance:updated` - Balance changed
- `listing:sold` - User's listing purchased
- `deposit:credited` - Deposit credited

---

## 9. Bot Integration Architecture

### 9.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DonutTrade Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐         ┌─────────┐ │
│  │  Minecraft   │◄───────►│  Trade Bot   │◄───────►│   Bot   │ │
│  │   Server     │         │ (Mineflayer) │         │  Bridge │ │
│  └──────────────┘         └──────────────┘         └────┬────┘ │
│         ▲                        │                      │      │
│         │                        │ logs/                │      │
│         │                        ▼                      │      │
│         │                 ┌──────────────┐              │      │
│         │                 │payments-in.log│─────────────┘      │
│         │                 └──────────────┘                     │
│         │                                                       │
│  ┌──────┴───────┐                                              │
│  │ Verification │──────── POST /internal/verification/confirm  │
│  │ Bot          │         (webhook to API)                     │
│  │ (Mineflayer) │                                              │
│  └──────────────┘                                              │
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐         ┌─────────┐ │
│  │   Next.js    │◄───────►│  Fastify     │◄───────►│PostgreSQL│ │
│  │   Frontend   │         │     API      │         │    DB   │ │
│  └──────────────┘         └──────────────┘         └─────────┘ │
│                                  │                             │
│                                  │                             │
│                           ┌──────────────┐                     │
│                           │    Redis     │                     │
│                           │ (Queue/Cache)│                     │
│                           └──────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Payment Detection Flow

1. Player executes `/pay DonutTradeBot 50000` in Minecraft
2. Server sends chat: "PlayerName paid you $50K."
3. Mineflayer bot receives raw message event
4. PaymentHandler parses message, extracts username and amount
5. PaymentHandler logs to `logs/payments-in.log`:
   ```json
   {"timestamp":"2026-01-18T14:30:00.000Z","username":"PlayerName","amount":50000,"amountRaw":"50K."}
   ```
6. Bot Bridge service watches log file for new entries
7. Bridge calls API: `POST /internal/deposits` with payment data
8. API matches username to registered user
9. API credits balance, creates transaction, sends WebSocket notification
10. User sees balance update in real-time

### 9.3 Withdrawal Execution Flow

1. User requests withdrawal via web UI
2. API creates withdrawal record (status: pending)
3. Admin approves withdrawal in admin panel
4. API updates status to "processing"
5. API adds job to Redis queue: `{ command: "/pay PlayerName 50000", withdrawalId: "..." }`
6. Bot Bridge worker consumes job
7. Bridge writes command to bot's stdin
8. Bot executes command in Minecraft
9. Bridge reports success to API
10. Admin confirms completion
11. API updates status to "completed", notifies user

### 9.4 Verification Bot

Location: `packages/verification-bot/`

A separate Mineflayer bot dedicated to payment verification during user registration.

**Purpose**: Listens for incoming `/pay` commands from users proving Minecraft account ownership.

**Flow**:
1. User enters Minecraft username on the platform
2. API generates random amount (1-1000) and starts 15-minute timer
3. User sends `/pay VerificationBot <amount>` in Minecraft
4. Verification bot detects matching payment (username + exact amount)
5. Bot calls `POST /internal/verification/confirm` with `{ username, amount, secret }`
6. API marks user as verified, issues full session tokens

**Components**:
- `src/bot.ts` - Mineflayer connection, chat listener, payment parser
- `src/api-client.ts` - HTTP client for internal webhook calls
- `src/config.ts` - Bot configuration (server, credentials, API URL)

**Security**:
- Internal webhook authenticated with shared secret (`VERIFICATION_BOT_SECRET`)
- Bot runs on same network as API (not exposed externally)
- Amount matching is exact (no rounding tolerance)

### 9.5 Bot Bridge Service

Location: `packages/bot-bridge/`

**Components**:
- `payment-watcher.js` - Monitors `payments-in.log` using file watching
- `command-queue.js` - Processes withdrawal commands from Redis queue
- `api-client.js` - HTTP client for API communication
- `index.js` - Main entry point, coordinates components

---

## 10. Technology Stack Recommendations

### 10.1 Backend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20+ LTS | Matches existing bot; JavaScript ecosystem |
| Framework | Fastify | High performance, schema validation, TypeScript |
| Database | PostgreSQL 15+ | ACID compliance for financial transactions |
| ORM | Prisma | Type-safe, excellent migrations, good DX |
| Cache/Queue | Redis 7+ | Session storage, job queues, rate limiting |
| Job Queue | BullMQ | Robust job processing for withdrawals |
| Validation | Zod | Runtime type validation |

### 10.1.1 Authentication Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| OAuth Library | @fastify/oauth2 | Native Fastify integration for Microsoft & Discord OAuth |
| HTTP Client | undici | For Discord API calls |
| JWT | @fastify/jwt | Platform session token generation/validation |
| Password Hashing | bcrypt | Industry standard, 12 salt rounds |
| Email Service | Resend | Developer-friendly API, generous free tier |
| Session Cookies | @fastify/cookie | HttpOnly, Secure, SameSite cookie handling |
| CSRF Protection | @fastify/csrf-protection | Double-submit cookie pattern |

**Authentication Dependencies (package.json):**
```json
{
  "dependencies": {
    "@fastify/oauth2": "^7.x",
    "@fastify/jwt": "^8.x",
    "@fastify/cookie": "^9.x",
    "@fastify/csrf-protection": "^6.x",
    "bcrypt": "^5.x",
    "resend": "^3.x",
    "undici": "^6.x"
  }
}
```

**Environment Variables for Auth:**
```env
# Azure AD Application
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# Discord Application
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback
DISCORD_BOT_TOKEN=your-discord-bot-token

# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Platform JWT Secrets
JWT_ACCESS_SECRET=random-32-byte-hex-string
JWT_REFRESH_SECRET=different-random-32-byte-hex-string

# Verification Bot
VERIFICATION_BOT_SECRET=shared-secret-for-internal-webhook
VERIFICATION_BOT_USERNAME=VerifyBot
```

### 10.2 Frontend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ | SSR/SSG, React ecosystem, good performance |
| Styling | Tailwind CSS | Utility-first, responsive, fast development |
| Components | shadcn/ui | Accessible, customizable, modern |
| State | React Query + Zustand | Server state + client state |
| Forms | React Hook Form + Zod | Performant forms with validation |
| Real-time | Socket.IO Client | WebSocket for notifications |

### 10.3 Infrastructure

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Process Manager | PM2 | Production process management |
| Reverse Proxy | Nginx | SSL termination, load balancing |
| SSL | Let's Encrypt | Free SSL certificates |
| Hosting | VPS (recommended) | Full control, cost-effective |

### 10.4 Project Structure

```
miau/
├── src/                      # Existing bot code
│   ├── bot.js
│   ├── chat.js
│   ├── payments.js
│   └── index.js
├── packages/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── api/                  # Fastify backend
│   │   ├── routes/
│   │   ├── services/
│   │   └── middleware/
│   ├── shared/               # Shared types, utilities
│   │   ├── types/
│   │   └── utils/
│   ├── bot-bridge/           # Bot integration layer
│   │   ├── payment-watcher.js
│   │   └── command-queue.js
│   └── verification-bot/    # Payment verification bot
│       ├── src/
│       │   ├── bot.ts
│       │   ├── api-client.ts
│       │   └── config.ts
│       └── package.json
├── prisma/
│   └── schema.prisma
├── config/
├── logs/
└── package.json              # Workspace root
```

---

## 11. Security Considerations

### 11.1 Authentication Security

#### 11.1.1 OAuth Security
- **Microsoft OAuth 2.0**: Authorization code flow with `state` parameter for CSRF protection
- **Discord OAuth 2.0**: Authorization code flow with `state` parameter for CSRF protection
- **Tenant restriction**: Only `/consumers` tenant accepted for Microsoft (blocks organization accounts)
- **Scope limitation**: Only request necessary scopes (`openid email profile` for Microsoft, `identify email` for Discord)
- **Token validation**: Verify all tokens and state parameters before use

#### 11.1.2 Password Security (Email Auth)
- **Hashing**: bcrypt with 12 salt rounds (no plaintext storage)
- **Requirements**: Minimum 8 characters, mixed case + number
- **Rate limiting**: Limit login attempts per IP and per email to prevent brute force
- **Reset flow**: Time-limited reset tokens sent via email, single-use

#### 11.1.3 Email Verification
- **6-digit codes**: Randomly generated, valid for 15 minutes
- **Rate limiting**: Maximum 3 resend attempts per 15-minute window
- **Code expiry**: Codes expire and cannot be reused

#### 11.1.4 Token Storage
- **Platform refresh tokens**: Stored as SHA-256 hashes, never plaintext
- **Access tokens**: Short-lived (15 minutes), stored in memory only
- **Passwords**: bcrypt hashed, never stored or logged in plaintext

#### 11.1.5 Session Security
- **HttpOnly cookies**: Refresh tokens in HttpOnly, Secure, SameSite=Strict cookies
- **CSRF protection**: Double-submit cookie pattern for state-changing requests
- **Session binding**: Bind sessions to user agent and IP (warn on change, don't block)
- **Concurrent sessions**: Allow multiple sessions per user with session management UI
- **Session invalidation**: On password change, security concern, or user logout
- **Token rotation**: Old refresh token invalidated when new one is issued

#### 11.1.6 Payment Verification Security
- **Random amounts**: Verification amounts (1-1000) generated server-side using crypto-secure randomness
- **Time-limited**: 15-minute window prevents stale verifications
- **Exact matching**: Amount must match exactly (no rounding tolerance)
- **Internal webhook**: Verification bot communicates via authenticated internal endpoint
- **Soft delete**: Expired verifications preserve user data but require new amount on retry
- **Username uniqueness**: Only one user can claim a given Minecraft username

### 11.2 Financial Security
- All balance operations use database transactions
- Optimistic locking prevents race conditions
- Complete audit trail for all financial changes
- Admin actions require confirmation
- Configurable withdrawal limits
- Reserved funds immediately deducted (not double-spendable)

### 11.3 Input Validation
- Zod schema validation on all API inputs
- Parameterized queries (Prisma prevents SQL injection)
- Sanitization of user-generated content
- Rate limiting per endpoint and per user

### 11.4 Bot Security
- Bot credentials stored in environment variables
- Command queue authentication
- Rate limiting on bot commands
- All commands logged
- Withdrawal amount validation

### 11.5 Infrastructure Security
- HTTPS everywhere
- CORS restricted to known origins
- Security headers via Helmet.js
- Regular dependency audits
- Database connection encryption

### 11.6 Fraud Prevention
- OAuth providers (Microsoft, Discord) prevent impersonation at the account level
- Payment verification proves Minecraft account ownership
- Manual admin fulfillment reduces automated fraud
- Transaction monitoring for suspicious patterns
- Ban system for bad actors
- IP logging for admin actions
- Cooling-off period for new accounts (optional)
- Email verification prevents throwaway account abuse (email auth)

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Auth Provider** | The method used to sign up: Microsoft OAuth, Discord OAuth, or Email/Password |
| **Balance** | User's available money on the platform |
| **Bedrock Prefix** | The `.` character prepended to Bedrock Edition usernames (e.g., `.givey`) |
| **Bot** | A Mineflayer bot that connects to the Minecraft server |
| **Bridge** | Service connecting the trade bot to the web application |
| **Catalog** | Admin-configurable list of tradeable items |
| **Commission** | Percentage fee taken from marketplace sales |
| **Deposit** | Adding money or items to the platform |
| **Fulfillment** | Admin process of completing deposit/withdrawal in-game |
| **Inventory** | User's items available for trading on the platform |
| **Listing** | An item put up for sale on the marketplace |
| **Marketplace** | Where users buy and sell items |
| **Payment Verification** | Process where users send a random amount to the verification bot to prove Minecraft account ownership |
| **Premium Listing** | 48-hour listing with extended duration |
| **Trade Bot** | The main Mineflayer bot that handles deposits and withdrawals |
| **Verification Bot** | A separate Mineflayer bot dedicated to verifying Minecraft account ownership via payments |
| **Withdrawal** | Removing money or items from the platform to in-game |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Claude | Initial specification |
| 1.1 | 2026-01-23 | Claude | Complete authentication system overhaul: Microsoft → Xbox Live → XSTS → Minecraft Services API chain; Azure AD prerequisites; token storage schema; Bedrock/Java edition handling |
| 1.2 | 2026-01-24 | Claude | Added dual-edition user support: UC-AUTH-07/08 for edition choice flow; Edition Choice page UI specification; expanded users table schema with dual-identity columns; admin edition management; users.change_edition permission |
| 2.0 | 2026-02 | Claude | Complete auth system overhaul: replaced Xbox Live/XSTS/Minecraft API chain with 3-method auth (Microsoft OAuth identity-only, Discord OAuth, Email/Password); added payment verification system; added verification bot; updated users table schema; updated UI pages for new auth flow; updated API endpoints; updated security considerations |

---

*This document serves as the complete specification for the DonutTrade platform. Implementation should follow these specifications while allowing for reasonable technical decisions during development.*
