import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme: Theme = 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, [theme]);

  const toggle = () => {};

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
