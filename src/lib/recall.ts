import type { ReviewResult, RevisionCard, RevisionSchedule } from '../types';

/**
 * Spaced repetition, kept deliberately simple (a Leitner ladder):
 * - Remembered moves a card one step up the ladder, so the gap grows:
 *   1 → 3 → 7 → 14 → 30 → 60 → 120 days.
 * - Needs revision sends it back to the bottom and brings it back later today.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Days until the next review after a Remembered on each step. */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;

/** A card marked Needs revision returns after this delay. */
export const RELEARN_DELAY_MS = 10 * MINUTE;

/** From this step up (14+ days) a card counts as well known. */
export const MASTERED_LEVEL = 3;

export function nextSchedule(card: RevisionSchedule, result: ReviewResult, at = Date.now()): RevisionSchedule {
  const reviewCount = card.reviewCount + 1;
  if (result === 'needs-revision') {
    return { status: 'needs-revision', level: 0, reviewCount, lapses: card.lapses + 1, lastReviewedAt: at, dueAt: at + RELEARN_DELAY_MS };
  }
  // A card's first Remembered (or the first after a lapse) uses the bottom step.
  const level = card.status === 'remembered' ? Math.min(card.level + 1, INTERVAL_DAYS.length - 1) : 0;
  return { status: 'remembered', level, reviewCount, lapses: card.lapses, lastReviewedAt: at, dueAt: at + INTERVAL_DAYS[level] * DAY };
}

export const scheduleOf = (card: RevisionCard): RevisionSchedule => ({
  status: card.status,
  level: card.level,
  reviewCount: card.reviewCount,
  lapses: card.lapses,
  lastReviewedAt: card.lastReviewedAt,
  dueAt: card.dueAt,
});

/** New cards are always due; the rest once their date has passed. */
export const isDue = (card: Pick<RevisionCard, 'dueAt' | 'status'>, at = Date.now()) => card.status === 'new' || card.dueAt <= at;

/** "now", "in 10 min", "in 3 days", "tomorrow" or "2 days ago" style label. */
export function relativeDue(dueAt: number, at = Date.now()): string {
  const diff = dueAt - at;
  if (Math.abs(diff) < MINUTE) return 'now';
  const future = diff > 0;
  const abs = Math.abs(diff);
  let label: string;
  if (abs < 60 * MINUTE) label = `${Math.round(abs / MINUTE)} min`;
  else if (Math.round(abs / (60 * MINUTE)) < 24) label = `${Math.round(abs / (60 * MINUTE))} h`;
  else {
    const days = Math.round(abs / DAY);
    if (days === 1) return future ? 'tomorrow' : 'yesterday';
    label = days < 60 ? `${days} days` : `${Math.round(days / 30)} months`;
  }
  return future ? `in ${label}` : `${label} ago`;
}

/** Short label for the gap a result would create ("10 min", "3 days"). */
export function intervalLabel(card: RevisionSchedule, result: ReviewResult): string {
  const gap = nextSchedule(card, result, 0).dueAt;
  if (gap < DAY) return `${Math.round(gap / MINUTE)} min`;
  const days = Math.round(gap / DAY);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
