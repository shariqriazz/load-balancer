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
                  
                  // Check localStorage
                  const storedTheme = localStorage.getItem('theme');
                  if (storedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                    // Apply dark gradient immediately
                    document.body.style.background = 'linear-gradient(135deg, hsl(220 15% 18%), hsl(220 20% 14%), hsl(220 25% 10%))';
                    document.body.style.backgroundAttachment = 'fixed';
                    document.body.style.backgroundSize = 'cover';
                  } else if (storedTheme === 'light') {
                    document.documentElement.classList.remove('dark');
                    // Apply light gradient immediately
                    document.body.style.background = 'linear-gradient(135deg, hsl(210 50% 98%), hsl(240 50% 95%), hsl(220 40% 92%))';
                    document.body.style.backgroundAttachment = 'fixed';
                    document.body.style.backgroundSize = 'cover';
                  } else {
                    // Check system preference
                    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (systemPrefersDark) {
                      document.documentElement.classList.add('dark');
                      // Apply dark gradient immediately
                      document.body.style.background = 'linear-gradient(135deg, hsl(220 15% 18%), hsl(220 20% 14%), hsl(220 25% 10%))';
                      document.body.style.backgroundAttachment = 'fixed';
                      document.body.style.backgroundSize = 'cover';
                    } else {
                      document.documentElement.classList.remove('dark');
                      // Apply light gradient immediately
                      document.body.style.background = 'linear-gradient(135deg, hsl(210 50% 98%), hsl(240 50% 95%), hsl(220 40% 92%))';
                      document.body.style.backgroundAttachment = 'fixed';
                      document.body.style.backgroundSize = 'cover';
                    }
                  }
                } catch (e) {
                  console.error('Error applying theme:', e);
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