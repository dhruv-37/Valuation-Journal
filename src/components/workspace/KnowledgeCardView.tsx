import { ImagePlus, Paperclip, Pencil, Pin, PinOff, Trash } from 'lucide-react';
import type { KnowledgeCard, Snapshot } from '../../types';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { setCardPinned } from '../../db/repository';
import { IconButton } from '../ui/Button';
import { useLibrary } from '../library/LibraryContext';
import { SnapshotThumb } from '../library/SnapshotThumb';
import { useItemDocuments } from '../../hooks/useJournalData';
import { useDocumentActions } from '../documents/DocumentsContext';
import { DocumentChips } from '../documents/DocumentChips';
import { RecallToggle } from '../recall/RecallToggle';
import { RecallBadge } from '../recall/RecallBadge';

interface KnowledgeCardViewProps {
  card: KnowledgeCard;
  activeTag: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
  linkedSnapshots: Snapshot[];
}

const MAX_THUMBS = 4;

export function KnowledgeCardView({ card, activeTag, onEdit, onDelete, onTag, linkedSnapshots }: KnowledgeCardViewProps) {
  const meta = CARD_TYPE_META[card.type];
  const Icon = meta.icon;
  const library = useLibrary();
  const documentActions = useDocumentActions();
  const documents = useItemDocuments('card', card.id);

  return (
    <article
      data-item-id={card.id}
      className={`group relative overflow-hidden rounded-2xl border bg-surface shadow-card transition-[border-color,box-shadow] hover:shadow-lift ${
        card.pinned ? 'border-gold/45' : 'border-line hover:border-line-strong'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${meta.bar}`} aria-hidden="true" />
      <div className="py-4 pr-4 pl-6 sm:py-5 sm:pr-5 sm:pl-7">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${meta.text} ${meta.soft}`}>
              <Icon className="size-3.5" strokeWidth={2.2} />
              {meta.label}
            </span>
            {card.pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold">
                <Pin className="size-3 fill-current" /> Pinned
              </span>
            )}
            <RecallBadge sourceType="card" sourceId={card.id} />
          </div>
          <div className="reveal-on-hover -mt-1 -mr-1 flex items-center">
            <RecallToggle sourceType="card" sourceId={card.id} label={card.title || 'This card'} />
            <IconButton size="sm" label="Attach an image to this card" onClick={() => library.pickImages({ cardId: card.id })}>
              <ImagePlus className="size-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              label="Connect documents to this card"
              onClick={() => documentActions.linkTo({ kind: 'card', id: card.id, label: card.title, phaseId: card.phaseId })}
            >
              <Paperclip className="size-3.5" />
            </IconButton>
            <IconButton size="sm" label={card.pinned ? 'Unpin card' : 'Pin card'} active={card.pinned} onClick={() => setCardPinned(card.id, !card.pinned)}>
              {card.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </IconButton>
            <IconButton size="sm" label="Edit card" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton size="sm" label="Delete card" onClick={onDelete} className="hover:!text-type-warning">
              <Trash className="size-3.5" />
            </IconButton>
          </div>
        </header>

        {card.title && <h3 className="mt-3 text-[15.5px] leading-snug font-semibold text-ink">{card.title}</h3>}
        <CardContent card={card} />

        {linkedSnapshots.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Linked snapshots">
            {linkedSnapshots.slice(0, MAX_THUMBS).map((s, i) => {
              const overflow = i === MAX_THUMBS - 1 && linkedSnapshots.length > MAX_THUMBS ? linkedSnapshots.length - MAX_THUMBS + 1 : 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => library.openViewer(linkedSnapshots, s.id)}
                  title={s.title}
                  aria-label={`View linked snapshot: ${s.title || 'untitled'}`}
                  className="relative h-16 w-24 overflow-hidden rounded-lg border border-line bg-surface-2 transition-[border-color,transform] hover:-translate-y-px hover:border-gold/60"
                >
                  <SnapshotThumb snapshot={s} className="h-full w-full p-1" />
                  {overflow > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-medium text-canvas">+{overflow}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DocumentChips documents={documents} className="mt-4" />

        {(card.source || card.tags.length > 0) && (
          <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {card.source && <span className="text-xs text-muted italic">— {card.source}</span>}
            {card.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                title={`Filter by #${tag}`}
                className={`rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                  activeTag === tag ? 'bg-gold-soft text-gold' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                #{tag}
              </button>
            ))}
          </footer>
        )}
      </div>
    </article>
  );
}

function CardContent({ card }: { card: KnowledgeCard }) {
  if (!card.content) return null;
  if (card.type === 'formula') {
    return (
      <pre className="mt-3 overflow-x-auto rounded-xl border border-type-formula/20 bg-type-formula/[0.06] px-4 py-3.5 font-mono text-[13px] leading-[1.75] whitespace-pre-wrap text-ink">
        {card.content}
      </pre>
    );
  }
  if (card.type === 'source') {
    return (
      <blockquote className="mt-3 border-l-2 border-type-source/40 pl-4 font-display text-[16.5px] leading-relaxed text-ink-2 italic whitespace-pre-wrap">
        {card.content}
      </blockquote>
    );
  }
  if (card.type === 'example') {
    return <p className="mt-2.5 font-mono text-[13px] leading-[1.75] whitespace-pre-wrap text-ink-2">{card.content}</p>;
  }
  return <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink-2">{card.content}</p>;
}
