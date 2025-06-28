import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

// RovoDev-specific key interface
export interface RovoDevKeyData {
  _id: string;
  profile: string;
  email: string;
  apiToken: string;
  cloudId?: string | null;
  isInternal: boolean;
  isActive: boolean;
  lastUsed: string | null;
  failureCount: number;
  requestCount: number;
  dailyTokensUsed: number; // Track token usage instead of requests
  dailyTokenLimit: number; // 20M tokens per day
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
  createdAt: string;
  updatedAt: string;
}

// Helper functions for DB conversion
function dbToBoolean(value: any): boolean {
  return value === 1;
}

function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}

export class RovoDevKey implements RovoDevKeyData {
  _id: string;
  profile: string;
  email: string;
  apiToken: string;
  cloudId?: string | null;
  isInternal: boolean;
  isActive: boolean;
  lastUsed: string | null;
  failureCount: number;
  requestCount: number;
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
  createdAt: string;
  updatedAt: string;

  constructor(data: RovoDevKeyData) {
    this._id = data._id;
    this.profile = data.profile;
    this.email = data.email;
    this.apiToken = data.apiToken;
    this.cloudId = data.cloudId;
    this.isInternal = data.isInternal;
    this.isActive = data.isActive;
    this.lastUsed = data.lastUsed;
    this.failureCount = data.failureCount;
    this.requestCount = data.requestCount;
    this.dailyTokensUsed = data.dailyTokensUsed;
    this.dailyTokenLimit = data.dailyTokenLimit;
    this.lastResetDate = data.lastResetDate;
    this.isDisabledByRateLimit = data.isDisabledByRateLimit;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Convert DB row to RovoDevKey instance
  static fromDbRow(row: any): RovoDevKey {
    return new RovoDevKey({
      _id: row._id,
      profile: row.profile,
      email: row.email,
      apiToken: row.api_token,
      cloudId: row.cloud_id,
      isInternal: dbToBoolean(row.is_internal),
      isActive: dbToBoolean(row.is_active),
      lastUsed: row.last_used,
      failureCount: row.failure_count || 0,
      requestCount: row.request_count || 0,
      dailyTokensUsed: row.daily_tokens_used || 0,
      dailyTokenLimit: row.daily_token_limit || 20000000, // 20M default
      lastResetDate: row.last_reset_date,
      isDisabledByRateLimit: dbToBoolean(row.is_disabled_by_rate_limit),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // Convert instance to DB row format
  toDbRow(): any {
    return {
      _id: this._id,
      profile: this.profile,
      email: this.email,
      api_token: this.apiToken,
      cloud_id: this.cloudId,
      is_internal: booleanToDb(this.isInternal),
      is_active: booleanToDb(this.isActive),
      last_used: this.lastUsed,
      failure_count: this.failureCount,
      request_count: this.requestCount,
      daily_tokens_used: this.dailyTokensUsed,
      daily_token_limit: this.dailyTokenLimit,
      last_reset_date: this.lastResetDate,
      is_disabled_by_rate_limit: booleanToDb(this.isDisabledByRateLimit),
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  // Create a new RovoDev key
  static async create(data: {
    profile: string;
    email: string;
    apiToken: string;
    cloudId?: string;
    dailyTokenLimit?: number;
  }): Promise<RovoDevKey> {
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const isInternal = data.email.endsWith('@atlassian.com');

    const rovoDevKey = new RovoDevKey({
      _id: id,
      profile: data.profile,
      email: data.email,
      apiToken: data.apiToken,
      cloudId: data.cloudId || null,
      isInternal,
      isActive: true,
      lastUsed: null,
      failureCount: 0,
      requestCount: 0,
      dailyTokensUsed: 0,
      dailyTokenLimit: data.dailyTokenLimit || 20000000, // 20M tokens
      lastResetDate: now.split('T')[0], // Today's date
      isDisabledByRateLimit: false,
      createdAt: now,
      updatedAt: now
    });

    const dbRow = rovoDevKey.toDbRow();
    await db.run(`
      INSERT INTO rovodev_keys (
        _id, profile, email, api_token, cloud_id, is_internal, is_active,
        last_used, failure_count, request_count, daily_tokens_used, daily_token_limit,
        last_reset_date, is_disabled_by_rate_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dbRow._id, dbRow.profile, dbRow.email, dbRow.api_token, dbRow.cloud_id,
      dbRow.is_internal, dbRow.is_active, dbRow.last_used, dbRow.failure_count,
      dbRow.request_count, dbRow.daily_tokens_used, dbRow.daily_token_limit,
      dbRow.last_reset_date, dbRow.is_disabled_by_rate_limit, dbRow.created_at, dbRow.updated_at
    ]);

    return rovoDevKey;
  }

  // Find by ID
  static async findById(id: string): Promise<RovoDevKey | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM rovodev_keys WHERE _id = ?', id);
    return row ? RovoDevKey.fromDbRow(row) : null;
  }

  // Find all keys for a profile
  static async findByProfile(profile: string): Promise<RovoDevKey[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM rovodev_keys WHERE profile = ? ORDER BY created_at ASC', profile);
    return rows.map(row => RovoDevKey.fromDbRow(row));
  }

  // Find all active keys for a profile
  static async findActiveByProfile(profile: string): Promise<RovoDevKey[]> {
    const db = await getDb();
    const rows = await db.all(`
      SELECT * FROM rovodev_keys 
      WHERE profile = ? AND is_active = 1 AND is_disabled_by_rate_limit = 0 
      ORDER BY daily_tokens_used ASC, last_used ASC
    `, profile);
    return rows.map(row => RovoDevKey.fromDbRow(row));
  }

  // Get all keys
  static async findAll(): Promise<RovoDevKey[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM rovodev_keys ORDER BY created_at DESC');
    return rows.map(row => RovoDevKey.fromDbRow(row));
  }

  // Update key
  async update(updates: Partial<RovoDevKeyData>): Promise<void> {
    const db = await getDb();
    
    // Apply updates to instance
    Object.assign(this, updates);
    this.updatedAt = new Date().toISOString();

    const dbRow = this.toDbRow();
    await db.run(`
      UPDATE rovodev_keys SET
        profile = ?, email = ?, api_token = ?, cloud_id = ?, is_internal = ?,
        is_active = ?, last_used = ?, failure_count = ?, request_count = ?,
        daily_tokens_used = ?, daily_token_limit = ?, last_reset_date = ?,
        is_disabled_by_rate_limit = ?, updated_at = ?
      WHERE _id = ?
    `, [
      dbRow.profile, dbRow.email, dbRow.api_token, dbRow.cloud_id, dbRow.is_internal,
      dbRow.is_active, dbRow.last_used, dbRow.failure_count, dbRow.request_count,
      dbRow.daily_tokens_used, dbRow.daily_token_limit, dbRow.last_reset_date,
      dbRow.is_disabled_by_rate_limit, dbRow.updated_at, dbRow._id
    ]);
  }

  // Delete key
  async delete(): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM rovodev_keys WHERE _id = ?', this._id);
  }

  // Check if daily limit needs reset
  checkDailyReset(): boolean {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailyTokensUsed = 0;
      this.lastResetDate = today;
      this.isDisabledByRateLimit = false;
      return true;
    }
    return false;
  }

  // Record token usage
  async recordTokenUsage(tokensUsed: number): Promise<void> {
    this.checkDailyReset();
    
    this.dailyTokensUsed += tokensUsed;
    this.requestCount += 1;
    this.lastUsed = new Date().toISOString();
    
    // Check if we've hit the daily limit
    if (this.dailyTokensUsed >= this.dailyTokenLimit) {
      this.isDisabledByRateLimit = true;
    }

    await this.update({
      dailyTokensUsed: this.dailyTokensUsed,
      requestCount: this.requestCount,
      lastUsed: this.lastUsed,
      lastResetDate: this.lastResetDate,
      isDisabledByRateLimit: this.isDisabledByRateLimit
    });
  }

  // Record failure
  async recordFailure(): Promise<void> {
    this.failureCount += 1;
    this.lastUsed = new Date().toISOString();

    // Disable key after 5 consecutive failures
    if (this.failureCount >= 5) {
      this.isActive = false;
    }

    await this.update({
      failureCount: this.failureCount,
      lastUsed: this.lastUsed,
      isActive: this.isActive
    });
  }

  // Reset failure count on success
  async resetFailures(): Promise<void> {
    if (this.failureCount > 0) {
      this.failureCount = 0;
      await this.update({ failureCount: 0 });
    }
  }

  // Get remaining tokens for today
  getRemainingTokens(): number {
    this.checkDailyReset();
    return Math.max(0, this.dailyTokenLimit - this.dailyTokensUsed);
  }

  // Check if key is usable
  isUsable(): boolean {
    this.checkDailyReset();
    return this.isActive && !this.isDisabledByRateLimit && this.getRemainingTokens() > 0;
  }

  // Get masked API token for display
  getMaskedToken(): string {
    if (this.apiToken.length <= 8) return this.apiToken;
    return this.apiToken.substring(0, 4) + '...' + this.apiToken.substring(this.apiToken.length - 4);
  }

  // Convert to JSON for API responses
  toJSON(): any {
    return {
      id: this._id,
      profile: this.profile,
      email: this.email,
      apiToken: this.getMaskedToken(),
      cloudId: this.cloudId,
      isInternal: this.isInternal,
      isActive: this.isActive,
      lastUsed: this.lastUsed,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      dailyTokensUsed: this.dailyTokensUsed,
      dailyTokenLimit: this.dailyTokenLimit,
      remainingTokens: this.getRemainingTokens(),
      lastResetDate: this.lastResetDate,
      isDisabledByRateLimit: this.isDisabledByRateLimit,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default RovoDevKey;