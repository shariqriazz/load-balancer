'use client';

import { ChakraProvider, extendTheme, useColorMode } from '@chakra-ui/react';
import { CacheProvider } from '@chakra-ui/next-js';
import { useState, useEffect } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

// Define the theme with light and dark mode
const theme = extendTheme({
  config: {
    initialColorMode: 'system',
    useSystemColorMode: false, // Set to false to allow manual control
  },
  styles: {
    global: (props: any) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      },
    }),
  },
});

// Inner component to access Chakra hooks
function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const { colorMode, toggleColorMode: toggleChakraColorMode } = useColorMode();
  const [mounted, setMounted] = useState(false);

  // Effect for handling theme changes
  useEffect(() => {
    setMounted(true);
  }, []);

  // Function to toggle theme
  const toggleColorMode = () => {
    toggleChakraColorMode(); // This will toggle Chakra's color mode
  };

  // Avoid rendering with wrong theme
  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ colorMode: colorMode as 'light' | 'dark', toggleColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Main provider component
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CacheProvider>
      <ChakraProvider theme={theme}>
        <ThemeContextProvider>
          {children}
        </ThemeContextProvider>
      </ChakraProvider>
    </CacheProvider>
  );
}