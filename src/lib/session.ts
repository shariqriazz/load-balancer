import { SessionOptions } from 'iron-session';
import { createHash, pbkdf2Sync } from 'crypto';
import { ENV_CONFIG } from './env-validation';

// Define the structure of your session data
export interface SessionData {
  isLoggedIn?: boolean; // Make it optional as it might not exist initially
  loginTime?: number; // Track when user logged in
  passwordHash?: string; // Hash of password used for this session
}

// Use validated ADMIN_PASSWORD for session encryption
const adminPassword = ENV_CONFIG.ADMIN_PASSWORD;

// Derive a proper encryption key from the admin password
const salt = 'load-balancer-session-salt'; // In production, use a random salt stored securely
const sessionEncryptionPassword = pbkdf2Sync(adminPassword, salt, 100000, 32, 'sha256').toString('hex');

// Create a hash of the admin password for session validation
export const getPasswordHash = () => {
  return createHash('sha256').update(adminPassword).digest('hex');
};

export const sessionOptions: SessionOptions = {
  password: sessionEncryptionPassword,
  cookieName: 'lb-admin-session', // Changed cookie name for clarity
  // secure: true should be used in production (HTTPS)
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    httpOnly: true,
    sameSite: 'lax',
  },
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