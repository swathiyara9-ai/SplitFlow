import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'SplitFlow — Premium Expense Sharing Architecture',
  description: 'Simplify group balances and track shared expenses with a premium, minimal, and secure ledger designed for modern fintech flows.',
  keywords: ['splitwise alternative', 'expense sharing', 'group bills', 'supabse splitwise', 'splitflow'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <ThemeProvider defaultTheme="system" storageKey="splitflow-theme">
            {children}
            <Toaster />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
