import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUpRight, Images, Layers, Link2, Pencil, Quote } from 'lucide-react';
import { db } from '../../db/database';
import type { ID, Phase, ResearchDocument } from '../../types';
import type { SearchSelection } from '../search/SearchPalette';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { DOCUMENT_KIND_META, formatLabel } from '../../lib/documents';
import { formatDate, phaseNumber } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { Button } from '../ui/Button';

interface DocumentInfoPanelProps {
  document: ResearchDocument;
  phases: Phase[];
  onNavigate: (selection: SearchSelection) => void;
  onEdit: () => void;
}

const INDEX_LABEL: Record<ResearchDocument['textStatus'], string> = {
  pending: 'Reading text for search…',
  indexed: 'Text is searchable',
  none: 'No searchable text',
  failed: 'Text could not be read',
};

/** Metadata and connections of the open document; each connection jumps to its item. */
export function DocumentInfoPanel({ document: doc, phases, onNavigate, onEdit }: DocumentInfoPanelProps) {
  const linked = useLiveQuery(async () => {
    const [cards, extracts, snapshots] = await Promise.all([
      db.cards.bulkGet(doc.cardIds),
      db.extracts.bulkGet(doc.extractIds),
      db.snapshots.bulkGet(doc.snapshotIds),
    ]);
    return { cards: cards.filter((c) => !!c), extracts: extracts.filter((e) => !!e), snapshots: snapshots.filter((s) => !!s) };
  }, [doc.cardIds.join(), doc.extractIds.join(), doc.snapshotIds.join()]);

  const phaseIndex = (id: ID) => phases.findIndex((p) => p.id === id);
  const phaseLabel = (id: ID) => {
    const i = phaseIndex(id);
    return i >= 0 ? `${phaseNumber(i)} · ${phases[i].title}` : 'Deleted phase';
  };
  const meta = DOCUMENT_KIND_META[doc.kind];
  const relatedPhases = doc.linkedPhaseIds.filter((id) => phaseIndex(id) >= 0);
  const connectionCount = relatedPhases.length + (linked ? linked.cards.length + linked.extracts.length + linked.snapshots.length : 0);

  return (
    <div className="space-y-5 px-5 py-5 text-sm">
      <div>
        <h3 className="font-display text-xl leading-snug break-words text-ink">{doc.title || doc.fileName}</h3>
        {doc.description ? (
          <p className="mt-2 leading-relaxed whitespace-pre-wrap text-ink-2">{doc.description}</p>
        ) : (
          <button type="button" onClick={onEdit} className="mt-1.5 text-[13px] text-muted hover:text-gold">
            Add a description…
          </button>
        )}
      </div>

      <dl className="space-y-2 border-t border-line pt-4 text-[13px]">
        <Meta label="Filed in">
          {doc.phaseId ? (
            <button type="button" className="truncate text-right text-ink hover:text-gold" onClick={() => onNavigate({ phaseId: doc.phaseId!, itemId: null, kind: 'phase' })}>
              {phaseLabel(doc.phaseId)}
            </button>
          ) : (
            <span className="text-muted">Unfiled</span>
          )}
        </Meta>
        <Meta label="File">
          <span className="truncate" title={doc.fileName}>
            {doc.fileName}
          </span>
        </Meta>
        <Meta label="Type">
          {formatLabel(doc.fileName, doc.kind)}
        </Meta>
        <Meta label="Size">{formatBytes(doc.size)}</Meta>
        {doc.pageCount ? <Meta label="Pages">{doc.pageCount}</Meta> : null}
        <Meta label="Uploaded">{formatDate(doc.createdAt)}</Meta>
        {doc.updatedAt - doc.createdAt > 60_000 && <Meta label="Edited">{formatDate(doc.updatedAt)}</Meta>}
        {meta.indexable && <Meta label="Search">{INDEX_LABEL[doc.textStatus]}</Meta>}
      </dl>

      {doc.tags.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-[10.5px] font-semibold tracking-wider text-faint uppercase">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {doc.tags.map((t) => (
              <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-faint uppercase">
            <Link2 className="size-3.5" /> Connections {connectionCount > 0 && <span className="font-normal">· {connectionCount}</span>}
          </p>
          <button type="button" onClick={onEdit} className="text-xs text-muted hover:text-gold">
            Edit
          </button>
        </div>
        {connectionCount === 0 ? (
          <p className="text-[13px] leading-relaxed text-muted">
            Not connected yet. Link this document to the knowledge cards, extracts, snapshots or other phases it supports.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {relatedPhases.map((id) => (
              <ConnectionRow key={id} icon={<span className="text-[10px] font-semibold text-gold tabular">{phaseNumber(phaseIndex(id))}</span>} label={phases[phaseIndex(id)].title} hint="Phase" onClick={() => onNavigate({ phaseId: id, itemId: null, kind: 'phase' })} />
            ))}
            {linked?.cards.map((c) => {
              const Icon = CARD_TYPE_META[c.type].icon;
              return (
                <ConnectionRow
                  key={c.id}
                  icon={<Icon className={`size-3.5 ${CARD_TYPE_META[c.type].text}`} />}
                  label={c.title || 'Untitled card'}
                  hint={phaseLabel(c.phaseId)}
                  onClick={() => onNavigate({ phaseId: c.phaseId, itemId: c.id, kind: 'card' })}
                />
              );
            })}
            {linked?.extracts.map((e) => (
              <ConnectionRow
                key={e.id}
                icon={<Quote className="size-3.5 text-type-source" />}
                label={e.title || e.text.slice(0, 80)}
                hint={phaseLabel(e.phaseId)}
                onClick={() => onNavigate({ phaseId: e.phaseId, itemId: e.id, kind: 'extract' })}
              />
            ))}
            {linked?.snapshots.map((s) => (
              <ConnectionRow
                key={s.id}
                icon={<Images className="size-3.5 text-muted" />}
                label={s.title || 'Untitled snapshot'}
                hint={phaseLabel(s.phaseId)}
                onClick={() => onNavigate({ phaseId: s.phaseId, itemId: s.id, kind: 'snapshot' })}
              />
            ))}
          </ul>
        )}
      </div>

      <Button size="sm" className="w-full" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
        Edit details & connections
      </Button>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
        <Layers className="mt-0.5 size-3.5 shrink-0" />
        Stored in this browser only. Deleting browser data for this site removes it.
      </p>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex min-w-0 justify-end text-right text-ink tabular">{children}</dd>
    </div>
  );
}

function ConnectionRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
        <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink">{label}</span>
          <span className="block truncate text-[11px] text-faint">{hint}</span>
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  );
}
