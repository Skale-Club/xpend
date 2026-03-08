'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'xpend.hideSensitiveValues';

interface SensitiveValuesContextValue {
  hideSensitiveValues: boolean;
  setHideSensitiveValues: (hide: boolean) => void;
  toggleSensitiveValues: () => void;
}

const SensitiveValuesContext = createContext<SensitiveValuesContextValue | null>(null);

export function SensitiveValuesProvider({ children }: { children: React.ReactNode }) {
  const [hideSensitiveValues, setHideSensitiveValues] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.).
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, hideSensitiveValues ? '1' : '0');
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.).
    }
  }, [hideSensitiveValues]);

  const value = useMemo<SensitiveValuesContextValue>(
    () => ({
      hideSensitiveValues,
      setHideSensitiveValues,
      toggleSensitiveValues: () => setHideSensitiveValues((previous) => !previous),
    }),
    [hideSensitiveValues]
  );

  return <SensitiveValuesContext.Provider value={value}>{children}</SensitiveValuesContext.Provider>;
}

export function useSensitiveValues() {
  const context = useContext(SensitiveValuesContext);
  if (!context) {
    throw new Error('useSensitiveValues must be used within SensitiveValuesProvider');
  }
  return context;
}
