import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

// Define the RequestLog interface (matches the table schema)
export interface RequestLogData {
  _id: string;
  apiKeyId: string; // Foreign key to ApiKey._id
  timestamp: string; // ISO 8601 format string
  modelUsed?: string | null;
  responseTime?: number | null; // Milliseconds
  statusCode: number; // HTTP status code returned to client
  isError: boolean;
  errorType?: string | null; // e.g., 'ApiKeyError', 'UpstreamError', 'InternalError'
  errorMessage?: string | null;
  ipAddress?: string | null;
}

// Helper to convert DB result (0/1) to boolean
function dbToBoolean(value: any): boolean {
  return value === 1;
}

// Helper to convert boolean to DB value (0/1)
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}

export class RequestLog implements RequestLogData {
  _id: string;
  apiKeyId: string;
  timestamp: string;
  modelUsed?: string | null;
  responseTime?: number | null;
  statusCode: number;
  isError: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
  ipAddress?: string | null;

  constructor(data: RequestLogData) {
    this._id = data._id;
    this.apiKeyId = data.apiKeyId;
    this.timestamp = data.timestamp;
    this.modelUsed = data.modelUsed;
    this.responseTime = data.responseTime;
    this.statusCode = data.statusCode;
    this.isError = data.isError; // Booleans handled directly
    this.errorType = data.errorType;
    this.errorMessage = data.errorMessage;
    this.ipAddress = data.ipAddress;
  }

  // Static method to create a new log entry
  static async create(data: Omit<RequestLogData, '_id' | 'timestamp'>): Promise<RequestLog> {
    const db = await getDb();
    const newId = uuidv4();
    const timestamp = new Date().toISOString();

    const logData: RequestLogData = {
      _id: newId,
      apiKeyId: data.apiKeyId,
      timestamp: timestamp,
      modelUsed: data.modelUsed === undefined ? null : data.modelUsed,
      responseTime: data.responseTime === undefined ? null : data.responseTime,
      statusCode: data.statusCode,
      isError: data.isError ?? false,
      errorType: data.errorType === undefined ? null : data.errorType,
      errorMessage: data.errorMessage === undefined ? null : data.errorMessage,
      ipAddress: data.ipAddress === undefined ? null : data.ipAddress,
    };

    await db.run(
      `INSERT INTO request_logs (_id, apiKeyId, timestamp, modelUsed, responseTime, statusCode, isError, errorType, errorMessage, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      logData._id,
      logData.apiKeyId,
      logData.timestamp,
      logData.modelUsed,
      logData.responseTime,
      logData.statusCode,
      booleanToDb(logData.isError),
      logData.errorType,
      logData.errorMessage,
      logData.ipAddress
    );

    // We need to fetch the created record to get default values if any were applied by DB
    // For simplicity here, we return an instance with the data we inserted.
    // A more robust implementation might fetch the record by _id.
    return new RequestLog(logData);
  }

  // Add static methods for querying (e.g., findByTimeRange) later as needed
}