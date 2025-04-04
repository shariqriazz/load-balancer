/**
 * Sanitizes request and response data to remove sensitive information
 * before logging.
 */
export const sanitizeRequest = (request: any) => {
  const sanitized = { ...request };
  
  // Redact Authorization header
  if (sanitized.headers?.Authorization) {
    sanitized.headers.Authorization = 'REDACTED';
  }
  
  // Redact any apiKey in body
  if (sanitized.body?.apiKey) {
    sanitized.body.apiKey = 'REDACTED';
  }
  
  // Redact API key in URL
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = sanitized.url.replace(/([?&]key=)[^&]+/g, '$1REDACTED');
  }
  
  // Redact any key in body
  if (sanitized.body?.key) {
    sanitized.body.key = 'REDACTED';
  }
  
  return sanitized;
};

/**
 * Masks an API key for display, showing only the first few and last few characters
 */
const maskApiKey = (key: string): string => {
  if (!key || key.length < 10) return 'INVALID_KEY';
  
  const firstPart = key.substring(0, 6);
  const lastPart = key.substring(key.length - 4);
  
  return `${firstPart}...${lastPart}`;
};