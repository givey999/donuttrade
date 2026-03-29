import { AuthProvider, VerificationStatus } from './auth.js';

/**
 * Log level enumeration for structured logging
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Structured log entry format
 * Every log entry MUST include these fields for consistent observability
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log severity level */
  level: LogLevel;
  /** Request-scoped unique ID for distributed tracing */
  correlationId: string;
  /** Service name: 'api', 'web', 'bot-bridge', 'worker' */
  service: string;
  /** Module within the service: 'auth', 'marketplace', 'deposits' */
  module: string;
  /** Specific action: 'login', 'createListing', 'processPayment' */
  action: string;
  /** User ID when authenticated */
  userId?: string;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Action-specific metadata */
  metadata?: Record<string, unknown>;
  /** Error details when applicable */
  error?: LogError;
}

/**
 * Error structure for logging
 */
export interface LogError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

/**
 * Base API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

/**
 * API error format
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}

/**
 * Individual service health
 */
export interface ServiceHealth {
  status: 'ok' | 'unhealthy';
  latency?: number;
  error?: string;
}

/**
 * Request context passed through the application
 */
export interface RequestContext {
  correlationId: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  startTime: number;
}

// ============================================================================
// USER TYPES (Phase 1)
// ============================================================================

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  authProvider: AuthProvider;
  minecraftUsername?: string;

  // Microsoft auth
  microsoftId?: string;

  // Discord auth
  discordId?: string;
  discordUsername?: string;

  // Email auth
  email?: string;
  passwordHash?: string;
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  minecraftUsername?: string;
  microsoftId?: string | null;
  discordId?: string | null;
  discordUsername?: string | null;
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  emailVerificationCode?: string | null;
  emailVerificationExpiresAt?: Date | null;
  verificationAmount?: number | null;
  verificationExpiresAt?: Date | null;
  verificationStatus?: VerificationStatus;
  lastLoginAt?: Date;
  bannedAt?: Date | null;
  banReason?: string | null;
}

/**
 * User profile returned by API
 */
export interface UserProfile {
  id: string;
  authProvider: AuthProvider;
  minecraftUsername: string | null;
  email: string | null;
  discordId: string | null;
  discordUsername: string | null;
  microsoftId: string | null;
  verificationStatus: VerificationStatus;
  balance: string;  // Decimal as string
  tradingVolume: string;
  role: UserRole;
  timedOutUntil: string | null;
  timeoutReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Session creation input
 */
export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

/**
 * Auth state creation input
 */
export interface CreateAuthStateInput {
  state: string;
  authMethod: string;
  redirectUrl?: string;
  expiresAt: Date;
}

// ============================================================================
// FINANCIAL TYPES (Phase 7)
// ============================================================================

export type UserRole = 'user' | 'moderator' | 'manager' | 'admin' | 'leader';

export type TransactionType = 'deposit' | 'withdrawal' | 'purchase' | 'sale' | 'escrow' | 'escrow_refund' | 'listing_fee' | 'admin_adjustment' | 'cosmetic_purchase' | 'hidden_mode_purchase';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TransactionRecord {
  id: string;
  userId: string;
  type: TransactionType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

export interface DepositResult {
  transactionId: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: string;
  status: WithdrawalStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface PendingWithdrawal {
  id: string;
  username: string;
  amount: string;
}

// ============================================================================
// CATALOG & INVENTORY TYPES
// ============================================================================

export interface CatalogItemRecord {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string | null;
  iconUrl: string | null;
  enabled: boolean;
}

export interface InventoryItemRecord {
  id: string;
  catalogItemId: string;
  catalogItemName: string;
  catalogItemDisplayName: string;
  category: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

// ============================================================================
// ITEM DEPOSIT & WITHDRAWAL TYPES
// ============================================================================

export type ItemDepositStatus = 'pending' | 'verified' | 'confirmed' | 'rejected';
export type ItemWithdrawalStatus = 'pending' | 'verified' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ItemDepositRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  catalogItemDisplayName: string;
  quantity: number;
  status: ItemDepositStatus;
  adminNotes: string | null;
  createdAt: string;
  completedAt: string | null;
  code: string | null;
  codeExpiresAt: string | null;
}

export interface ItemWithdrawalRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  catalogItemDisplayName: string;
  quantity: number;
  status: ItemWithdrawalStatus;
  failReason: string | null;
  createdAt: string;
  completedAt: string | null;
  code: string | null;
  codeExpiresAt: string | null;
}

// ============================================================================
// MARKETPLACE ORDER TYPES
// ============================================================================

export type OrderType = 'buy' | 'sell';
export type OrderStatus = 'active' | 'completed' | 'cancelled' | 'expired';

export interface OrderRecord {
  id: string;
  userId: string;
  username: string;
  type: OrderType;
  catalogItemId: string;
  catalogItemDisplayName: string;
  category: string;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  pricePerUnit: string;
  commissionRate: string;
  escrowAmount: string;
  isPremium: boolean;
  status: OrderStatus;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  borderColor: string | null;
  usernameColor: string | null;
  usernameFont: string | null;
}

export interface OrderFillRecord {
  id: string;
  orderId: string;
  filledByUserId: string;
  filledByUsername: string;
  quantity: number;
  pricePerUnit: string;
  totalPrice: string;
  commissionAmount: string;
  netAmount: string;
  createdAt: string;
}

export interface OrderDetailRecord extends OrderRecord {
  fills: OrderFillRecord[];
}

export interface CreateOrderInput {
  type: OrderType;
  catalogItemId: string;
  quantity: number;
  pricePerUnit: number;
  isPremium?: boolean;
  borderColor?: string;
  usernameColor?: string;
  usernameFont?: string;
}

export interface FillOrderInput {
  quantity: number;
}

// Auth types (OAuth, Discord, Email)
export * from './auth.js';
