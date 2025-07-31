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
  rateLimitCooldown: number; // seconds
  logRetentionDays: number;
  maxRetries: number;
  endpoint: string; // Add the endpoint field
  failoverDelay: number; // seconds - Delay before switching API on rate limited (0 for immediate)
  loadBalancingStrategy: 'round-robin' | 'random' | 'least-connections'; // Added
  requestRateLimit: number; // Added: requests per minute, 0 for no limit
}

// Define DEFAULT_SETTINGS with Gemini endpoint only
export const DEFAULT_SETTINGS: Settings = {
  keyRotationRequestCount: 10,
  maxFailureCount: 3,
  rateLimitCooldown: 60, // 60 seconds
  logRetentionDays: 30,
  maxRetries: 3,
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', // Google Gemini endpoint
  failoverDelay: 2, // 2 seconds default delay before switching API on rate limited
  loadBalancingStrategy: 'round-robin', // Added
  requestRateLimit: 0, // Added: 0 means no limit by default
};

let dbInstance: Database | null = null;
let isShuttingDown = false;

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

// Graceful shutdown handler
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('Shutting down database connection...');
  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      console.log('Database connection closed successfully');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

// Track if we've already registered shutdown handlers
let shutdownHandlersRegistered = false;

// Register shutdown handlers only once
function registerShutdownHandlers() {
  if (shutdownHandlersRegistered || typeof process === 'undefined') return;
  
  shutdownHandlersRegistered = true;
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
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
      profile TEXT, -- Profile name for key grouping
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

  // Create profiles table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      name TEXT PRIMARY KEY,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'key',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize default profile if none exists
  const defaultProfile = await db.get('SELECT name FROM profiles WHERE name = ?', 'default');
  if (!defaultProfile) {
    await db.run(
      'INSERT INTO profiles (name, description, color, icon) VALUES (?, ?, ?, ?)',
      'default',
      'Default profile for unassigned API keys',
      '#6366f1',
      'key'
    );
    console.log('Initialized default profile in the database.');
  }

  // Create indexes for faster querying
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs (timestamp);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_apiKeyId ON request_logs (apiKeyId);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_error ON request_logs (isError);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs (statusCode);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (isActive);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_profile ON api_keys (profile);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_rate_limit ON api_keys (isDisabledByRateLimit);`);


  console.log(`Database initialized successfully at ${DB_FILE}`);
  return db;
}

// Function to get the database instance (singleton pattern)
export async function getDb(): Promise<Database> {
  if (isShuttingDown) {
    throw new Error('Database is shutting down');
  }
  
  if (!dbInstance) {
    try {
      // Register shutdown handlers when first initializing database
      registerShutdownHandlers();
      dbInstance = await initializeDatabase();
    } catch (error) {
      logError(error, { context: 'getDb initialization' });
      console.error('Failed to initialize database:', error);
      // Don't exit process in production, throw error instead
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return dbInstance;
}

// Function to safely close database connection
async function closeDb(): Promise<void> {
  await gracefulShutdown();
}

// Remove this duplicate export at the end of the file
// export { DEFAULT_SETTINGS };