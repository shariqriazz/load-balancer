'use client';

import { createContext } from 'react';

type ThemeContextType = {
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
};

// Create a context with default values
export const ThemeContext = createContext<ThemeContextType>({
  colorMode: 'light',
  toggleColorMode: () => {},
});