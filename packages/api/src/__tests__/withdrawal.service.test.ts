import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withdrawalService } from '../services/withdrawal.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { withdrawalRepository } from '../repositories/withdrawal.repository.js';
import { withTransaction } from '../services/database.js';

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    decrementBalance: vi.fn(),
    incrementBalance: vi.fn(),
  },
}));

vi.mock('../repositories/transaction.repository.js', () => ({
  transactionRepository: {
    create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
  },
}));

vi.mock('../repositories/withdrawal.repository.js', () => ({
  withdrawalRepository: {
    create: vi.fn().mockResolvedValue({ id: 'wd-1', status: 'pending', createdAt: new Date() }),
    findById: vi.fn(),
    markCompleted: vi.fn(),
    markProcessing: vi.fn(),
  },
}));

const mockUser = {
  id: 'user-1',
  minecraftUsername: 'TestPlayer',
  verificationStatus: 'verified',
  balance: { toNumber: () => 1000 },
  bannedAt: null,
};

describe('withdrawalService.requestWithdrawal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);

    // Mock withTransaction to simulate the inner tx queries
    vi.mocked(withTransaction).mockImplementation(async (fn) => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ balance: { toNumber: () => 1000 } }),
        },
        withdrawal: {
          findFirst: vi.fn().mockResolvedValue(null), // no active/recent withdrawal
        },
      };
      return fn(mockTx as any);
    });
  });

  it('creates a withdrawal and deducts balance', async () => {
    const result = await withdrawalService.requestWithdrawal('user-1', 200);

    expect(result.id).toBe('wd-1');
    expect(result.amount).toBe('200');
    expect(result.status).toBe('pending');
    expect(userRepository.decrementBalance).toHaveBeenCalledWith('user-1', 200, expect.anything());
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'withdrawal', amount: 200, userId: 'user-1' }),
      expect.anything(),
    );
  });

  it('rejects withdrawal below minimum', async () => {
    await expect(withdrawalService.requestWithdrawal('user-1', 0))
      .rejects.toThrow('Amount out of limits');
  });

  it('rejects withdrawal above maximum', async () => {
    await expect(withdrawalService.requestWithdrawal('user-1', 999_999_999))
      .rejects.toThrow('Amount out of limits');
  });

  it('rejects withdrawal for unverified user', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      ...mockUser,
      verificationStatus: 'pending',
    } as any);

    await expect(withdrawalService.requestWithdrawal('user-1', 100))
      .rejects.toThrow('Account must be verified');
  });

  it('rejects withdrawal for banned user', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      ...mockUser,
      bannedAt: new Date(),
    } as any);

    await expect(withdrawalService.requestWithdrawal('user-1', 100))
      .rejects.toThrow('Account is banned');
  });

  it('rejects withdrawal with insufficient balance', async () => {
    vi.mocked(withTransaction).mockImplementation(async (fn) => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ balance: { toNumber: () => 50 } }),
        },
        withdrawal: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      return fn(mockTx as any);
    });

    await expect(withdrawalService.requestWithdrawal('user-1', 200))
      .rejects.toThrow('Insufficient balance');
  });

  it('rejects withdrawal during cooldown', async () => {
    vi.mocked(withTransaction).mockImplementation(async (fn) => {
      const recentTime = new Date(Date.now() - 1000); // 1 second ago
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ balance: { toNumber: () => 1000 } }),
        },
        withdrawal: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(null)            // no active withdrawal
            .mockResolvedValueOnce({ createdAt: recentTime }), // recent withdrawal for cooldown
        },
      };
      return fn(mockTx as any);
    });

    await expect(withdrawalService.requestWithdrawal('user-1', 100))
      .rejects.toThrow('Withdrawal cooldown active');
  });

  it('rejects when a withdrawal is already in progress', async () => {
    vi.mocked(withTransaction).mockImplementation(async (fn) => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ balance: { toNumber: () => 1000 } }),
        },
        withdrawal: {
          findFirst: vi.fn().mockResolvedValue({ id: 'wd-active', status: 'pending' }), // active withdrawal
        },
      };
      return fn(mockTx as any);
    });

    await expect(withdrawalService.requestWithdrawal('user-1', 100))
      .rejects.toThrow('You already have a withdrawal in progress');
  });
});

describe('withdrawalService.confirmWithdrawal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms a pending withdrawal', async () => {
    vi.mocked(withdrawalRepository.findById).mockResolvedValue({
      id: 'wd-1',
      userId: 'user-1',
      status: 'pending',
      amount: { toNumber: () => 200, toString: () => '200' },
    } as any);

    await withdrawalService.confirmWithdrawal('wd-1');

    expect(withdrawalRepository.markCompleted).toHaveBeenCalledWith('wd-1');
  });

  it('rejects confirming a completed withdrawal', async () => {
    vi.mocked(withdrawalRepository.findById).mockResolvedValue({
      id: 'wd-1',
      status: 'completed',
    } as any);

    await expect(withdrawalService.confirmWithdrawal('wd-1'))
      .rejects.toThrow('not in a confirmable state');
  });
});
