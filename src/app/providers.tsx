'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemeProviderProps } from 'next-themes';
import { useEffect, useState } from 'react';

export function Providers({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Force immediate application of theme class on component mount
  useEffect(() => {
    setMounted(true);

    // Apply theme from local storage immediately to prevent flicker
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      applyDarkGradient();
    } else if (storedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      applyLightGradient();
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        document.documentElement.classList.add('dark');
        applyDarkGradient();
      } else {
        document.documentElement.classList.remove('dark');
        applyLightGradient();
      }
    }

    // Set up a MutationObserver to detect class changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const htmlElement = document.documentElement;
          if (htmlElement.classList.contains('dark')) {
            applyDarkGradient();
          } else {
            applyLightGradient();
          }
        }
      });
    });

    // Start observing the document with the configured parameters
    observer.observe(document.documentElement, { attributes: true });

    // Clean up observer
    return () => {
      observer.disconnect();
    };
  }, []);

  // Helper functions to apply gradients
  function applyDarkGradient() {
    document.body.style.background = 'linear-gradient(135deg, hsl(220 15% 18%), hsl(220 20% 14%), hsl(220 25% 10%))';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundSize = 'cover';
  }

  function applyLightGradient() {
    document.body.style.background = 'linear-gradient(135deg, hsl(210 50% 98%), hsl(240 50% 95%), hsl(220 40% 92%))';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundSize = 'cover';
  }

  // Pass down any additional props to the provider
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false} // Enable smooth transitions
      {...props} // Spread remaining props
    >
      {children}
    </NextThemesProvider>
  );
}