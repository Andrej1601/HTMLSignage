import { useCallback, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'htmlsignage-theme-mode';

function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemPreference() : mode;
}

function applyThemeClass(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'light';
}

/**
 * Manages light/dark/system theme mode with localStorage persistence.
 * Applies `.dark` class on `<html>` for Tailwind dark mode.
 */
export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    resolveEffectiveTheme(readStoredMode()),
  );

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    const effective = resolveEffectiveTheme(newMode);
    setEffectiveTheme(effective);
    applyThemeClass(effective);
  }, []);

  // Apply on mount and listen for system preference changes
  useEffect(() => {
    applyThemeClass(resolveEffectiveTheme(mode));

    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const effective = resolveEffectiveTheme('system');
      setEffectiveTheme(effective);
      applyThemeClass(effective);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  return { mode, effectiveTheme, setMode };
}
