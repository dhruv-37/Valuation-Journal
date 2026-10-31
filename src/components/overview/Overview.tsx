import { ArrowRight, Search, Settings2 } from 'lucide-react';
import type { ID, Phase, PhaseStats } from '../../types';
import { percent, phaseNumber } from '../../lib/format';
import { Button, Kbd } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ThemeToggle } from '../ThemeToggle';
import { BrandMark } from '../BrandMark';
import { MainNav } from '../MainNav';
import { PhasePathway } from './PhasePathway';

interface OverviewProps {
  phases: Phase[];
  stats: Map<ID, PhaseStats> | undefined;
  /** All documents in the journal, filed or not. */
  documentCount: number;
  lastVisitedId?: ID;
  onOpenPhase: (id: ID) => void;
  onAddPhase: () => void;
  onManage: () => void;
  onSearch: () => void;
}

export function Overview({ phases, stats, documentCount, lastVisitedId, onOpenPhase, onAddPhase, onManage, onSearch }: OverviewProps) {
  let tasks = 0;
  let done = 0;
  let cards = 0;
  let snapshots = 0;
  for (const s of stats?.values() ?? []) {
    tasks += s.tasks;
    done += s.done;
    cards += s.cards + s.snapshots + s.extracts;
    snapshots += s.snapshots;
  }
  const overall = percent(done, tasks);
  const completePhases = phases.filter((p) => {
    const s = stats?.get(p.id);
    return s && s.tasks > 0 && s.done === s.tasks;
  }).length;
  const resumeIndex = phases.findIndex((p) => p.id === lastVisitedId);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-8">
          <BrandMark />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MainNav current="overview" documentCount={documentCount} />
            <button
              type="button"
              onClick={onSearch}
              className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted shadow-card transition-colors hover:border-line-strong hover:text-ink lg:w-64"
            >
              <Search className="size-4" />
              <span className="hidden flex-1 text-left lg:inline">Search journal…</span>
              <span className="hidden items-center gap-0.5 lg:flex">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-8">
        <section className="grid items-end gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">Discounted cash flow · Workflow</p>
            <h1 className="mt-3 font-display text-[40px] leading-[1.05] font-medium tracking-tight text-ink sm:text-[52px]">
              The valuation pathway
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              {phases.length} {phases.length === 1 ? 'phase' : 'phases'} from objective to conclusion. Open a phase to work through
              its checklist and the knowledge you have collected along the way.
            </p>
            {resumeIndex >= 0 && (
              <Button
                variant="primary"
                className="mt-6"
                onClick={() => onOpenPhase(phases[resumeIndex].id)}
                icon={<ArrowRight className="order-last size-4" />}
              >
                Resume · {phaseNumber(resumeIndex)} {phases[resumeIndex].title}
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface shadow-card">
            <Figure label="Overall progress" value={`${overall}%`}>
              <ProgressBar value={overall} className="mt-3 w-full" />
            </Figure>
            <Figure label="Tasks complete" value={`${done}`} suffix={`/ ${tasks}`}>
              <p className="mt-2 text-xs text-muted">
                {completePhases} of {phases.length} phases done
              </p>
            </Figure>
            <Figure label="Knowledge items" value={`${cards}`}>
              <p className="mt-2 text-xs text-muted">
                {snapshots} {snapshots === 1 ? 'snapshot' : 'snapshots'} · {documentCount} {documentCount === 1 ? 'document' : 'documents'}
              </p>
            </Figure>
          </dl>
        </section>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <div className="flex items-center gap-5 text-xs text-muted">
            <Legend swatch="bg-gold" label="Complete" />
            <Legend swatch="bg-gold/50" label="In progress" dot />
            <Legend swatch="bg-line-strong" label="Not started" />
          </div>
          <Button size="sm" variant="secondary" icon={<Settings2 className="size-3.5" />} onClick={onManage}>
            Manage phases
          </Button>
        </div>

        <PhasePathway phases={phases} stats={stats} onOpen={onOpenPhase} onAdd={onAddPhase} />
      </main>
    </div>
  );
}

function Figure({ label, value, suffix, children }: { label: string; value: string; suffix?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:w-48 sm:px-6 sm:py-5">
      <dt className="text-[11px] leading-tight font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-2 font-display text-[28px] leading-none tracking-tight text-ink tabular sm:text-[32px]">
        {value}
        {suffix && <span className="ml-1 font-sans text-sm text-faint">{suffix}</span>}
      </dd>
      {children}
    </div>
  );
}

function Legend({ swatch, label, dot }: { swatch: string; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={dot ? `size-1.5 rounded-full ${swatch.replace('/50', '')}` : `h-0.5 w-5 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
