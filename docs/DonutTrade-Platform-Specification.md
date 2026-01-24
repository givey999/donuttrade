# DonutTrade Platform - Complete Specification Document

**Version:** 1.0
**Date:** January 2026
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
- **Authentication**: Microsoft OAuth → Xbox Live → Minecraft Services API chain (automatically retrieves verified Minecraft username and UUID)
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

#### UC-AUTH-01: New User Registration (Java Edition)
**Actor**: Guest
**Precondition**: User has a Microsoft account with Minecraft Java Edition
**Flow**:
1. User clicks "Login with Microsoft" on landing page
2. User is redirected to Microsoft login (with Xbox Live scope consent)
3. User sees permission request: "Access Xbox Live" / "XboxLive.Signin"
4. User grants permission and completes Microsoft OAuth
5. System receives Microsoft authorization code
6. Server exchanges code for Microsoft access token
7. Server exchanges Microsoft token for Xbox Live (XBL) token
8. Server exchanges XBL token for XSTS token (Minecraft relying party)
9. Server exchanges XSTS token for Minecraft access token
10. Server calls Minecraft Profile API to retrieve username and UUID
11. System creates user account with:
    - `minecraft_username`: Retrieved from Minecraft API (e.g., "PlayerName")
    - `minecraft_uuid`: Retrieved from Minecraft API
    - `microsoft_id`: From Microsoft OAuth
    - `edition`: "java"
12. System issues platform session tokens
13. User redirected to dashboard

**Postcondition**: User account exists with verified Minecraft Java Edition identity

#### UC-AUTH-02: New User Registration (Bedrock Edition)
**Actor**: Guest
**Precondition**: User has a Microsoft account with Minecraft Bedrock Edition (no Java)
**Flow**:
1. User clicks "Login with Microsoft" on landing page
2. User completes Microsoft OAuth with Xbox Live scope consent
3. Server completes token exchange chain (MS → XBL → XSTS → MC)
4. Server calls Minecraft Profile API
5. API returns 404 (user doesn't own Java Edition)
6. Server retrieves Xbox Gamertag from Xbox Profile API
7. System creates user account with:
    - `minecraft_username`: "." + Xbox Gamertag (e.g., ".PlayerName")
    - `minecraft_uuid`: Xbox User ID (XUID)
    - `microsoft_id`: From Microsoft OAuth
    - `edition`: "bedrock"
8. System issues platform session tokens
9. User redirected to dashboard

**Postcondition**: User account exists with verified Bedrock Edition identity (prefixed with `.`)

#### UC-AUTH-03: User Does Not Own Minecraft
**Actor**: Guest
**Precondition**: User has Microsoft account but no Minecraft ownership
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth with Xbox Live scope consent
3. Server completes token exchange chain
4. Server calls Minecraft Profile API → 404 NOT_FOUND
5. Server calls Entitlements API → Empty items array
6. System displays error: "No Minecraft account found. You must own Minecraft to use DonutTrade."
7. User shown link to purchase Minecraft

**Postcondition**: No account created; user informed of requirement

#### UC-AUTH-04: Returning User Login
**Actor**: Registered User
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth (may be instant if session exists)
3. Server completes token exchange chain
4. Server retrieves Minecraft profile
5. System matches Microsoft ID to existing account
6. System updates stored tokens (refresh tokens)
7. System verifies username hasn't changed (or updates if changed)
8. System issues new platform session tokens
9. User redirected to dashboard

**Postcondition**: User logged in with refreshed session

#### UC-AUTH-05: Session Persistence
**Actor**: Registered User
**Flow**:
1. User logs in with "Remember me" option
2. System stores Microsoft refresh token (encrypted) in database
3. System issues platform refresh token (30 days) in HttpOnly cookie
4. On return visits within 30 days:
   - System refreshes platform access token automatically
5. On platform refresh token expiry:
   - System attempts to use stored Microsoft refresh token
   - If valid: re-authenticate through Xbox/Minecraft chain silently
   - If expired: user must re-authenticate with Microsoft

**Postcondition**: User remains logged in across browser sessions

#### UC-AUTH-06: XSTS Authentication Error
**Actor**: Guest
**Precondition**: User has Microsoft account with Xbox Live issues
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth
3. Server attempts XSTS token exchange
4. XSTS returns error code (XErr)
5. System displays appropriate error message:
   - XErr 2148916233: "No Xbox account found. Please create one at xbox.com"
   - XErr 2148916238: "Child accounts must be added to a Family by an adult"
   - XErr 2148916235: "Xbox Live is not available in your country"
   - XErr 2148916227: "This Xbox account has been banned"
6. User shown relevant help link

**Postcondition**: No account created; user informed of issue

#### UC-AUTH-07: Dual Edition User - Edition Choice
**Actor**: Guest
**Precondition**: User has a Microsoft account owning BOTH Minecraft Java Edition AND Bedrock Edition
**Flow**:
1. User clicks "Login with Microsoft" on landing page
2. User completes Microsoft OAuth with Xbox Live scope consent
3. Server completes token exchange chain (MS → XBL → XSTS → MC)
4. Server calls Minecraft Profile API → Success (user owns Java Edition)
5. Server retrieves Java username and UUID
6. Server checks entitlements API for Bedrock Edition ownership
7. Server detects user owns BOTH editions (has both `game_minecraft` and `game_minecraft_bedrock` entitlements)
8. Server retrieves Xbox Gamertag from Xbox Profile API
9. System creates user account with BOTH identities stored:
    - `java_username`: Minecraft Java username (e.g., "PlayerName")
    - `java_uuid`: Minecraft Java UUID
    - `bedrock_username`: "." + Xbox Gamertag (e.g., ".GamerTag123")
    - `bedrock_xuid`: Xbox User ID (XUID)
    - `active_edition`: NULL (not yet chosen)
    - `microsoft_id`: From Microsoft OAuth
10. System redirects user to Edition Choice page (`/auth/choose-edition`)
11. User sees uncancelable page displaying both identities:
    - Java Edition identity: "PlayerName"
    - Bedrock Edition identity: ".GamerTag123"
12. User reads explanation of the choice and its implications
13. User selects their preferred edition and confirms selection
14. System updates user account:
    - Sets `active_edition` to chosen edition ('java' or 'bedrock')
    - Sets `minecraft_username` based on choice
    - Sets `minecraft_uuid` based on choice (UUID for Java, XUID for Bedrock)
15. System issues platform session tokens
16. User redirected to dashboard

**Postcondition**: User account exists with verified dual-edition ownership, one edition active for trading

**Important Notes**:
- The Edition Choice page is uncancelable - user cannot navigate away without making a selection
- Once chosen, only an administrator can change the active edition
- Both identities remain stored in the database for verification and potential future changes
- Bedrock username is always prefixed with "." regardless of dual ownership

#### UC-AUTH-08: Returning Dual Edition User Login
**Actor**: Registered User (dual-edition owner)
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth (may be instant if session exists)
3. Server completes token exchange chain
4. Server retrieves both Minecraft profile and Xbox Gamertag
5. System matches Microsoft ID to existing account
6. System updates stored tokens and verifies both identities still match
7. If `active_edition` is set:
   - System issues new platform session tokens
   - User redirected to dashboard
8. If `active_edition` is NULL (incomplete registration):
   - User redirected to Edition Choice page to complete setup

**Postcondition**: User logged in with refreshed session; or redirected to complete edition choice

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

### 4.1 Prerequisites: Azure AD Application Setup

Before implementing authentication, you must register an application in Azure Active Directory.

#### 4.1.1 Azure AD App Registration

1. Navigate to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Configure the application:
   - **Name**: `DonutTrade` (or your preferred name)
   - **Supported account types**: Select **"Personal Microsoft accounts only"** (consumer accounts)
   - **Redirect URI**:
     - Platform: `Web`
     - URL: `https://yourdomain.com/auth/microsoft/callback` (production)
     - Add `http://localhost:3000/auth/microsoft/callback` for development

3. After creation, note the **Application (client) ID** - this is your `CLIENT_ID`

4. Under **Authentication** → **Advanced settings**:
   - Set **"Allow public client flows"** to **Yes** (required for certain flows)

5. Under **Certificates & secrets**:
   - Create a new **Client secret**
   - Note the secret value immediately (shown only once) - this is your `CLIENT_SECRET`

#### 4.1.2 Minecraft API Permission (CRITICAL)

**IMPORTANT**: Newly created Azure applications must apply for permission to use the Minecraft Services API. Without this approval, calls to `api.minecraftservices.com` will return **HTTP 403 Forbidden**.

**Steps to request access:**
1. Visit the Microsoft application permission request form (search for "Minecraft Services API permission request")
2. Submit your Application (client) ID
3. Wait for approval (can take several days to weeks)
4. Test your application only after receiving confirmation

#### 4.1.3 Required OAuth Scopes

| Scope | Required | Purpose |
|-------|----------|---------|
| `XboxLive.signin` | **Yes** | Authenticate with Xbox Live services |
| `XboxLive.offline_access` | Recommended | Obtain refresh tokens for Xbox Live |
| `offline_access` | Recommended | Obtain Microsoft refresh tokens |

**Scope string for authorization request:**
```
XboxLive.signin XboxLive.offline_access offline_access
```

#### 4.1.4 Environment Variables

```env
# Azure AD Application
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# For development
MICROSOFT_REDIRECT_URI_DEV=http://localhost:3000/auth/microsoft/callback
```

### 4.2 Authentication Flow Overview

The authentication process involves a **4-step token exchange chain**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Complete Authentication Chain                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1              Step 2              Step 3              Step 4         │
│  ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────────┐  │
│  │Microsoft│   →    │Xbox Live│   →    │  XSTS   │   →    │  Minecraft  │  │
│  │  OAuth  │        │  Auth   │        │  Token  │        │  Services   │  │
│  └─────────┘        └─────────┘        └─────────┘        └─────────────┘  │
│       │                  │                  │                    │          │
│       ▼                  ▼                  ▼                    ▼          │
│  MS Access Token    XBL Token          XSTS Token          MC Access Token │
│  (+ Refresh Token)  (+ User Hash)      (+ User Hash)       (+ Profile)     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 API Endpoints Reference

#### Microsoft OAuth2 Endpoints
| Endpoint | URL |
|----------|-----|
| Authorization | `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize` |
| Token Exchange | `https://login.microsoftonline.com/consumers/oauth2/v2.0/token` |
| Device Code (alternative) | `https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode` |

**CRITICAL**: You **MUST** use the `/consumers` tenant. Using `/common` or a specific tenant ID will fail with the `XboxLive.signin` scope.

#### Xbox Live Endpoints
| Endpoint | URL |
|----------|-----|
| Xbox Live Authentication | `https://user.auth.xboxlive.com/user/authenticate` |
| XSTS Token Service | `https://xsts.auth.xboxlive.com/xsts/authorize` |

#### Minecraft Services Endpoints
| Endpoint | URL |
|----------|-----|
| Login with Xbox | `https://api.minecraftservices.com/authentication/login_with_xbox` |
| Get Profile | `https://api.minecraftservices.com/minecraft/profile` |
| Check Entitlements | `https://api.minecraftservices.com/entitlements/mcstore` |

### 4.4 Detailed Authentication Steps

#### Step 1: Microsoft OAuth2 Authorization

**Authorization Request (redirect user to):**
```
GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
    ?client_id={CLIENT_ID}
    &response_type=code
    &redirect_uri={REDIRECT_URI}
    &scope=XboxLive.signin%20XboxLive.offline_access%20offline_access
    &state={RANDOM_STATE_VALUE}
```

**Token Exchange (after callback with code):**
```http
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&grant_type=authorization_code
&code={AUTHORIZATION_CODE}
&redirect_uri={REDIRECT_URI}
```

**Response:**
```json
{
  "token_type": "Bearer",
  "scope": "XboxLive.signin XboxLive.offline_access",
  "expires_in": 3600,
  "access_token": "EwAIA+pvBgAA...",
  "refresh_token": "M.R3_BAY..."
}
```

#### Step 2: Xbox Live Authentication

**Request:**
```http
POST https://user.auth.xboxlive.com/user/authenticate
Content-Type: application/json
Accept: application/json

{
  "Properties": {
    "AuthMethod": "RPS",
    "SiteName": "user.auth.xboxlive.com",
    "RpsTicket": "d={MICROSOFT_ACCESS_TOKEN}"
  },
  "RelyingParty": "http://auth.xboxlive.com",
  "TokenType": "JWT"
}
```

**IMPORTANT**: For custom Azure applications, prefix the Microsoft access token with `d=`.

**Response:**
```json
{
  "IssueInstant": "2026-01-18T14:30:00.000Z",
  "NotAfter": "2026-02-01T14:30:00.000Z",
  "Token": "eyJlbmMiOiJBMTI4Q0JD...",
  "DisplayClaims": {
    "xui": [{ "uhs": "2535428504324680" }]
  }
}
```

The `uhs` (user hash) is required for subsequent requests.

#### Step 3: XSTS Token

**Request:**
```http
POST https://xsts.auth.xboxlive.com/xsts/authorize
Content-Type: application/json
Accept: application/json

{
  "Properties": {
    "SandboxId": "RETAIL",
    "UserTokens": ["{XBL_TOKEN}"]
  },
  "RelyingParty": "rp://api.minecraftservices.com/",
  "TokenType": "JWT"
}
```

**Response:**
```json
{
  "IssueInstant": "2026-01-18T14:30:00.000Z",
  "NotAfter": "2026-01-19T06:30:00.000Z",
  "Token": "eyJhbGciOiJIUzI1NiIs...",
  "DisplayClaims": {
    "xui": [{ "uhs": "2535428504324680" }]
  }
}
```

#### Step 4: Minecraft Services Authentication

**Request:**
```http
POST https://api.minecraftservices.com/authentication/login_with_xbox
Content-Type: application/json

{
  "identityToken": "XBL3.0 x={USER_HASH};{XSTS_TOKEN}",
  "ensureLegacyEnabled": true
}
```

**Response:**
```json
{
  "username": "1234567890abcdef",
  "roles": [],
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

**Note**: The `username` field here is NOT the Minecraft username - it's an internal identifier.

### 4.5 Retrieving Player Profile

#### Java Edition Profile

**Request:**
```http
GET https://api.minecraftservices.com/minecraft/profile
Authorization: Bearer {MINECRAFT_ACCESS_TOKEN}
```

**Response (user owns Java Edition):**
```json
{
  "id": "069a79f444e94726a5befca90e38aaf5",
  "name": "Notch",
  "skins": [
    {
      "id": "skin-id",
      "state": "ACTIVE",
      "url": "http://textures.minecraft.net/texture/...",
      "variant": "CLASSIC"
    }
  ],
  "capes": []
}
```

| Field | Description |
|-------|-------------|
| `id` | Player's UUID (without hyphens) |
| `name` | **Minecraft Java Edition username** |

**Response (user does NOT own Minecraft):**
```json
{
  "error": "NOT_FOUND",
  "errorMessage": "The user doesn't have any Minecraft profile"
}
```

#### Checking Game Ownership (Entitlements)

**Request:**
```http
GET https://api.minecraftservices.com/entitlements/mcstore
Authorization: Bearer {MINECRAFT_ACCESS_TOKEN}
```

**Response:**
```json
{
  "items": [
    {"name": "product_minecraft", "signature": "..."},
    {"name": "game_minecraft", "signature": "..."}
  ],
  "signature": "...",
  "keyId": "..."
}
```

**Entitlement Names:**
| Entitlement | Edition |
|-------------|---------|
| `product_minecraft`, `game_minecraft` | Java Edition |
| `product_minecraft_bedrock`, `game_minecraft_bedrock` | Bedrock Edition |

**Note**: Xbox Game Pass users may have an empty `items` array but still have a valid Minecraft profile.

### 4.6 Bedrock Player Support

Bedrock Edition players use their **Xbox Gamertag** as their username. These are prefixed with `.` (period) on DonutSMP to distinguish from Java Edition players.

#### Retrieving Xbox Gamertag

For Bedrock players, use the Xbox Profile API:

**Request:**
```http
GET https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag
Authorization: XBL3.0 x={USER_HASH};{XSTS_TOKEN}
x-xbl-contract-version: 2
```

**Alternative**: Use a different `RelyingParty` when getting XSTS token for Bedrock:
```json
"RelyingParty": "https://pocket.realms.minecraft.net/"
```

#### Handling Both Editions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       User Edition Detection Flow                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Complete authentication flow (Steps 1-4)                            │
│                                                                          │
│  2. Call GET /minecraft/profile                                         │
│     ├── Success → User has Java Edition                                 │
│     │   └── Store Java identity: username, uuid                         │
│     │       └── Continue to step 3                                      │
│     │                                                                    │
│     └── 404 NOT_FOUND → User doesn't own Java Edition                  │
│         └── Skip to step 4 (Bedrock-only path)                         │
│                                                                          │
│  3. Call GET /entitlements/mcstore                                      │
│     ├── Has 'game_minecraft_bedrock' → DUAL OWNER (both editions)      │
│     │   └── Continue to step 4 to retrieve Bedrock identity            │
│     │                                                                    │
│     └── No Bedrock entitlement → JAVA-ONLY OWNER                       │
│         └── Store: minecraft_username = java_username                   │
│                   minecraft_uuid = java_uuid                            │
│                   active_edition = "java"                               │
│                   → DONE (redirect to dashboard)                        │
│                                                                          │
│  4. Call Xbox Profile API for Gamertag                                  │
│     └── Store Bedrock identity: "." + gamertag, xuid                   │
│                                                                          │
│  5. Determine user path:                                                │
│     ├── DUAL OWNER (from step 3):                                      │
│     │   └── Store BOTH identities, active_edition = NULL               │
│     │       → Redirect to Edition Choice page (/auth/choose-edition)   │
│     │                                                                    │
│     └── BEDROCK-ONLY (from step 2 failure):                            │
│         └── Store: minecraft_username = "." + gamertag                 │
│                   minecraft_uuid = xuid                                 │
│                   active_edition = "bedrock"                            │
│                   → DONE (redirect to dashboard)                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Edition Choice for Dual Owners

When a user owns both Java and Bedrock editions, they must choose which identity to use on the platform. This choice is presented on an uncancelable page after initial authentication.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Dual Edition Choice Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User completes Microsoft/Xbox/Minecraft auth                        │
│  2. System detects dual ownership via entitlements API                  │
│  3. System stores BOTH identities in users table                        │
│  4. System redirects to /auth/choose-edition                            │
│  5. User sees Edition Choice page (uncancelable - no back/skip option)  │
│  6. User selects preferred edition and confirms                         │
│  7. System sets active_edition and populates minecraft_username/uuid    │
│  8. System issues JWT and redirects to dashboard                        │
│                                                                          │
│  Note: After initial choice, only admins can change the active edition  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Returning Dual-Owner Login

When a dual-owner returns to the platform:
1. Complete authentication flow
2. Match Microsoft ID to existing account
3. Verify both identities still match (usernames may have changed)
4. Update stored tokens
5. If `active_edition` is set → issue session tokens, redirect to dashboard
6. If `active_edition` is NULL (incomplete registration) → redirect to Edition Choice page

### 4.7 Token Lifetimes & Refresh Strategy

| Token | Lifetime | Refresh Strategy |
|-------|----------|------------------|
| Microsoft Access Token | 60-90 minutes | Use refresh token |
| Microsoft Refresh Token | Up to 90 days | Re-authenticate if expired |
| Xbox Live (XBL) Token | ~14 days | Re-exchange from MS token |
| XSTS Token | ~16 hours | Re-exchange from XBL token |
| Minecraft Access Token | 24 hours | Re-exchange from XSTS token |

**Refresh Microsoft Token:**
```http
POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
&scope=XboxLive.signin XboxLive.offline_access offline_access
```

**Recommended Strategy:**
1. Store Microsoft refresh token securely in database (encrypted)
2. On each user session, check if Minecraft token is valid
3. If expired, re-run Steps 2-4 using stored Xbox tokens or refresh Microsoft token
4. Refresh Microsoft token proactively before 90-day expiry

### 4.8 Error Handling

#### XSTS Error Codes (XErr)

| XErr Code | Meaning | User Action Required |
|-----------|---------|---------------------|
| 2148916227 | Account banned from Xbox Live | Account is permanently banned - cannot use platform |
| 2148916229 | Account requires adult verification | User must verify age at account.xbox.com |
| 2148916233 | No Xbox account exists | User must create Xbox account at xbox.com/create |
| 2148916235 | Xbox Live unavailable in user's country | Geographic restriction - cannot use platform |
| 2148916238 | Child account (under 18) | Account must be added to a Family by an adult |

#### HTTP Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Missing or invalid token | Re-authenticate |
| 403 | App not authorized for Minecraft API | Ensure API permission approved |
| 404 | Profile not found | User doesn't own Minecraft |
| 429 | Rate limited | Implement backoff, retry later |

### 4.9 Rate Limits

| API | Rate Limit |
|-----|------------|
| Minecraft Services API | 600 requests per 10 minutes |
| Profile queries | ~200 requests per minute |
| Same profile query | Cache for at least 60 seconds |

### 4.10 Platform Session Management

After successful Minecraft authentication, the platform issues its own session tokens:

| Token Type | Lifetime | Storage | Purpose |
|------------|----------|---------|---------|
| Platform Access Token | 15 minutes | Memory/localStorage | API authentication |
| Platform Refresh Token | 30 days | HttpOnly Cookie | Session renewal |
| CSRF Token | Per request | Cookie + Header | Request validation |

**Session Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      Session Management                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User completes Microsoft/Xbox/Minecraft auth                │
│  2. Platform creates/updates user record with:                  │
│     - minecraft_username                                        │
│     - minecraft_uuid                                            │
│     - microsoft_id                                              │
│     - Encrypted Microsoft refresh token                         │
│  3. Platform issues JWT access token (15 min)                   │
│  4. Platform issues refresh token in HttpOnly cookie (30 days)  │
│  5. Client includes access token in Authorization header        │
│  6. On access token expiry, client calls /auth/refresh          │
│  7. On refresh token expiry, user must re-authenticate          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.11 Complete Authentication Sequence Diagram

```
┌────────┐     ┌────────┐     ┌──────────┐     ┌────────┐     ┌──────┐     ┌──────────┐
│ User   │     │Platform│     │Microsoft │     │Xbox Live│    │ XSTS │     │Minecraft │
│Browser │     │ Server │     │  OAuth   │     │  Auth   │    │      │     │ Services │
└───┬────┘     └───┬────┘     └────┬─────┘     └────┬────┘    └──┬───┘     └────┬─────┘
    │              │               │                │            │              │
    │ Click Login  │               │                │            │              │
    │─────────────>│               │                │            │              │
    │              │               │                │            │              │
    │   Redirect   │               │                │            │              │
    │<─────────────│               │                │            │              │
    │              │               │                │            │              │
    │         Authorize            │                │            │              │
    │─────────────────────────────>│                │            │              │
    │              │               │                │            │              │
    │      Auth Code Callback      │                │            │              │
    │<─────────────────────────────│                │            │              │
    │              │               │                │            │              │
    │  Code        │               │                │            │              │
    │─────────────>│               │                │            │              │
    │              │               │                │            │              │
    │              │ Exchange Code │                │            │              │
    │              │──────────────>│                │            │              │
    │              │               │                │            │              │
    │              │  MS Tokens    │                │            │              │
    │              │<──────────────│                │            │              │
    │              │               │                │            │              │
    │              │          XBL Auth              │            │              │
    │              │───────────────────────────────>│            │              │
    │              │               │                │            │              │
    │              │          XBL Token             │            │              │
    │              │<───────────────────────────────│            │              │
    │              │               │                │            │              │
    │              │                    XSTS Auth                │              │
    │              │────────────────────────────────────────────>│              │
    │              │               │                │            │              │
    │              │                    XSTS Token               │              │
    │              │<────────────────────────────────────────────│              │
    │              │               │                │            │              │
    │              │                           MC Login                         │
    │              │───────────────────────────────────────────────────────────>│
    │              │               │                │            │              │
    │              │                           MC Token                         │
    │              │<───────────────────────────────────────────────────────────│
    │              │               │                │            │              │
    │              │                          Get Profile                       │
    │              │───────────────────────────────────────────────────────────>│
    │              │               │                │            │              │
    │              │                      Username + UUID                       │
    │              │<───────────────────────────────────────────────────────────│
    │              │               │                │            │              │
    │ Platform JWT │               │                │            │              │
    │<─────────────│               │                │            │              │
    │              │               │                │            │              │
```

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
  - "Create Account"

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

#### 5.3.7 Edition Choice Page (`/auth/choose-edition`)
**Access**: Authenticated users with dual-edition ownership who haven't chosen an edition
**Restrictions**: This page cannot be bypassed or cancelled - user must make a selection

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                     Choose Your Edition                          │
│                                                                  │
│  You own both Minecraft Java Edition and Bedrock Edition.       │
│  Please choose which identity you want to use for trading       │
│  on DonutTrade.                                                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ☕ JAVA EDITION                                           │  │
│  │                                                            │  │
│  │  Username: PlayerName                                     │  │
│  │  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5              │  │
│  │                                                            │  │
│  │  This is your Minecraft Java Edition identity.            │  │
│  │                                                            │  │
│  │                              [ Select Java Edition ]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                           - OR -                                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🪨 BEDROCK EDITION                                        │  │
│  │                                                            │  │
│  │  Username: .GamerTag123                                   │  │
│  │  Xbox Gamertag: GamerTag123                               │  │
│  │                                                            │  │
│  │  This is your Minecraft Bedrock Edition identity.         │  │
│  │  The "." prefix identifies Bedrock players on DonutSMP.   │  │
│  │                                                            │  │
│  │                            [ Select Bedrock Edition ]      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ IMPORTANT: What does this choice mean?                      │
│                                                                  │
│  • This determines which Minecraft username is used for        │
│    deposits, withdrawals, and trading on DonutTrade            │
│                                                                  │
│  • Deposits must come from the selected identity's username    │
│                                                                  │
│  • Withdrawals will be sent to the selected identity           │
│                                                                  │
│  • This choice can only be changed by contacting an admin      │
│                                                                  │
│  • Choose the edition you primarily play on DonutSMP           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Page displays after successful Microsoft authentication for dual-edition users
- No "back" button, no "skip" option, no navigation menu displayed
- Browser back button redirects back to this page if choice not made
- Only the two selection buttons are actionable
- On selection:
  1. Confirmation modal appears (see below)
  2. On confirm: API call to `POST /auth/choose-edition` with `{ edition: 'java' | 'bedrock' }`
  3. On success: Redirect to dashboard with session tokens
  4. On cancel: Return to selection screen

**Confirmation Modal**:
```
┌─────────────────────────────────────────────────────────────┐
│                  Confirm Your Selection                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  You selected: Java Edition                                 │
│                                                              │
│  Your trading identity will be:                             │
│  Username: PlayerName                                       │
│                                                              │
│  This choice can only be changed by contacting a platform   │
│  administrator.                                              │
│                                                              │
│  Are you sure you want to continue?                         │
│                                                              │
│              [ Cancel ]         [ Confirm Selection ]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Mobile Layout**:
- Cards stack vertically
- Full-width buttons
- Important notice section remains visible (scrollable if needed)
- Touch-friendly tap targets (min 44px)

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

**Edition Management (Dual Owners Only)**:

For users who own both editions, admins can view both identities and change the active edition:

```
┌─────────────────────────────────────────────────────────────┐
│  Edition Information                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Owns Java Edition:     ✓ Yes                               │
│  Owns Bedrock Edition:  ✓ Yes                               │
│                                                              │
│  Active Edition:        Java Edition                        │
│  Trading Username:      PlayerName                          │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Java Identity:                                              │
│    Username: PlayerName                                     │
│    UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5              │
│                                                              │
│  Bedrock Identity:                                           │
│    Username: .GamerTag123                                   │
│    Gamertag: GamerTag123                                    │
│    XUID: 2535428504324680                                   │
│                                                              │
│  Edition set: 2026-01-18 14:32 (by user)                   │
│                                                              │
│  [ Change Active Edition ]                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Change Edition Modal**:
```
┌─────────────────────────────────────────────────────────────┐
│  Change Active Edition for Player123                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Current Active Edition: Java Edition                       │
│  Current Trading Username: PlayerName                       │
│                                                              │
│  New Active Edition:                                         │
│  ○ Java Edition (PlayerName)                                │
│  ● Bedrock Edition (.GamerTag123)                           │
│                                                              │
│  Reason for change: [ User requested switch to Bedrock    ] │
│                     (Required)                               │
│                                                              │
│  ⚠️ Warning: This will change the user's trading identity.   │
│  Pending deposits or withdrawals may need manual review.    │
│                                                              │
│              [ Cancel ]         [ Change Edition ]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Admin API Endpoint**:
```
PATCH /admin/users/:id/edition
Body: { "edition": "java" | "bedrock", "reason": "User requested switch" }
Requires Permission: users.change_edition
```

**Audit Log Entry for Edition Change**:
```
[2026-01-18 15:45:22] Admin1 (192.168.1.1)
Action: user.edition_change
Target: User abc123
Details: {
  previous_edition: "java",
  new_edition: "bedrock",
  previous_username: "PlayerName",
  new_username: ".GamerTag123",
  reason: "User requested switch to Bedrock"
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
| users.change_edition | ✓ | ✗ | ✗ |
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
- `users.change_edition` - Change active edition for dual-owner users
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
Primary user accounts linked to Minecraft identities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| minecraft_username | VARCHAR(32) | UNIQUE | Active MC username for trading (Bedrock prefixed with `.`); NULL if dual-owner hasn't chosen |
| minecraft_uuid | VARCHAR(36) | UNIQUE | Active Minecraft UUID (Java) or XUID (Bedrock); NULL if dual-owner hasn't chosen |
| active_edition | VARCHAR(10) | | 'java', 'bedrock', or NULL (not yet chosen for dual owners) |
| java_username | VARCHAR(32) | | Java Edition username (stored for all Java/dual owners) |
| java_uuid | VARCHAR(36) | | Java Edition UUID (stored for all Java/dual owners) |
| bedrock_username | VARCHAR(32) | | Bedrock Edition username with "." prefix (stored for all Bedrock/dual owners) |
| bedrock_xuid | VARCHAR(50) | | Xbox User ID for Bedrock (stored for all Bedrock/dual owners) |
| owns_java | BOOLEAN | NOT NULL, DEFAULT false | Whether user owns Java Edition |
| owns_bedrock | BOOLEAN | NOT NULL, DEFAULT false | Whether user owns Bedrock Edition |
| microsoft_id | VARCHAR(255) | NOT NULL, UNIQUE | Microsoft OAuth subject ID |
| email | VARCHAR(255) | | Microsoft email (optional) |
| microsoft_refresh_token | TEXT | | Encrypted Microsoft refresh token for silent re-auth |
| xbox_user_hash | VARCHAR(50) | | Xbox User Hash (uhs) for token refresh |
| xbox_gamertag | VARCHAR(50) | | Xbox Gamertag (raw, without "." prefix) |
| balance | DECIMAL(20,2) | NOT NULL, DEFAULT 0.00 | Available balance |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Registration time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |
| last_login_at | TIMESTAMP | | Last successful login |
| banned_at | TIMESTAMP | | Ban timestamp (NULL = not banned) |
| ban_reason | TEXT | | Reason for ban |
| edition_set_at | TIMESTAMP | | When active_edition was chosen/changed |
| edition_set_by | UUID | FK → users.id | Admin who changed edition (NULL if user's initial choice) |

**Indexes**:
- `idx_users_minecraft_username` on `minecraft_username`
- `idx_users_minecraft_uuid` on `minecraft_uuid`
- `idx_users_microsoft_id` on `microsoft_id`
- `idx_users_java_uuid` on `java_uuid` WHERE `java_uuid IS NOT NULL`
- `idx_users_bedrock_xuid` on `bedrock_xuid` WHERE `bedrock_xuid IS NOT NULL`

**Constraints**:
- CHECK: `active_edition IN ('java', 'bedrock') OR active_edition IS NULL`
- CHECK: `(owns_java = true) OR (owns_bedrock = true)` -- must own at least one edition
- CHECK: If `active_edition = 'java'` then `owns_java = true`
- CHECK: If `active_edition = 'bedrock'` then `owns_bedrock = true`

**Notes**:
- `minecraft_username` and `minecraft_uuid` are the ACTIVE identity used for trading
- For dual owners, these are populated from `java_*` or `bedrock_*` fields based on `active_edition`
- For single-edition users, `active_edition` is set immediately and only relevant identity fields are populated
- `minecraft_username` for Bedrock-active users is prefixed with `.` (e.g., `.GamerTag123`)
- `bedrock_username` is ALWAYS stored with `.` prefix for consistency
- `active_edition` is NULL only for dual-owners who haven't completed the Edition Choice page
- `edition_set_by` is NULL for the user's initial choice, set to admin's user_id if changed by admin
- `microsoft_refresh_token` must be encrypted at rest (AES-256-GCM recommended)
- `xbox_user_hash` cached for faster token refresh without full re-authentication

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
User authentication sessions (platform-level, not Microsoft/Xbox tokens).

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
| GET | `/auth/microsoft` | Initiate Microsoft OAuth (redirects to Microsoft login with Xbox Live scope) |
| GET | `/auth/microsoft/callback` | OAuth callback - completes MS→XBL→XSTS→MC token chain |
| GET | `/auth/me` | Get current user (includes minecraft_username, edition) |
| POST | `/auth/refresh` | Refresh platform access token |
| POST | `/auth/logout` | Logout (clears session, optionally revokes tokens) |
| GET | `/auth/edition-status` | Check if user needs to choose edition (for dual owners) |
| POST | `/auth/choose-edition` | Set active edition for dual-owner (initial choice only) |

**Authentication Flow Detail:**
```
GET /auth/microsoft
  → Redirects to: https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
  → Scopes: XboxLive.signin XboxLive.offline_access offline_access

GET /auth/microsoft/callback?code=...&state=...
  → Server performs 4-step token exchange
  → Creates/updates user with Minecraft profile
  → Returns: { access_token, refresh_token (in cookie), user }

GET /auth/me
  → Returns: {
      id, minecraft_username, minecraft_uuid, active_edition,
      owns_java, owns_bedrock, balance, created_at
    }

GET /auth/edition-status
  → For dual owners who haven't chosen: {
      needs_choice: true,
      java_identity: {
        username: "PlayerName",
        uuid: "069a79f444e94726a5befca90e38aaf5"
      },
      bedrock_identity: {
        username: ".GamerTag123",
        gamertag: "GamerTag123",
        xuid: "2535428504324680"
      }
    }
  → For users who have chosen or single-edition: {
      needs_choice: false
    }

POST /auth/choose-edition
  Body: { "edition": "java" | "bedrock" }
  → Success: { success: true, access_token, user }
  → Error (already chosen): { error: "EDITION_ALREADY_SET", message: "Contact an admin to change your edition" }
  → Error (not dual owner): { error: "NOT_DUAL_OWNER", message: "Edition choice is only for users with both editions" }
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
│  │  Minecraft   │◄───────►│   Mineflayer │◄───────►│   Bot   │ │
│  │   Server     │         │     Bot      │         │  Bridge │ │
│  └──────────────┘         └──────────────┘         └────┬────┘ │
│                                  │                      │      │
│                                  │ logs/                │      │
│                                  ▼                      │      │
│                           ┌──────────────┐              │      │
│                           │payments-in.log│─────────────┘      │
│                           └──────────────┘                     │
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐         ┌─────────┐ │
│  │   Next.js    │◄───────►│   Express    │◄───────►│ PostgreSQL│
│  │   Frontend   │         │     API      │         │    DB    │ │
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

### 9.4 Bot Bridge Service

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
| OAuth Library | @fastify/oauth2 | Native Fastify integration for Microsoft OAuth |
| HTTP Client | undici or axios | For Xbox Live and Minecraft Services API calls |
| JWT | @fastify/jwt | Platform session token generation/validation |
| Encryption | Node.js crypto | AES-256-GCM for encrypting refresh tokens |
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
    "undici": "^6.x"
  }
}
```

**Environment Variables for Auth:**
```env
# Azure AD Application (from Prerequisites)
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# Platform JWT Secrets
JWT_ACCESS_SECRET=random-32-byte-hex-string
JWT_REFRESH_SECRET=different-random-32-byte-hex-string

# Encryption Key for Microsoft Refresh Tokens
TOKEN_ENCRYPTION_KEY=32-byte-hex-key-for-aes-256-gcm
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
│   └── bot-bridge/           # Bot integration layer
│       ├── payment-watcher.js
│       └── command-queue.js
├── prisma/
│   └── schema.prisma
├── config/
├── logs/
└── package.json              # Workspace root
```

---

## 11. Security Considerations

### 11.1 Authentication Security

#### 11.1.1 OAuth & Token Chain Security
- **Microsoft OAuth 2.0**: Authorization code flow with `state` parameter for CSRF protection
- **Tenant restriction**: Only `/consumers` tenant accepted (blocks organization accounts)
- **Scope limitation**: Only request necessary scopes (`XboxLive.signin`, `XboxLive.offline_access`)
- **Token validation**: Verify all tokens before use; validate expiration times
- **Error handling**: Handle XSTS errors gracefully without exposing internal details

#### 11.1.2 Token Storage & Encryption
- **Microsoft refresh tokens**: Encrypted with AES-256-GCM before database storage
- **Encryption key management**: Store `TOKEN_ENCRYPTION_KEY` in environment variables, never in code
- **Platform refresh tokens**: Stored as SHA-256 hashes, never plaintext
- **Access tokens**: Short-lived (15 minutes), stored in memory only
- **Key rotation**: Implement key rotation strategy for encryption keys

#### 11.1.3 Session Security
- **HttpOnly cookies**: Refresh tokens in HttpOnly, Secure, SameSite=Strict cookies
- **CSRF protection**: Double-submit cookie pattern for state-changing requests
- **Session binding**: Bind sessions to user agent and IP (warn on change, don't block)
- **Concurrent sessions**: Allow multiple sessions per user with session management UI
- **Session invalidation**: On password change (if applicable), security concern, or user logout

#### 11.1.4 Identity Verification
- **No manual username entry**: Minecraft username retrieved directly from Minecraft Services API
- **UUID verification**: Store and verify Minecraft UUID, not just username (usernames can change)
- **Edition detection**: Properly distinguish Java (UUID) vs Bedrock (XUID) players
- **Profile refresh**: Periodically refresh Minecraft profile to detect username changes

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
- Microsoft OAuth prevents impersonation
- Manual admin fulfillment reduces automated fraud
- Transaction monitoring for suspicious patterns
- Ban system for bad actors
- IP logging for admin actions
- Cooling-off period for new accounts (optional)

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Balance** | User's available money on the platform |
| **Bot** | The Mineflayer bot that listens to Minecraft chat |
| **Bridge** | Service connecting the bot to the web application |
| **Catalog** | Admin-configurable list of tradeable items |
| **Commission** | Percentage fee taken from marketplace sales |
| **Deposit** | Adding money or items to the platform |
| **Dual Owner** | A user who owns both Minecraft Java Edition and Bedrock Edition |
| **Fulfillment** | Admin process of completing deposit/withdrawal in-game |
| **Inventory** | User's items available for trading on the platform |
| **Listing** | An item put up for sale on the marketplace |
| **Marketplace** | Where users buy and sell items |
| **Premium Listing** | 48-hour listing with extended duration |
| **UUID** | Minecraft's unique identifier for players (Java Edition) |
| **Withdrawal** | Removing money or items from the platform to in-game |
| **XBL Token** | Xbox Live authentication token, obtained from Microsoft access token |
| **XSTS Token** | Xbox Security Token Service token, used to authenticate with Minecraft Services |
| **XUID** | Xbox User ID, unique identifier for Xbox/Bedrock Edition players |
| **User Hash (uhs)** | Xbox user hash included in XBL/XSTS tokens, required for Minecraft authentication |
| **Gamertag** | Xbox username, used as Minecraft username for Bedrock Edition players |
| **Edition** | Whether a user plays Java Edition or Bedrock Edition of Minecraft |
| **Edition Choice** | The mandatory selection page shown to dual owners to choose their trading identity |
| **Relying Party** | The service that will accept the XSTS token (e.g., `rp://api.minecraftservices.com/`) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Claude | Initial specification |
| 1.1 | 2026-01-23 | Claude | Complete authentication system overhaul: Microsoft → Xbox Live → XSTS → Minecraft Services API chain; Azure AD prerequisites; token storage schema; Bedrock/Java edition handling |
| 1.2 | 2026-01-24 | Claude | Added dual-edition user support: UC-AUTH-07/08 for edition choice flow; Edition Choice page UI specification; expanded users table schema with dual-identity columns; admin edition management; users.change_edition permission |

---

*This document serves as the complete specification for the DonutTrade platform. Implementation should follow these specifications while allowing for reasonable technical decisions during development.*
