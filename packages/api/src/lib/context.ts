import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '@donuttrade/shared';

/**
 * AsyncLocalStorage for request context
 * Allows accessing request-scoped data anywhere in the call stack
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Create a new request context
 */
export function createContext(options?: Partial<RequestContext>): RequestContext {
  return {
    correlationId: options?.correlationId ?? randomUUID(),
    userId: options?.userId,
    userAgent: options?.userAgent,
    ipAddress: options?.ipAddress,
    startTime: options?.startTime ?? Date.now(),
  };
}

/**
 * Run a function with a request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get the current request context
 * Returns undefined if called outside of a request context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID
 * Returns a new UUID if no context is available (for logging outside requests)
 */
export function getCorrelationId(): string {
  return getContext()?.correlationId ?? randomUUID();
}

/**
 * Get the current user ID from context
 */
export function getUserId(): string | undefined {
  return getContext()?.userId;
}

/**
 * Get the request start time
 */
export function getStartTime(): number {
  return getContext()?.startTime ?? Date.now();
}

/**
 * Calculate elapsed time since request start
 */
export function getElapsedTime(): number {
  const startTime = getContext()?.startTime;
  if (!startTime) return 0;
  return Date.now() - startTime;
}

/**
 * Update the current context with a user ID
 */
export function setContextUserId(userId: string): void {
  const context = getContext();
  if (context) {
    context.userId = userId;
  }
}
