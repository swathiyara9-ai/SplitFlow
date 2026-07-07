'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
];

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (code: CurrencyCode) => void;
  format: (value: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('USD');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('splitflow-currency') as CurrencyCode;
    if (saved && CURRENCIES.some((c) => c.code === saved)) {
      setCurrencyCode(saved);
    }
    setMounted(true);
  }, []);

  const activeCurrency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];

  const handleSetCurrency = (code: CurrencyCode) => {
    setCurrencyCode(code);
    localStorage.setItem('splitflow-currency', code);
  };

  const format = (value: number) => {
    // If not mounted yet (server-side render or hydration mismatch prevention), default to USD symbol
    const symbol = mounted ? activeCurrency.symbol : '$';
    return `${symbol}${Number(value || 0).toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency: activeCurrency, setCurrency: handleSetCurrency, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
