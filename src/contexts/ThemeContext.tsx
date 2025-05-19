'use client';

import { createContext } from 'react';

// This context is kept for backward compatibility
// New components should use next-themes directly
type ThemeContextType = {
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
};

// Create a context with default values
export const ThemeContext = createContext<ThemeContextType>({
  colorMode: 'light',
  toggleColorMode: () => {},
});