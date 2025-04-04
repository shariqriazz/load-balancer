import { SessionOptions } from 'iron-session';

// Define the structure of your session data
export interface SessionData {
  isLoggedIn?: boolean; // Make it optional as it might not exist initially
}

// Use ADMIN_PASSWORD for session encryption as requested
// Ensure ADMIN_PASSWORD is set in your .env file
const sessionEncryptionPassword = process.env.ADMIN_PASSWORD;

if (!sessionEncryptionPassword) {
  // Throw an error during build or server start if ADMIN_PASSWORD is not set
  throw new Error('ADMIN_PASSWORD environment variable is not set. This is required for session encryption and login.');
}

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
  }
}