import { prisma } from './database.js';
import * as redisService from './redis.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';

const settingsLogger = logger.module('platform-settings');

const REDIS_PREFIX = 'platform:';
const VALID_KEYS = ['commission_rate', 'hidden_mode_price', 'maintenance_enabled', 'maintenance_message'] as const;
type SettingKey = typeof VALID_KEYS[number];

function isValidKey(key: string): key is SettingKey {
  return (VALID_KEYS as readonly string[]).includes(key);
}

export const platformSettingsService = {
  async get(key: SettingKey): Promise<string> {
    const cached = await redisService.get(`${REDIS_PREFIX}${key}`);
    if (cached !== null) return cached;
    const setting = await prisma.platformSettings.findUnique({ where: { key } });
    const value = setting?.value ?? this._getDefault(key);
    await redisService.set(`${REDIS_PREFIX}${key}`, value);
    return value;
  },

  async getCommissionRate(): Promise<number> {
    const value = await this.get('commission_rate');
    return parseFloat(value);
  },

  async getHiddenModePrice(): Promise<number> {
    const value = await this.get('hidden_mode_price');
    return parseFloat(value);
  },

  async isMaintenanceEnabled(): Promise<boolean> {
    const value = await this.get('maintenance_enabled');
    return value === 'true';
  },

  async getMaintenanceMessage(): Promise<string> {
    return this.get('maintenance_message');
  },

  async update(key: string, value: string, adminId: string): Promise<void> {
    if (!isValidKey(key)) {
      throw new AppError(`Invalid setting key: ${key}`, { code: 'INVALID_KEY', statusCode: 400 });
    }
    this._validateValue(key, value);
    await prisma.platformSettings.upsert({
      where: { key },
      update: { value, updatedBy: adminId },
      create: { key, value, updatedBy: adminId },
    });
    await redisService.set(`${REDIS_PREFIX}${key}`, value);
    settingsLogger.info('setting.updated', `Setting ${key} updated`, { key, value, adminId });
  },

  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.platformSettings.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    for (const key of VALID_KEYS) {
      if (!(key in result)) {
        result[key] = this._getDefault(key);
      }
    }
    return result;
  },

  async hydrateCache(): Promise<void> {
    const settings = await prisma.platformSettings.findMany();
    for (const s of settings) {
      await redisService.set(`${REDIS_PREFIX}${s.key}`, s.value);
    }
    settingsLogger.info('cache.hydrated', 'Platform settings cache hydrated', { count: settings.length });
  },

  _getDefault(key: SettingKey): string {
    const defaults: Record<SettingKey, string> = {
      commission_rate: '0.02',
      hidden_mode_price: '10000000',
      maintenance_enabled: 'false',
      maintenance_message: '',
    };
    return defaults[key];
  },

  /**
   * Atomically increment the ticket counter and return the new value.
   * Uses UPSERT to handle first-use case (row doesn't exist yet).
   */
  async incrementTicketCounter(): Promise<number> {
    const result = await prisma.$queryRaw<[{ value: string }]>`
      INSERT INTO platform_settings (key, value, updated_by, updated_at)
      VALUES ('ticket_counter', '1', NULL, NOW())
      ON CONFLICT (key) DO UPDATE SET value = (platform_settings.value::int + 1)::text, updated_at = NOW()
      RETURNING value
    `;
    return parseInt(result[0].value, 10);
  },

  _validateValue(key: SettingKey, value: string): void {
    switch (key) {
      case 'commission_rate': {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0 || num > 0.5) {
          throw new ValidationError('Commission rate must be between 0 and 0.50');
        }
        break;
      }
      case 'hidden_mode_price': {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
          throw new ValidationError('Hidden mode price must be a non-negative integer');
        }
        break;
      }
      case 'maintenance_enabled': {
        if (value !== 'true' && value !== 'false') {
          throw new ValidationError('Maintenance enabled must be "true" or "false"');
        }
        break;
      }
      case 'maintenance_message': {
        if (value.length > 500) {
          throw new ValidationError('Maintenance message must be 500 characters or less');
        }
        break;
      }
    }
  },
};
