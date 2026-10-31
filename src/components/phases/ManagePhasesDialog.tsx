import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash } from 'lucide-react';
import type { ID, Phase, PhaseStats } from '../../types';
import { deletePhase, movePhase, reorderPhases } from '../../db/repository';
import { phaseNumber } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmProvider';

interface ManagePhasesDialogProps {
  open: boolean;
  onClose: () => void;
  phases: Phase[];
  stats: Map<ID, PhaseStats> | undefined;
  onAdd: () => void;
  onEdit: (phase: Phase) => void;
}

/** Add, rename, describe, reorder (drag or arrows) and delete phases. */
export function ManagePhasesDialog({ open, onClose, phases, stats, onAdd, onEdit }: ManagePhasesDialogProps) {
  const [items, setItems] = useState(phases);
  const dragging = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const confirm = useConfirm();

  useEffect(() => {
    if (!dragging.current) setItems(phases);
  }, [phases]);

  const remove = async (phase: Phase) => {
    const s = stats?.get(phase.id);
    const ok = await confirm({
      title: 'Delete phase?',
      message: (
        <>
          <strong className="font-medium text-ink">{phase.title}</strong> and its {s?.tasks ?? 0} checklist tasks, {s?.cards ?? 0} knowledge cards,{' '}
          {s?.snapshots ?? 0} snapshots and {s?.extracts ?? 0} extracts will be permanently deleted. Documents filed here are kept in the Document Library as
          unfiled.
        </>
      ),
      confirmLabel: 'Delete phase',
      danger: true,
    });
    if (ok) await deletePhase(phase.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage phases"
      labelledBy="manage-title"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={onAdd} className="mr-auto">
            Add phase
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <p className="px-6 pt-4 text-[13px] text-muted">Drag the handle or use the arrows to reorder. Numbers update automatically.</p>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-1.5 px-4 py-4">
        {items.map((phase, i) => (
          <ManageRow
            key={phase.id}
            phase={phase}
            index={i}
            last={i === items.length - 1}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={() => {
              dragging.current = false;
              reorderPhases(itemsRef.current.map((p) => p.id));
            }}
            onEdit={() => onEdit(phase)}
            onDelete={() => remove(phase)}
          />
        ))}
      </Reorder.Group>
      {items.length === 0 && <p className="px-6 pb-6 text-sm text-muted">No phases yet. Add one to start your pathway.</p>}
    </Modal>
  );
}

interface ManageRowProps {
  phase: Phase;
  index: number;
  last: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ManageRow({ phase, index, last, onDragStart, onDragEnd, onEdit, onDelete }: ManageRowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={phase}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group relative flex items-center gap-3 rounded-xl border border-line bg-surface px-2 py-2.5 select-none"
      whileDrag={{ scale: 1.015, boxShadow: '0 16px 40px -16px rgb(0 0 0 / 0.3)', zIndex: 10 }}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${phase.title}`}
        onPointerDown={(e) => controls.start(e)}
        className="flex size-8 cursor-grab touch-none items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-7 font-display text-lg text-faint tabular">{phaseNumber(index)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{phase.title}</p>
        <p className="truncate text-xs text-muted">{phase.description || 'No description'}</p>
      </div>
      <div className="flex items-center">
        <IconButton size="sm" label="Move up" disabled={index === 0} onClick={() => movePhase(phase.id, -1)}>
          <ArrowUp className="size-4" />
        </IconButton>
        <IconButton size="sm" label="Move down" disabled={last} onClick={() => movePhase(phase.id, 1)}>
          <ArrowDown className="size-4" />
        </IconButton>
        <IconButton size="sm" label="Edit phase" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Delete phase" onClick={onDelete} className="hover:!text-type-warning">
          <Trash className="size-3.5" />
        </IconButton>
      </div>
    </Reorder.Item>
  );
}
