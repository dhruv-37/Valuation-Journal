export const phaseNumber = (index: number) => String(index + 1).padStart(2, '0');

export const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

export const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

export const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Adds https:// when a URL was typed without a scheme; returns undefined for blank input. */
export function normaliseUrl(input: string | undefined): string | undefined {
  const value = input?.trim();
  if (!value) return undefined;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

export const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);
