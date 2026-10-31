import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardPaste, ImagePlus, Images, Plus, Quote } from 'lucide-react';
import type { ID, KnowledgeExtract, Snapshot } from '../../types';
import { deleteExtract, deleteSnapshot } from '../../db/repository';
import { Button, Kbd } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmProvider';
import { useLibrary } from './LibraryContext';
import { SnapshotTile } from './SnapshotTile';
import { ExtractView } from './ExtractView';
import { LibraryFilters } from './LibraryFilters';
import { DEFAULT_FILTER, filterExtracts, filterSnapshots, isFiltered, showsExtracts, showsSnapshots, type LibraryFilter } from './libraryFilter';

interface LibraryPanelProps {
  snapshots: Snapshot[];
  extracts: KnowledgeExtract[];
  /** When search or a new capture targets an item, filters are cleared so it is visible. */
  focusItemId: ID | null;
}

export function LibraryPanel({ snapshots, extracts, focusItemId }: LibraryPanelProps) {
  const [filter, setFilter] = useState<LibraryFilter>(DEFAULT_FILTER);
  const library = useLibrary();
  const confirm = useConfirm();

  useEffect(() => {
    if (focusItemId) setFilter((f) => ({ ...DEFAULT_FILTER, sort: f.sort }));
  }, [focusItemId]);

  const tags = useMemo(
    () => Array.from(new Set([...snapshots, ...extracts].flatMap((i) => i.tags))).sort(),
    [snapshots, extracts],
  );
  const visibleSnapshots = filterSnapshots(snapshots, filter);
  const visibleExtracts = filterExtracts(extracts, filter);
  const filtered = isFiltered(filter);
  const toggleTag = (tag: string) => setFilter((f) => ({ ...f, tag: f.tag === tag ? '' : tag }));

  const removeSnapshot = async (s: Snapshot) => {
    const ok = await confirm({
      title: 'Delete snapshot?',
      message: (
        <>
          <strong className="font-medium text-ink">{s.title || 'This snapshot'}</strong> and its stored image will be permanently deleted.
          {s.cardIds.length > 0 && ` It will also be unlinked from ${s.cardIds.length} knowledge card${s.cardIds.length === 1 ? '' : 's'}.`}
        </>
      ),
      confirmLabel: 'Delete snapshot',
      danger: true,
    });
    if (ok) await deleteSnapshot(s.id);
  };

  const removeExtract = async (e: KnowledgeExtract) => {
    const ok = await confirm({
      title: 'Delete extract?',
      message: (
        <>
          <strong className="font-medium text-ink">{e.title || 'This extract'}</strong> will be permanently deleted.
        </>
      ),
      confirmLabel: 'Delete extract',
      danger: true,
    });
    if (ok) await deleteExtract(e.id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Screenshots, figures and passages collected for this phase.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<ImagePlus className="size-3.5" />} onClick={() => library.pickImages()}>
            Upload image
          </Button>
          <Button size="sm" icon={<ClipboardPaste className="size-3.5" />} onClick={() => library.pasteFromClipboard()} title="Paste a screenshot from the clipboard (Ctrl+V)">
            Paste
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => library.newExtract()}>
            New extract
          </Button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface/60 px-3 py-3 sm:px-4">
        <LibraryFilters value={filter} onChange={setFilter} tags={tags} resultCount={visibleSnapshots.length + visibleExtracts.length} />
      </div>

      {showsSnapshots(filter) && (
        <section className="mt-8" aria-labelledby="snapshots-heading">
          <SectionHeading id="snapshots-heading" icon={<Images className="size-4" />} title="Snapshot library" count={visibleSnapshots.length} total={snapshots.length} filtered={filtered} />
          {snapshots.length === 0 ? (
            <button
              type="button"
              onClick={() => library.pickImages()}
              className="group mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-12 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold">
                <ImagePlus className="size-5" />
              </span>
              <span className="mt-4 font-display text-lg text-ink">Build your visual archive</span>
              <span className="mt-1 max-w-sm text-sm text-muted">
                Drop screenshots anywhere on this page, press <Kbd>Ctrl</Kbd> <Kbd>V</Kbd> to paste one, or click to browse. PNG, JPG and WebP.
              </span>
            </button>
          ) : visibleSnapshots.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No snapshots match these filters.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {visibleSnapshots.map((s) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SnapshotTile
                      snapshot={s}
                      activeTag={filter.tag || null}
                      onOpen={() => library.openViewer(visibleSnapshots, s.id)}
                      onEdit={() => library.editSnapshot(s)}
                      onDelete={() => removeSnapshot(s)}
                      onTag={toggleTag}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      )}

      {showsExtracts(filter) && (
        <section className="mt-10" aria-labelledby="extracts-heading">
          <SectionHeading id="extracts-heading" icon={<Quote className="size-4" />} title="Important extracts" count={visibleExtracts.length} total={extracts.length} filtered={filtered} />
          {extracts.length === 0 ? (
            <button
              type="button"
              onClick={() => library.newExtract()}
              className="mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-10 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30"
            >
              <span className="font-display text-lg text-ink">Keep the passages that matter</span>
              <span className="mt-1 max-w-sm text-sm text-muted">
                Copy a sentence from a PDF or report, then press <Kbd>Ctrl</Kbd> <Kbd>V</Kbd> here to save it with its source.
              </span>
            </button>
          ) : visibleExtracts.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No extracts match these filters.</p>
          ) : (
            <div className="mt-4 space-y-3.5">
              <AnimatePresence initial={false}>
                {visibleExtracts.map((e) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ExtractView
                      extract={e}
                      activeTag={filter.tag || null}
                      onEdit={() => library.editExtract(e)}
                      onDelete={() => removeExtract(e)}
                      onTag={toggleTag}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHeading({ id, icon, title, count, total, filtered }: { id: string; icon: React.ReactNode; title: string; count: number; total: number; filtered: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
      <h3 id={id} className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink uppercase">
        <span className="text-gold">{icon}</span>
        {title}
      </h3>
      <span className="text-xs text-muted tabular">{filtered ? `${count} of ${total}` : total}</span>
    </div>
  );
}
