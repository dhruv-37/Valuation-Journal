import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` and whenever the tab regains
 * focus, so "due now" counts catch up without re-rendering on every tick.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}
