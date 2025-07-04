import { getDb } from '../db'; // Import the database connection function
import { v4 as uuidv4 } from 'uuid'; // For generating IDs if needed

// Define the ApiKey interface (matches the table schema)
export interface ApiKeyData {
  _id: string;
  key: string;
  name?: string | null; // Allow null from DB
  profile?: string; // Profile name for key grouping
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null; // Allow null from DB
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

// Helper to convert DB result (0/1) to boolean
function dbToBoolean(value: any): boolean {
  return value === 1;
}

// Helper to convert boolean to DB value (0/1)
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}


export class ApiKey implements ApiKeyData {
  _id: string;
  key: string;
  name?: string | null;
  profile?: string;
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;

  constructor(data: ApiKeyData) {
    this._id = data._id;
    this.key = data.key;
    this.name = data.name;
    this.profile = data.profile;
    this.isActive = data.isActive; // Booleans are handled directly in the class
    this.lastUsed = data.lastUsed;
    this.rateLimitResetAt = data.rateLimitResetAt;
    this.failureCount = data.failureCount;
    this.requestCount = data.requestCount;
    this.dailyRateLimit = data.dailyRateLimit;
    this.dailyRequestsUsed = data.dailyRequestsUsed;
    this.lastResetDate = data.lastResetDate;
    this.isDisabledByRateLimit = data.isDisabledByRateLimit;
  }

  // Static method to find one key by query object
  static async findOne(query: Partial<ApiKeyData>): Promise<ApiKey | null> {
    const db = await getDb();
    
    // Validate and sanitize query parameters
    const validFields = ['_id', 'key', 'isActive', 'profile', 'isDisabledByRateLimit'];
    const sanitizedQuery: Partial<ApiKeyData> = {};
    
    for (const [key, value] of Object.entries(query)) {
      if (validFields.includes(key) && value !== undefined) {
        (sanitizedQuery as any)[key] = value;
      }
    }
    
    // Build WHERE clause with parameterized queries
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (sanitizedQuery._id !== undefined) {
      whereClause += ' AND _id = ?';
      params.push(sanitizedQuery._id);
    }
    if (sanitizedQuery.key !== undefined) {
      whereClause += ' AND key = ?';
      params.push(sanitizedQuery.key);
    }
    if (sanitizedQuery.isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(booleanToDb(sanitizedQuery.isActive));
    }
    if (sanitizedQuery.profile !== undefined) {
      whereClause += ' AND profile = ?';
      params.push(sanitizedQuery.profile);
    }
    if (sanitizedQuery.isDisabledByRateLimit !== undefined) {
      whereClause += ' AND isDisabledByRateLimit = ?';
      params.push(booleanToDb(sanitizedQuery.isDisabledByRateLimit));
    }

    const row = await db.get<ApiKeyData>(`SELECT * FROM api_keys ${whereClause}`, params);

    if (!row) return null;

    // Convert boolean fields from DB format
    return new ApiKey({
        ...row,
        isActive: dbToBoolean(row.isActive),
        isDisabledByRateLimit: dbToBoolean(row.isDisabledByRateLimit),
    });
  }

  // Static method to find all keys matching a query object
  static async findAll(query: Partial<ApiKeyData> = {}): Promise<ApiKey[]> {
    const db = await getDb();
    // Build WHERE clause dynamically
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (query.isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(booleanToDb(query.isActive));
    }
    if (query.isDisabledByRateLimit !== undefined) {
        whereClause += ' AND isDisabledByRateLimit = ?';
        params.push(booleanToDb(query.isDisabledByRateLimit));
    }
    if (query.profile !== undefined) {
        whereClause += ' AND profile = ?';
        params.push(query.profile);
    }
    // Handle the $or condition for rateLimitResetAt specifically for keyManager usage
    if ((query as any).$or && Array.isArray((query as any).$or)) {
        const orConditions = (query as any).$or as any[];
        const rateLimitConditions = orConditions
            .map((cond: any) => {
                if (cond.rateLimitResetAt === null) {
                    return 'rateLimitResetAt IS NULL';
                }
                if (cond.rateLimitResetAt?.$lte) {
                    params.push(cond.rateLimitResetAt.$lte);
                    return 'rateLimitResetAt <= ?';
                }
                return null; // Ignore invalid conditions
            })
            .filter(c => c !== null);

        if (rateLimitConditions.length > 0) {
            whereClause += ` AND (${rateLimitConditions.join(' OR ')})`;
        }
    }
    // Add other query fields as needed...

    const rows = await db.all<ApiKeyData[]>(`SELECT * FROM api_keys ${whereClause}`, params);

    return rows.map(row => new ApiKey({
        ...row,
        isActive: dbToBoolean(row.isActive),
        isDisabledByRateLimit: dbToBoolean(row.isDisabledByRateLimit),
    }));
  }

  // Static method to create a new key
  static async create(data: Partial<ApiKeyData>): Promise<ApiKey> {
    const db = await getDb();
    const newId = data._id || uuidv4(); // Generate ID if not provided
    const keyData: ApiKeyData = {
      _id: newId,
      key: data.key || '',
      name: data.name,
      profile: data.profile || '',
      isActive: data.isActive ?? true,
      lastUsed: data.lastUsed || null,
      rateLimitResetAt: data.rateLimitResetAt || null,
      failureCount: data.failureCount ?? 0,
      requestCount: data.requestCount ?? 0,
      dailyRateLimit: data.dailyRateLimit === undefined ? null : data.dailyRateLimit,
      dailyRequestsUsed: data.dailyRequestsUsed ?? 0,
      lastResetDate: data.lastResetDate || null,
      isDisabledByRateLimit: data.isDisabledByRateLimit ?? false,
    };

    if (!keyData.key) throw new Error("API key value cannot be empty");

    await db.run(
      `INSERT INTO api_keys (_id, key, name, profile, isActive, lastUsed, rateLimitResetAt, failureCount, requestCount, dailyRateLimit, dailyRequestsUsed, lastResetDate, isDisabledByRateLimit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      keyData._id,
      keyData.key,
      keyData.name,
      keyData.profile,
      booleanToDb(keyData.isActive),
      keyData.lastUsed,
      keyData.rateLimitResetAt,
      keyData.failureCount,
      keyData.requestCount,
      keyData.dailyRateLimit,
      keyData.dailyRequestsUsed,
      keyData.lastResetDate,
      booleanToDb(keyData.isDisabledByRateLimit)
    );

    return new ApiKey(keyData);
  }

  // Instance method to save (update) the current key
  async save(): Promise<ApiKey> {
    const db = await getDb();
    await db.run(
      `UPDATE api_keys
       SET key = ?, name = ?, profile = ?, isActive = ?, lastUsed = ?, rateLimitResetAt = ?, failureCount = ?, requestCount = ?, dailyRateLimit = ?, dailyRequestsUsed = ?, lastResetDate = ?, isDisabledByRateLimit = ?
       WHERE _id = ?`,
      this.key,
      this.name,
      this.profile,
      booleanToDb(this.isActive),
      this.lastUsed,
      this.rateLimitResetAt,
      this.failureCount,
      this.requestCount,
      this.dailyRateLimit,
      this.dailyRequestsUsed,
      this.lastResetDate,
      booleanToDb(this.isDisabledByRateLimit),
      this._id
    );
    return this; // Return the instance
  }

  // Instance method to delete the current key
  async delete(): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM api_keys WHERE _id = ?', this._id);
  }

  // Static method to delete a key by ID
  static async deleteById(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.run('DELETE FROM api_keys WHERE _id = ?', id);
    return result.changes !== undefined && result.changes > 0; // Return true if a row was deleted
  }

  // Static method for bulk updates (more efficient with DB)
  // This implementation updates keys one by one, but within a transaction for atomicity.
  // For very large updates, more optimized bulk SQL might be needed depending on the DB.
  static async bulkUpdate(updatedKeysMap: Map<string, ApiKey>): Promise<void> {
    if (updatedKeysMap.size === 0) return;

    const db = await getDb();
    let transaction = false;
    
    try {
      await db.run('BEGIN IMMEDIATE TRANSACTION'); // Use IMMEDIATE to avoid deadlocks
      transaction = true;
      
      // Prepare statement for better performance
      const stmt = await db.prepare(
        `UPDATE api_keys
         SET key = ?, name = ?, profile = ?, isActive = ?, lastUsed = ?, rateLimitResetAt = ?, failureCount = ?, requestCount = ?, dailyRateLimit = ?, dailyRequestsUsed = ?, lastResetDate = ?, isDisabledByRateLimit = ?
         WHERE _id = ?`
      );
      
      try {
        for (const keyInstance of updatedKeysMap.values()) {
          await stmt.run(
            keyInstance.key,
            keyInstance.name,
            keyInstance.profile,
            booleanToDb(keyInstance.isActive),
            keyInstance.lastUsed,
            keyInstance.rateLimitResetAt,
            keyInstance.failureCount,
            keyInstance.requestCount,
            keyInstance.dailyRateLimit,
            keyInstance.dailyRequestsUsed,
            keyInstance.lastResetDate,
            booleanToDb(keyInstance.isDisabledByRateLimit),
            keyInstance._id
          );
        }
      } finally {
        await stmt.finalize();
      }
      
      await db.run('COMMIT');
      transaction = false;
    } catch (error) {
      if (transaction) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
      }
      console.error("Bulk update failed:", error);
      throw error; // Re-throw the error
    }
  }
}
