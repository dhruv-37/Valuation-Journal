import { Eye, GraduationCap, MessageSquareText, Pilcrow, Quote, Sigma, type LucideIcon } from 'lucide-react';
import type { ExtractKind } from '../types';

export interface ExtractKindMeta {
  label: string;
  icon: LucideIcon;
  text: string;
  soft: string;
  bar: string;
  /** How the body text is set: quoted passages in the serif, formulas in mono. */
  style: 'quote' | 'mono' | 'prose';
}

// Reuses the card-type palette so the two collections feel related.
export const EXTRACT_KIND_META: Record<ExtractKind, ExtractKindMeta> = {
  sentence: { label: 'Key sentence', icon: Quote, text: 'text-type-source', soft: 'bg-type-source/10', bar: 'bg-type-source', style: 'quote' },
  paragraph: { label: 'Paragraph', icon: Pilcrow, text: 'text-type-concept', soft: 'bg-type-concept/10', bar: 'bg-type-concept', style: 'quote' },
  observation: { label: 'Modelling observation', icon: Eye, text: 'text-type-assumption', soft: 'bg-type-assumption/10', bar: 'bg-type-assumption', style: 'prose' },
  formula: { label: 'Formula', icon: Sigma, text: 'text-type-formula', soft: 'bg-type-formula/10', bar: 'bg-type-formula', style: 'mono' },
  explanation: { label: 'Explanation', icon: MessageSquareText, text: 'text-type-decision', soft: 'bg-type-decision/10', bar: 'bg-type-decision', style: 'prose' },
  lesson: { label: 'Lesson learned', icon: GraduationCap, text: 'text-type-important', soft: 'bg-type-important/10', bar: 'bg-type-important', style: 'prose' },
};
