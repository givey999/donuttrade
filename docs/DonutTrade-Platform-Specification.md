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
- **Authentication**: Microsoft OAuth with verified Minecraft username linkage
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

#### UC-AUTH-01: New User Registration
**Actor**: Guest
**Precondition**: User has a Microsoft account linked to Minecraft
**Flow**:
1. User clicks "Login with Microsoft" on landing page
2. User completes Microsoft OAuth flow
3. System receives Microsoft ID and email
4. System prompts user to enter their Minecraft username
5. System generates a unique verification code (e.g., "VERIFY-X7K9")
6. System displays instruction: "Whisper this code to our bot in-game: /tell BotName VERIFY-X7K9"
7. User sends whisper to bot in Minecraft
8. Bot detects whisper, validates code, reports to system
9. System links Microsoft account to verified Minecraft username and UUID
10. Account created; user redirected to dashboard

**Postcondition**: User account exists with verified Minecraft identity

#### UC-AUTH-02: Returning User Login
**Actor**: Registered User
**Flow**:
1. User clicks "Login with Microsoft"
2. User completes Microsoft OAuth
3. System matches Microsoft ID to existing account
4. User redirected to dashboard

#### UC-AUTH-03: Session Persistence
**Actor**: Registered User
**Flow**:
1. User logs in with "Remember me" option
2. System issues long-lived refresh token (30 days)
3. On return visits, system auto-refreshes session
4. User remains logged in across browser sessions

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

### 4.1 Microsoft OAuth Flow

```
┌──────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────┐
│  User    │     │ Platform │     │   Microsoft   │     │   Bot    │
│ Browser  │     │  Server  │     │    OAuth      │     │(In-Game) │
└────┬─────┘     └────┬─────┘     └───────┬───────┘     └────┬─────┘
     │                │                   │                   │
     │ Click Login    │                   │                   │
     │───────────────>│                   │                   │
     │                │                   │                   │
     │                │ Redirect to MS    │                   │
     │<───────────────│                   │                   │
     │                │                   │                   │
     │ Authenticate   │                   │                   │
     │───────────────────────────────────>│                   │
     │                │                   │                   │
     │ Auth Code      │                   │                   │
     │<───────────────────────────────────│                   │
     │                │                   │                   │
     │ Callback       │                   │                   │
     │───────────────>│                   │                   │
     │                │                   │                   │
     │                │ Exchange Code     │                   │
     │                │──────────────────>│                   │
     │                │                   │                   │
     │                │ Access Token      │                   │
     │                │<──────────────────│                   │
     │                │                   │                   │
     │                │ Get MC Profile    │                   │
     │                │──────────────────>│                   │
     │                │                   │                   │
     │                │ UUID + Username   │                   │
     │                │<──────────────────│                   │
     │                │                   │                   │
```

### 4.2 Minecraft Username Verification

For accounts where Microsoft profile doesn't return Minecraft data (edge cases), a secondary verification is used:

1. System generates unique code: `VERIFY-{random8chars}`
2. Code stored with expiration (15 minutes)
3. User sends in-game whisper: `/tell BotName VERIFY-X7K9M2P1`
4. Bot detects whisper, extracts code and sender username
5. Bot reports to API: `{ code: "VERIFY-X7K9M2P1", username: "PlayerName" }`
6. API validates code, links username to account

### 4.3 Session Management

| Token Type | Lifetime | Storage | Purpose |
|------------|----------|---------|---------|
| Access Token | 15 minutes | Memory | API authentication |
| Refresh Token | 30 days | HttpOnly Cookie | Session renewal |
| CSRF Token | Per request | Cookie + Header | Request validation |

### 4.4 Bedrock Player Support

Bedrock Edition players (Xbox/mobile) authenticate through the same Microsoft OAuth flow. Their usernames are prefixed with `.` (period) to distinguish from Java Edition players, as specified in the original requirements.

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
| minecraft_username | VARCHAR(16) | NOT NULL, UNIQUE | Verified MC username |
| minecraft_uuid | VARCHAR(36) | NOT NULL, UNIQUE | Minecraft UUID |
| microsoft_id | VARCHAR(255) | UNIQUE | Microsoft OAuth ID |
| email | VARCHAR(255) | | Microsoft email |
| balance | DECIMAL(20,2) | DEFAULT 0.00 | Available balance |
| created_at | TIMESTAMP | DEFAULT NOW() | Registration time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |
| banned_at | TIMESTAMP | | Ban timestamp (NULL = not banned) |
| ban_reason | TEXT | | Reason for ban |

**Indexes**:
- `idx_users_minecraft_username` on `minecraft_username`
- `idx_users_minecraft_uuid` on `minecraft_uuid`

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
| GET | `/auth/microsoft` | Initiate Microsoft OAuth |
| GET | `/auth/microsoft/callback` | OAuth callback |
| POST | `/auth/verify-minecraft` | Verify MC username |
| GET | `/auth/me` | Get current user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout |

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
| Auth | Passport.js | Microsoft OAuth strategy available |
| Validation | Zod | Runtime type validation |

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
- Microsoft OAuth 2.0 with PKCE flow
- Short-lived access tokens (15 minutes)
- Refresh tokens in HttpOnly, Secure, SameSite cookies
- CSRF protection with double-submit cookies
- Session invalidation on suspicious activity

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
| **Fulfillment** | Admin process of completing deposit/withdrawal in-game |
| **Inventory** | User's items available for trading on the platform |
| **Listing** | An item put up for sale on the marketplace |
| **Marketplace** | Where users buy and sell items |
| **Premium Listing** | 48-hour listing with extended duration |
| **UUID** | Minecraft's unique identifier for players |
| **Withdrawal** | Removing money or items from the platform to in-game |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Claude | Initial specification |

---

*This document serves as the complete specification for the DonutTrade platform. Implementation should follow these specifications while allowing for reasonable technical decisions during development.*
