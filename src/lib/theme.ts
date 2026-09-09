import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'sepia';

const STORAGE_KEY = 'flowday_theme';
const THEME_CHANGE_EVENT = 'flowday-theme-change';

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'sepia' || stored === 'dark') {
      return stored;
    }
  } catch {}
  return 'dark';
}

export function applyTheme(theme: ThemeMode) {
  try {
    document.documentElement.setAttribute('data-theme', theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'sepia' ? '#f3e8ce' : '#121212');
    }
  } catch {}
}

export function setStoredTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
  } catch {}
}

// Initialize theme on script load
applyTheme(getStoredTheme());

export function useTheme(): [ThemeMode, (theme: ThemeMode) => void] {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeState(getStoredTheme());
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleThemeChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setStoredTheme(nextTheme);
  }, []);

  return [theme, setTheme];
}
