import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, Check, FileArchive, TriangleAlert, Upload } from 'lucide-react';
import type { ID, Journal, JournalCounts } from '../../types';
import { countJournal } from '../../db/bundle';
import { importJournalBundle, type BundleImport } from '../../db/repository';
import { useJournals } from '../../hooks/useActiveJournal';
import { downloadBlob } from '../../hooks/useBlobUrl';
import { BackupError, exportJournals, loadBackupJournal, readBackup, type BackupContents, type BackupJournal } from '../../lib/backup';
import { ZipError } from '../../lib/zip';
import { isQuotaError, readStorageInfo } from '../../lib/documents';
import { formatBytes } from '../../lib/images';
import { formatDate, percent, plural } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { useConfirm } from '../ui/ConfirmProvider';
import { useToast } from '../ui/Toast';

interface BackupDialogProps {
  /** Journals preselected for export; changes on every opening. */
  state: { ids?: ID[]; nonce: number } | null;
  onClose: () => void;
  /** Called with the first journal restored, so the app can open it. */
  onImported: (id: ID) => void;
}

type Tab = 'export' | 'restore';

interface Progress {
  label: string;
  value: number;
}

/** Export journals to a ZIP backup, or restore journals from one. */
export function BackupDialog({ state, onClose, onImported }: BackupDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!state} onClose={() => !busy && onClose()} title="Backup & restore" labelledBy="backup-title" width="max-w-2xl">
      {state && <BackupBody key={state.nonce} preselected={state.ids} onClose={onClose} onImported={onImported} busy={busy} setBusy={setBusy} />}
    </Modal>
  );
}

interface BodyProps {
  preselected?: ID[];
  onClose: () => void;
  onImported: (id: ID) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

function BackupBody({ preselected, onClose, onImported, busy, setBusy }: BodyProps) {
  const [tab, setTab] = useState<Tab>('export');
  return (
    <div>
      <div className="flex gap-1 border-b border-line px-6 pt-3" role="tablist">
        {(['export', 'restore'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            disabled={busy}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium transition-colors ${
              tab === t ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t === 'export' ? 'Export backup' : 'Restore from backup'}
          </button>
        ))}
      </div>
      {tab === 'export' ? (
        <ExportPanel preselected={preselected} busy={busy} setBusy={setBusy} />
      ) : (
        <RestorePanel busy={busy} setBusy={setBusy} onClose={onClose} onImported={onImported} />
      )}
    </div>
  );
}

/* ---------------------------------- Export ---------------------------------- */

function useJournalCounts(journals: Journal[]) {
  const key = journals.map((j) => j.id).join();
  return useLiveQuery(async () => new Map(await Promise.all(journals.map(async (j) => [j.id, await countJournal(j.id)] as const))), [key]);
}

function ExportPanel({ preselected, busy, setBusy }: { preselected?: ID[]; busy: boolean; setBusy: (b: boolean) => void }) {
  const toast = useToast();
  const journals = useJournals() ?? [];
  const counts = useJournalCounts(journals);
  const [selected, setSelected] = useState<Set<ID> | null>(preselected ? new Set(preselected) : null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [done, setDone] = useState<{ fileName: string; size: number } | null>(null);

  // Everything is ticked by default.
  const chosen = selected ?? new Set(journals.map((j) => j.id));
  const toggle = (id: ID) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const totalBytes = journals.filter((j) => chosen.has(j.id)).reduce((n, j) => n + (counts?.get(j.id)?.fileBytes ?? 0), 0);

  const run = async () => {
    const ids = journals.filter((j) => chosen.has(j.id)).map((j) => j.id);
    if (ids.length === 0) return;
    setBusy(true);
    setDone(null);
    try {
      const { blob, fileName } = await exportJournals(ids, (stage, n, total) => setProgress({ label: `${stage}… ${n} of ${total}`, value: percent(n, total) }));
      downloadBlob(`backup:${Date.now()}`, blob, fileName);
      setDone({ fileName, size: blob.size });
      toast({ message: `Backup saved: ${fileName}` });
    } catch (error) {
      toast({ message: error instanceof ZipError ? error.message : 'The backup could not be created.', tone: 'error' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="px-6 py-5">
      <p className="text-sm leading-relaxed text-muted">
        One <span className="text-ink-2">.zip</span> file with everything in the chosen journals: phases and their order, checklists, cards, snapshots with
        their images, extracts, documents with the original files, tags, connections, and Recall history and schedules.
      </p>
      <ul className="mt-4 space-y-1.5">
        {journals.map((j) => (
          <li key={j.id}>
            <CheckRow checked={chosen.has(j.id)} onToggle={() => toggle(j.id)} disabled={busy} title={j.name} detail={summary(counts?.get(j.id))} />
          </li>
        ))}
      </ul>
      {progress && (
        <div className="mt-4" aria-live="polite">
          <p className="mb-1.5 text-xs text-muted tabular">{progress.label}</p>
          <ProgressBar value={progress.value} />
        </div>
      )}
      {done && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-gold-soft/60 px-3.5 py-2.5 text-[13px] text-ink-2" role="status">
          <Check className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>
            Saved <strong className="font-medium text-ink">{done.fileName}</strong> ({formatBytes(done.size)}) to your downloads. Keep a copy somewhere safe: it
            is the only copy outside this browser.
          </span>
        </p>
      )}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-muted tabular">
          {chosen.size} {chosen.size === 1 ? 'journal' : 'journals'}
          {totalBytes ? ` · about ${formatBytes(totalBytes)} of files` : ''}
        </span>
        <Button variant="primary" icon={<Archive className="size-4" />} disabled={busy || chosen.size === 0} onClick={run}>
          {busy ? 'Exporting…' : 'Export backup'}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- Restore --------------------------------- */

type Choice = 'new' | 'skip' | `replace:${string}`;

function RestorePanel({ busy, setBusy, onClose, onImported }: { busy: boolean; setBusy: (b: boolean) => void; onClose: () => void; onImported: (id: ID) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const journals = useJournals() ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [contents, setContents] = useState<BackupContents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [free, setFree] = useState<number | null>(null);

  useEffect(() => {
    readStorageInfo().then((info) => setFree(info && info.quota > 0 ? Math.max(0, info.quota - info.usage) : null));
  }, [contents]);

  /** An existing journal a backup journal could replace: same original id, else same name. */
  const matchFor = (b: BackupJournal) => journals.find((j) => j.id === b.originalId) ?? journals.find((j) => j.name.toLowerCase() === b.name.toLowerCase());

  const open = async (file: File) => {
    setFileName(file.name);
    setContents(null);
    setError(null);
    setBusy(true);
    try {
      const read = await readBackup(file);
      setContents(read);
      setChoices(read.journals.map((j) => (j.error ? 'skip' : 'new')));
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const selected = useMemo(() => (contents?.journals ?? []).map((j, i) => ({ journal: j, choice: choices[i] })).filter((x) => x.choice && x.choice !== 'skip'), [contents, choices]);
  const neededBytes = selected.reduce((n, x) => n + x.journal.counts.fileBytes, 0);
  const tooBig = free !== null && neededBytes * 1.1 > free;

  const restore = async () => {
    if (!contents || selected.length === 0) return;
    const replacing = selected
      .filter((x) => x.choice.startsWith('replace:'))
      .map((x) => ({ from: x.journal, into: journals.find((j) => `replace:${j.id}` === x.choice) }))
      .filter((x) => x.into);
    if (replacing.length > 0) {
      const ok = await confirm({
        title: replacing.length === 1 ? 'Replace a journal?' : `Replace ${replacing.length} journals?`,
        message: (
          <>
            {replacing.map((r) => (
              <span key={r.into!.id} className="mb-1 block">
                Everything now in <strong className="font-medium text-ink">{r.into!.name}</strong> will be permanently deleted and replaced by the backup’s “
                {r.from.name}”.
              </span>
            ))}
            <span className="mt-3 block text-muted">This cannot be undone. To keep both, choose “Import as a new journal” instead.</span>
          </>
        ),
        confirmLabel: 'Replace',
        danger: true,
      });
      if (!ok) return;
    }

    setBusy(true);
    const imported: { id: ID; name: string; dropped: number }[] = [];
    const failed: string[] = [];
    for (let i = 0; i < selected.length; i++) {
      const { journal, choice } = selected[i];
      const step = `${i + 1} of ${selected.length}: ${journal.name}`;
      try {
        setProgress({ label: `Checking files (${step})…`, value: 0 });
        const bundle = await loadBackupJournal(contents, journal, (n, total) => setProgress({ label: `Checking files (${step})… ${n} of ${total}`, value: percent(n, total) }));
        setProgress({ label: `Saving ${step}…`, value: 100 });
        const target: BundleImport = choice === 'new' ? { mode: 'new', name: journal.name } : { mode: 'replace', journalId: choice.slice('replace:'.length) };
        const result = await importJournalBundle(bundle, target);
        imported.push({ id: result.journal.id, name: result.journal.name, dropped: result.dropped + journal.invalid });
      } catch (e) {
        const reason = e instanceof BackupError || e instanceof ZipError ? e.message : isQuotaError(e) ? 'browser storage is full' : 'it could not be saved';
        failed.push(`“${journal.name}”: ${reason.replace(/\.$/, '')}`);
      }
    }
    setBusy(false);
    setProgress(null);

    if (imported.length > 0) {
      const skipped = imported.reduce((n, x) => n + x.dropped, 0);
      toast({
        message: `Restored ${imported.map((x) => `“${x.name}”`).join(', ')}${skipped ? ` (${skipped} damaged ${skipped === 1 ? 'record' : 'records'} skipped)` : ''}`,
      });
      onImported(imported[0].id);
    }
    if (failed.length > 0) setError(`Not restored, nothing was changed for: ${failed.join('; ')}.`);
    else onClose();
  };

  return (
    <div className="px-6 py-5">
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void open(file);
        }}
      />
      {!contents && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30 disabled:opacity-60"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold">
            <Upload className="size-5" />
          </span>
          <span className="mt-3 text-sm font-medium text-ink">{busy ? `Checking ${fileName}…` : 'Choose a backup file (.zip)'}</span>
          <span className="mt-1 max-w-sm text-xs text-muted">The archive is checked first. Nothing changes until you choose what to restore and confirm.</span>
        </button>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-type-warning/10 px-3.5 py-2.5 text-[13px] text-ink-2" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-type-warning" />
          <span>{error}</span>
        </p>
      )}

      {contents && (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
              <FileArchive className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{fileName}</p>
              <p className="text-xs text-muted">
                Backup {contents.createdAt ? `from ${formatDate(contents.createdAt)}` : ''} · {contents.journals.length}{' '}
                {contents.journals.length === 1 ? 'journal' : 'journals'} · format {contents.version}
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
              Choose another
            </Button>
          </div>
          {contents.newerSchema && (
            <p className="mt-3 text-xs text-type-warning">This backup was made by a newer version of the app. Fields this version doesn’t know about are left out.</p>
          )}
          <ul className="mt-4 space-y-2">
            {contents.journals.map((j, i) => {
              const match = matchFor(j);
              return (
                <li key={j.folder || i} className="rounded-xl border border-line px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">{j.name}</p>
                      <p className="text-xs text-muted tabular">{j.error ? '' : summary(j.counts)}</p>
                    </div>
                    {!j.error && (
                      <select
                        value={choices[i]}
                        disabled={busy}
                        onChange={(e) => setChoices((c) => c.map((v, k) => (k === i ? (e.target.value as Choice) : v)))}
                        aria-label={`What to do with ${j.name}`}
                        className="h-8 max-w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-gold/70"
                      >
                        <option value="new">Import as a new journal</option>
                        {match && <option value={`replace:${match.id}`}>Replace “{match.name}”</option>}
                        <option value="skip">Skip</option>
                      </select>
                    )}
                  </div>
                  {j.error && <p className="mt-1.5 text-xs text-type-warning">Can’t be restored: {j.error}</p>}
                  {!j.error && j.invalid > 0 && <p className="mt-1.5 text-xs text-type-warning">{j.invalid} malformed records will be skipped.</p>}
                  {!j.error && match && choices[i] === 'new' && (
                    <p className="mt-1.5 text-xs text-faint">A journal called “{match.name}” already exists; this adds a second, separate copy.</p>
                  )}
                </li>
              );
            })}
          </ul>
          {tooBig && (
            <p className="mt-3 text-xs text-type-warning">
              About {formatBytes(neededBytes)} of files to restore, but only about {formatBytes(free ?? 0)} of browser storage is free.
            </p>
          )}
          {progress && (
            <div className="mt-4" aria-live="polite">
              <p className="mb-1.5 text-xs text-muted tabular">{progress.label}</p>
              <ProgressBar value={progress.value} />
            </div>
          )}
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="primary" disabled={busy || selected.length === 0 || tooBig} onClick={restore}>
              {busy ? 'Restoring…' : `Restore ${selected.length || ''} ${selected.length === 1 ? 'journal' : 'journals'}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- Shared ---------------------------------- */

function summary(c: JournalCounts | undefined) {
  if (!c) return 'Counting…';
  return [
    plural(c.phases, 'phase'),
    plural(c.cards, 'card'),
    plural(c.snapshots, 'snapshot'),
    plural(c.extracts, 'extract'),
    plural(c.documents, 'document'),
    `${c.revisions} in Recall`,
    ...(c.fileBytes ? [formatBytes(c.fileBytes)] : []),
  ].join(' · ');
}

function CheckRow({ checked, onToggle, disabled, title, detail }: { checked: boolean; onToggle: () => void; disabled: boolean; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left transition-colors hover:border-line-strong disabled:opacity-60"
    >
      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-gold bg-gold text-on-gold' : 'border-line-strong'}`}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted tabular">{detail}</span>
      </span>
    </button>
  );
}

