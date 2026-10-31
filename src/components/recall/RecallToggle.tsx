import { Brain } from 'lucide-react';
import type { ID, RevisionSourceType } from '../../types';
import { useSourceRevision } from '../../hooks/useJournalData';
import { addToRecall, removeFromRecall } from '../../db/repository';
import { IconButton } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmProvider';
import { useToast } from '../ui/Toast';

/** Adds a card or extract to Recall, or removes it. Lives in the item's hover toolbar. */
export function RecallToggle({ sourceType, sourceId, label }: { sourceType: RevisionSourceType; sourceId: ID; label: string }) {
  const revision = useSourceRevision(sourceType, sourceId);
  const toast = useToast();
  const confirm = useConfirm();
  const inRecall = !!revision;

  const toggle = async () => {
    if (revision) {
      const ok =
        revision.reviewCount === 0 ||
        (await confirm({
          title: 'Remove from Recall?',
          message: `“${label}” and its ${revision.reviewCount} recorded ${revision.reviewCount === 1 ? 'review' : 'reviews'} will be removed from Recall. The ${sourceType === 'card' ? 'card' : 'extract'} stays here.`,
          confirmLabel: 'Remove',
          danger: true,
        }));
      if (ok) await removeFromRecall([revision.id]);
      return;
    }
    await addToRecall(sourceType, [sourceId]);
    toast({ message: 'Added to Recall · due now' });
  };

  return (
    <IconButton size="sm" label={inRecall ? 'Remove from Recall' : 'Add to Recall'} active={inRecall} onClick={toggle}>
      <Brain className="size-3.5" />
    </IconButton>
  );
}
