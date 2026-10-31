import { Brain } from 'lucide-react';
import type { ID, RevisionSourceType } from '../../types';
import { useSourceRevision } from '../../hooks/useJournalData';
import { isDue, relativeDue } from '../../lib/recall';

/** Small "In Recall · due in 3 days" note shown on cards and extracts that are in Recall. */
export function RecallBadge({ sourceType, sourceId }: { sourceType: RevisionSourceType; sourceId: ID }) {
  const revision = useSourceRevision(sourceType, sourceId);
  if (!revision) return null;
  const due = isDue(revision);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted" title="This item is in Recall">
      <Brain className="size-3 text-gold" />
      In Recall · {due ? <span className="text-gold">due now</span> : relativeDue(revision.dueAt).replace(/^in /, 'next in ')}
    </span>
  );
}
