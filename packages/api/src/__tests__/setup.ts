import { vi } from 'vitest';

// Silence all logger output during tests
vi.mock('../lib/logger.js', () => {
  const noop = () => {};
  const noopLogger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop };
  return {
    logger: { module: () => noopLogger },
  };
});

// Mock withTransaction to just call the callback with a mock tx client
vi.mock('../services/database.js', () => ({
  prisma: {},
  withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    // The mock tx object — tests override specific methods as needed
    const mockTx = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      withdrawal: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    return fn(mockTx);
  }),
}));
