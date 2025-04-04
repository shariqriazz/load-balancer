import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { logError } from './services/logger'; // Assuming logger is needed

// Define the path for the database file within the 'data' directory
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.db');

// Define the Settings interface (can be shared or redefined if needed)
export interface Settings {
  keyRotationRequestCount: number;
  maxFailureCount: number;
  rateLimitCooldown: number; // Cooldown in seconds
  logRetentionDays: number;
  maxRetries: number; // Max retries for downstream API calls
}

// Define and export default settings
const DEFAULT_SETTINGS: Settings = {
  keyRotationRequestCount: 5,
  maxFailureCount: 5,
  rateLimitCooldown: 60, // Default 1 minute cooldown
  logRetentionDays: 14, // Default 14 days retention
  maxRetries: 3, // Default 3 retries
};


let dbInstance: Database | null = null;

// Function to ensure the data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      logError(error, { context: 'ensureDataDir' });
      throw error; // Re-throw if it's not an 'already exists' error
    }
  }
}

// Function to initialize the database connection and schema
async function initializeDatabase(): Promise<Database> {
  await ensureDataDir(); // Make sure the data directory exists first

  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  // Enable WAL mode for better concurrency
  await db.run('PRAGMA journal_mode = WAL;');

  // Create api_keys table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      _id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      lastUsed TEXT, -- ISO 8601 date string
      rateLimitResetAt TEXT, -- ISO 8601 date string
      failureCount INTEGER NOT NULL DEFAULT 0,
      requestCount INTEGER NOT NULL DEFAULT 0,
      dailyRateLimit INTEGER, -- NULL means no limit
      dailyRequestsUsed INTEGER NOT NULL DEFAULT 0,
      lastResetDate TEXT, -- ISO 8601 date string
      isDisabledByRateLimit BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);

  // Create settings table if it doesn't exist (using TEXT for simplicity, could use JSON type if supported)
  // Using a single row with a fixed ID for simplicity
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row
      config TEXT NOT NULL
    );
  `);

  // Initialize settings if the table is empty
  const settingsRow = await db.get('SELECT config FROM settings WHERE id = 1');
  if (!settingsRow) {
    await db.run('INSERT INTO settings (id, config) VALUES (?, ?)', 1, JSON.stringify(DEFAULT_SETTINGS));
    console.log('Initialized default settings in the database.');
  }

  // Create request_logs table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      _id TEXT PRIMARY KEY,
      apiKeyId TEXT NOT NULL,
      timestamp TEXT NOT NULL, -- ISO 8601 format string
      modelUsed TEXT,
      responseTime INTEGER, -- Milliseconds
      statusCode INTEGER NOT NULL,
      isError BOOLEAN NOT NULL DEFAULT FALSE,
      errorType TEXT,
      errorMessage TEXT,
      ipAddress TEXT,
      FOREIGN KEY (apiKeyId) REFERENCES api_keys(_id) ON DELETE CASCADE -- Optional: Enforce FK and cascade deletes
    );
  `);

  // Create indexes for faster querying
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs (timestamp);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_apiKeyId ON request_logs (apiKeyId);`);


  console.log(`Database initialized successfully at ${DB_FILE}`);
  return db;
}

// Function to get the database instance (singleton pattern)
export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    try {
      dbInstance = await initializeDatabase();
    } catch (error) {
      logError(error, { context: 'getDb initialization' });
      console.error('Failed to initialize database:', error);
      // Depending on the desired behavior, you might want to exit the process
      // or handle this error more gracefully.
      process.exit(1); // Exit if DB connection fails critically
    }
  }
  return dbInstance;
}

// Export default settings if needed elsewhere
export { DEFAULT_SETTINGS };