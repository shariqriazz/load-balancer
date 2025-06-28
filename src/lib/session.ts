import { SessionOptions } from 'iron-session';
import { ENV_CONFIG } from './env-validation';

// Define the structure of your session data
export interface SessionData {
  isLoggedIn?: boolean; // Make it optional as it might not exist initially
  loginTime?: number; // Track when user logged in
  passwordHash?: string; // Hash of password used for this session
}

// Use validated ADMIN_PASSWORD for session encryption
const adminPassword = ENV_CONFIG.ADMIN_PASSWORD;

// Simple session options that work in edge runtime
export const sessionOptions: SessionOptions = {
  password: adminPassword, // Use admin password directly for edge runtime compatibility
  cookieName: 'lb-admin-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    httpOnly: true,
    sameSite: 'lax',
  },
};

// Server-side crypto functions (only used in API routes, not middleware)
export const getPasswordHash = () => {
  if (typeof window !== 'undefined') {
    throw new Error('getPasswordHash should only be called server-side');
  }
  
  const { createHash } = require('crypto');
  return createHash('sha256').update(adminPassword).digest('hex');
};

// Augment the IronSessionData interface to include our SessionData structure
// This tells iron-session about the shape of our session data
declare module 'iron-session' {
  interface IronSessionData {
    // Allow any properties defined in SessionData to exist directly on the session object
    isLoggedIn?: SessionData['isLoggedIn'];
    loginTime?: SessionData['loginTime'];
    passwordHash?: SessionData['passwordHash'];
  }
}