import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { sanitizeRequest } from '../utils/sanitize';
import { mkdir, readdir, readFile, stat } from 'fs/promises';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
async function ensureLogsDir() {
  try {
    await mkdir(logsDir, { recursive: true });
  } catch (error) {
    // Directory already exists or other error
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating logs directory:', error);
    }
  }
}

// Call this function immediately
ensureLogsDir().catch(console.error);

// Configure transport for requests
const requestTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'requests-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Configure transport for errors
const errorTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'errors-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Configure transport for key management
const keyTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'keys-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create loggers
export const requestLogger = winston.createLogger({
  transports: [
    requestTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const errorLogger = winston.createLogger({
  transports: [
    errorTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const keyLogger = winston.createLogger({
  transports: [
    keyTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper function to log streaming chunks
const logStreamChunk = (requestId: string, chunk: Buffer) => {
  try {
    const data = chunk.toString();
    requestLogger.info('Stream Chunk', {
      requestId,
      data: data.trim()
    });
  } catch (error) {
    logError(error, { context: 'Stream chunk logging', requestId });
  }
};

// Helper function to log key management events
export const logKeyEvent = (event: string, details: any) => {
  keyLogger.info(event, details);
};

// Helper function to log errors
export const logError = (error: any, context: any = {}) => {
  errorLogger.error(error.message || 'Unknown error', {
    stack: error.stack,
    ...context
  });
};

// Function to get logs
export const getLogs = async (type: 'requests' | 'errors' | 'keys', options: {
  limit?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  search?: string;
} = {}) => {
  const { limit = 1000, startDate: startDateStr, endDate: endDateStr, search } = options; // Increase default limit, rename date strings
  const logPrefix = `${type}-`;
  const logEntries: any[] = [];

  try {
    const files = await readdir(logsDir);

    // --- Enhanced Date Filtering ---
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (startDateStr) {
      // Assume startDateStr is local day start, convert to UTC start
      startDateTime = new Date(startDateStr + 'T00:00:00'); // Adjust based on server's local timezone interpretation
      // Consider potential timezone offset if server != user timezone
    }
    if (endDateStr) {
      // Assume endDateStr is local day end, convert to UTC end
      endDateTime = new Date(endDateStr + 'T23:59:59.999'); // Adjust based on server's local timezone interpretation
      // Consider potential timezone offset
    }

    // Filter files whose date range *could* overlap with the desired time range
    const logFiles = files
      .filter(file => file.startsWith(logPrefix) && file.endsWith('.log'))
      .map(file => {
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})\.log$/);
        // Get the date the file *covers* (UTC day)
        const fileUtcDate = dateMatch ? new Date(dateMatch[1] + 'T00:00:00Z') : null;
        return { name: file, fileUtcDateStr: dateMatch ? dateMatch[1] : null, fileUtcDate };
      })
      .filter(file => {
        if (!file.fileUtcDate) return false;
        // Include file if its UTC day might contain relevant timestamps
        // File covering UTC day X might have logs from local day X or X+1 depending on timezone
        // A simpler approach: include today's and yesterday's file if filtering by a single day.
        // More robust: Check if file's UTC day range overlaps query's UTC time range.
        // For now, let's include files whose date string matches or is one day before endDateStr
        // This is an approximation and might fetch slightly too much, but timestamp filtering will fix it.
        if (startDateStr && endDateStr && startDateStr === endDateStr) {
           const queryDate = startDateStr;
           const fileDate = file.fileUtcDateStr;
           if (!fileDate) return false;
           // Get yesterday's date string
           const yesterday = new Date(queryDate);
           yesterday.setDate(yesterday.getDate() - 1);
           const yesterdayStr = yesterday.toISOString().split('T')[0];
           return fileDate === queryDate || fileDate === yesterdayStr;
        }
        // Basic range check for multi-day queries (can be refined)
        if (startDateTime && file.fileUtcDate < new Date(startDateTime.getTime() - 24*60*60*1000)) return false; // Don't check files too old
        if (endDateTime && file.fileUtcDate > endDateTime) return false; // Don't check files too new
        return true;
      })
      .sort((a, b) => b.fileUtcDate!.getTime() - a.fileUtcDate!.getTime()); // Sort newest file first

    // Read files and collect log entries
    for (const fileInfo of logFiles) {
      if (logEntries.length >= limit) break;

      const filePath = path.join(logsDir, fileInfo.name);
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        // Read lines in reverse (newest first)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (logEntries.length >= limit) break;
          const line = lines[i];
          if (!line) continue;

          try {
            const logEntry = JSON.parse(line);

            // --- Timestamp Filtering ---
            const logTimestamp = new Date(logEntry.timestamp);
            if (startDateTime && logTimestamp < startDateTime) {
              continue; // Skip logs before the start date/time
            }
            if (endDateTime && logTimestamp > endDateTime) {
              continue; // Skip logs after the end date/time
            }
            // --- End Timestamp Filtering ---

            // Apply search filter (if any)
            if (search) {
              const searchableString = JSON.stringify(logEntry).toLowerCase();
              if (!searchableString.includes(search.toLowerCase())) {
                continue;
              }
            }

            logEntries.unshift(logEntry); // Add to beginning to maintain order (newest first in results)
          } catch (parseError) {
            // Ignore lines that are not valid JSON
            console.warn(`Skipping invalid log line in ${fileInfo.name}: ${line}`);
          }
        }
      } catch (readError) {
        console.error(`Error reading log file ${fileInfo.name}:`, readError);
      }
    }

    // Return the collected logs (up to the limit)
    // Note: 'total' here is just the count returned, not the total matching logs across all files.
    // A more robust solution might involve pagination or streaming.
    return {
      logs: logEntries,
      total: logEntries.length
    };

  } catch (error) {
    console.error('Error accessing logs directory:', error);
    logError(error, { context: 'getLogs function' });
    return {
      logs: [],
      total: 0
    };
  }
};