import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'vj-theme';
const listeners = new Set<() => void>();

const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toggle() {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: the theme still applies for this session */
  }
  listeners.forEach((l) => l());
}

/** Theme preference lives in localStorage (a UI setting, not journal data). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  return { theme, toggle };
}
