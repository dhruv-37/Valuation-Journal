import { useSyncExternalStore } from 'react';

/**
 * Minimal hash router: `#/` is the overview, `#/phase/<id>` a phase workspace,
 * `#/documents` the Document Library and `#/recall` the Recall dashboard.
 * Hash routing keeps browser back/forward working and survives refresh without
 * any server configuration.
 */

const ROUTE_EVENT = 'vj:route';

// The app manages scroll itself; the browser restoring scroll on "back" would move
// the overview under the closing workspace and misalign the shrink animation.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  window.addEventListener(ROUTE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(ROUTE_EVENT, callback);
  };
}

function getPhaseId(): string | null {
  const match = window.location.hash.match(/^#\/phase\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useRoutePhaseId() {
  return useSyncExternalStore(subscribe, getPhaseId);
}

export type PageRoute = 'overview' | 'documents' | 'recall';

const PAGE_HASH: Record<PageRoute, string> = { overview: '#/', documents: '#/documents', recall: '#/recall' };

/** The full-page view at the current route; null while a phase workspace is open. */
function getPage(): PageRoute | null {
  if (getPhaseId()) return null;
  const hash = window.location.hash;
  if (/^#\/documents\b/.test(hash)) return 'documents';
  if (/^#\/recall\b/.test(hash)) return 'recall';
  return 'overview';
}

export function useRoutePage() {
  return useSyncExternalStore(subscribe, getPage);
}

function go(hash: string, replace: boolean, state: unknown) {
  if (replace) history.replaceState(state, '', hash);
  else history.pushState(state, '', hash);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export const router = {
  openPhase(id: string) {
    go(`#/phase/${encodeURIComponent(id)}`, false, { fromOverview: true });
  },
  /** Switch phases inside the workspace without growing history. */
  switchPhase(id: string) {
    go(`#/phase/${encodeURIComponent(id)}`, true, history.state);
  },
  /** Closes the phase workspace, returning to the page beneath it (the overview unless told otherwise). */
  toOverview(fallback: PageRoute = 'overview') {
    // If we arrived from the previous page, step back so the back button stays natural.
    if ((history.state as { fromOverview?: boolean } | null)?.fromOverview) history.back();
    else go(PAGE_HASH[fallback], true, null);
  },
  /** Main navigation to the Document Library (from the overview or a phase). */
  toDocuments() {
    if (getPage() === 'documents') return;
    go('#/documents', false, { fromOverview: true });
  },
  /** Main navigation to the Recall dashboard. */
  toRecall() {
    if (getPage() === 'recall') return;
    go('#/recall', false, { fromOverview: true });
  },
  /** Main navigation from the Document Library to the pathway overview. */
  toPathway() {
    if (getPage() === 'overview') return;
    go('#/', false, null);
  },
};
