/**
 * Utility functions for retrying operations with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and temporary database issues
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'SQLITE_BUSY' ||
      error.code === 'SQLITE_LOCKED' ||
      (error.message && error.message.includes('database is locked'))
    );
  },
};

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or if the error shouldn't be retried
      if (attempt === opts.maxAttempts || !opts.retryCondition(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );

      console.warn(`Operation failed (attempt ${attempt}/${opts.maxAttempts}), retrying in ${delay}ms:`, error.message);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry database operations specifically
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    retryCondition: (error: any) => {
      return (
        error.code === 'SQLITE_BUSY' ||
        error.code === 'SQLITE_LOCKED' ||
        (error.message && (
          error.message.includes('database is locked') ||
          error.message.includes('database is busy')
        ))
      );
    },
  });
}