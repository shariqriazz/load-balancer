import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Load Balancer',
  description: 'A proxy server for the OpenAI Compatible API with key management and load balancing',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full min-h-full">
      <head>
        {/* Inline script to apply theme immediately, before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Apply a base style to prevent flash
                  document.documentElement.style.colorScheme = 'dark light';
                  
                  // Set initial theme class only, let providers handle the rest
                  const storedTheme = localStorage.getItem('theme');
                  if (storedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else if (storedTheme === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (systemPrefersDark) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  }
                } catch (e) {
                  console.error('Error applying initial theme:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} h-full min-h-full bg-gradient-to-br`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}