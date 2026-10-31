import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Plus, X } from 'lucide-react';
import { CARD_TYPES, type CardType, type ID, type KnowledgeCard, type Snapshot } from '../../types';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { deleteCard } from '../../db/repository';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmProvider';
import { KnowledgeCardView } from './KnowledgeCardView';
import { CardEditorDialog, type CardEditorState } from './CardEditorDialog';

interface JournalPanelProps {
  phaseId: ID;
  cards: KnowledgeCard[];
  /** Snapshots linked to any of these cards. */
  linkedSnapshots: Snapshot[];
  /** When search targets a card, filters are cleared so it is visible. */
  focusCardId: ID | null;
}

export function JournalPanel({ phaseId, cards, linkedSnapshots, focusCardId }: JournalPanelProps) {
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<CardEditorState>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (focusCardId) {
      setTypeFilter('all');
      setTagFilter(null);
    }
  }, [focusCardId]);

  const counts = new Map<CardType, number>();
  for (const c of cards) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  const presentTypes = CARD_TYPES.filter((t) => counts.has(t));
  // If the filtered type disappears (last card deleted), fall back to all.
  const activeType = typeFilter !== 'all' && !counts.has(typeFilter) ? 'all' : typeFilter;

  const visible = cards.filter((c) => (activeType === 'all' || c.type === activeType) && (!tagFilter || c.tags.includes(tagFilter)));

  const remove = async (card: KnowledgeCard) => {
    const ok = await confirm({
      title: 'Delete card?',
      message: (
        <>
          <strong className="font-medium text-ink">{card.title || 'This card'}</strong> will be permanently deleted.
        </>
      ),
      confirmLabel: 'Delete card',
      danger: true,
    });
    if (ok) await deleteCard(card.id);
  };

  return (
    <section aria-label="Knowledge journal">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Concepts, formulas and observations for this phase.</p>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="size-3.5" />}
          onClick={() => setEditor({ mode: 'create', type: activeType === 'all' ? undefined : activeType })}
        >
          New card
        </Button>
      </header>

      {cards.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter cards by type">
          <FilterChip label="All" count={cards.length} active={activeType === 'all'} onClick={() => setTypeFilter('all')} />
          {presentTypes.map((t) => (
            <FilterChip
              key={t}
              label={CARD_TYPE_META[t].label}
              count={counts.get(t)!}
              active={activeType === t}
              onClick={() => setTypeFilter(t)}
              dot={CARD_TYPE_META[t].bar}
            />
          ))}
          {tagFilter && (
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-medium text-gold"
            >
              #{tagFilter}
              <X className="size-3" aria-label="Clear tag filter" />
            </button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3.5">
        <AnimatePresence initial={false}>
          {visible.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <KnowledgeCardView
                card={card}
                activeTag={tagFilter}
                onEdit={() => setEditor({ mode: 'edit', card })}
                onDelete={() => remove(card)}
                onTag={(tag) => setTagFilter((current) => (current === tag ? null : tag))}
                linkedSnapshots={linkedSnapshots.filter((s) => s.cardIds.includes(card.id))}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {cards.length === 0 && (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold">
            <BookOpen className="size-5" />
          </span>
          <p className="mt-4 font-display text-lg text-ink">Nothing captured yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Save concepts, formulas, assumptions and observations as you work through this phase.</p>
          <Button className="mt-5" icon={<Plus className="size-4" />} onClick={() => setEditor({ mode: 'create' })}>
            Add the first card
          </Button>
        </div>
      )}
      {cards.length > 0 && visible.length === 0 && <p className="mt-6 text-sm text-muted">No cards match this filter.</p>}

      <CardEditorDialog phaseId={phaseId} state={editor} onClose={() => setEditor(null)} />
    </section>
  );
}

function FilterChip({ label, count, active, onClick, dot }: { label: string; count: number; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-ink text-canvas' : 'text-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
        {label}
        <span className={active ? 'opacity-70' : 'text-faint'}>{count}</span>
      </span>
    </button>
  );
}
