import {
  FlaskConical,
  Lightbulb,
  Quote,
  Sigma,
  Signpost,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { CardType } from '../types';

export interface CardTypeMeta {
  label: string;
  icon: LucideIcon;
  /** Text colour for icon and label. */
  text: string;
  /** Left accent bar. */
  bar: string;
  /** Soft tinted background for chips. */
  soft: string;
}

// Full class strings (not built dynamically) so Tailwind can detect them.
export const CARD_TYPE_META: Record<CardType, CardTypeMeta> = {
  concept: { label: 'Concept', icon: Lightbulb, text: 'text-type-concept', bar: 'bg-type-concept', soft: 'bg-type-concept/10' },
  formula: { label: 'Formula', icon: Sigma, text: 'text-type-formula', bar: 'bg-type-formula', soft: 'bg-type-formula/10' },
  assumption: { label: 'Assumption', icon: SlidersHorizontal, text: 'text-type-assumption', bar: 'bg-type-assumption', soft: 'bg-type-assumption/10' },
  important: { label: 'Important Point', icon: Star, text: 'text-type-important', bar: 'bg-type-important', soft: 'bg-type-important/10' },
  warning: { label: 'Warning', icon: TriangleAlert, text: 'text-type-warning', bar: 'bg-type-warning', soft: 'bg-type-warning/10' },
  example: { label: 'Example', icon: FlaskConical, text: 'text-type-example', bar: 'bg-type-example', soft: 'bg-type-example/10' },
  decision: { label: 'Decision', icon: Signpost, text: 'text-type-decision', bar: 'bg-type-decision', soft: 'bg-type-decision/10' },
  source: { label: 'Source Extract', icon: Quote, text: 'text-type-source', bar: 'bg-type-source', soft: 'bg-type-source/10' },
};
