import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depositService } from '../services/deposit.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { withTransaction } from '../services/database.js';
import { DEPOSIT_MIN_AMOUNT, DEPOSIT_MAX_AMOUNT } from '@donuttrade/shared';

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findByMinecraftUsername: vi.fn(),
    incrementBalance: vi.fn(),
  },
}));

vi.mock('../repositories/transaction.repository.js', () => ({
  transactionRepository: {
    create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
  },
}));

const mockUser = {
  id: 'user-1',
  minecraftUsername: 'TestPlayer',
  verificationStatus: 'verified',
  balance: { toNumber: () => 100 },
  bannedAt: null,
};

describe('depositService.processDeposit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(userRepository.findByMinecraftUsername).mockResolvedValue(mockUser as any);

    // Make withTransaction call the fn with a mock tx that returns fresh user
    vi.mocked(withTransaction).mockImplementation(async (fn) => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ balance: { toNumber: () => 100 } }),
        },
      };
      return fn(mockTx as any);
    });
  });

  it('processes a valid deposit and returns deposited: true', async () => {
    const result = await depositService.processDeposit('TestPlayer', 500);

    expect(result.deposited).toBe(true);
    expect(result.deposit).toBeDefined();
    expect(result.deposit!.amount).toBe('500');
    expect(result.deposit!.balanceBefore).toBe('100');
    expect(result.deposit!.balanceAfter).toBe('600');
    expect(userRepository.incrementBalance).toHaveBeenCalledWith('user-1', 500, expect.anything());
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deposit', amount: 500, userId: 'user-1' }),
      expect.anything(),
    );
  });

  it('rejects deposit below minimum and refunds verified user', async () => {
    const result = await depositService.processDeposit('TestPlayer', DEPOSIT_MIN_AMOUNT - 1);

    expect(result.deposited).toBe(false);
    expect(result.refund).toBe(true);
    expect(result.refundAmount).toBe(DEPOSIT_MIN_AMOUNT - 1);
  });

  it('rejects deposit above maximum and refunds verified user', async () => {
    const result = await depositService.processDeposit('TestPlayer', DEPOSIT_MAX_AMOUNT + 1);

    expect(result.deposited).toBe(false);
    expect(result.refund).toBe(true);
  });

  it('returns no refund for unknown username', async () => {
    vi.mocked(userRepository.findByMinecraftUsername).mockResolvedValue(null as any);

    const result = await depositService.processDeposit('UnknownPlayer', 500);

    expect(result.deposited).toBe(false);
    expect(result.refund).toBe(false);
  });

  it('returns no refund for unverified user', async () => {
    vi.mocked(userRepository.findByMinecraftUsername).mockResolvedValue({
      ...mockUser,
      verificationStatus: 'pending',
    } as any);

    const result = await depositService.processDeposit('TestPlayer', 500);

    expect(result.deposited).toBe(false);
    expect(result.refund).toBe(false);
  });

  it('rejects deposit from banned user', async () => {
    vi.mocked(userRepository.findByMinecraftUsername).mockResolvedValue({
      ...mockUser,
      bannedAt: new Date(),
    } as any);

    const result = await depositService.processDeposit('TestPlayer', 500);

    expect(result.deposited).toBe(false);
    expect(result.refund).toBe(false);
  });
});
