import { Target, X } from 'lucide-react';
import type { Phase } from '../../types';
import { updatePhase } from '../../db/repository';
import { EditableText } from '../ui/EditableText';
import { IconButton } from '../ui/Button';
import { AddLineInput } from '../ui/AddLineInput';
import { Panel } from './Panel';

export function ObjectivesPanel({ phase }: { phase: Phase }) {
  const save = (objectives: string[]) => updatePhase(phase.id, { objectives });

  return (
    <Panel title="Objectives" icon={<Target className="size-4" />}>
      <ol className="space-y-0.5">
        {phase.objectives.map((objective, i) => (
          <li key={`${i}-${objective}`} className="group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2/60">
            <span className="mt-[3px] w-4 shrink-0 text-right font-display text-sm text-gold tabular">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <EditableText
                label="Objective"
                value={objective}
                multiline
                onSave={(text) => save(text ? phase.objectives.map((o, j) => (j === i ? text : o)) : phase.objectives.filter((_, j) => j !== i))}
                className="-mx-1 px-1 py-0.5 text-sm leading-snug text-ink-2"
              />
            </div>
            <IconButton
              size="sm"
              label="Remove objective"
              className="reveal-on-hover -my-0.5"
              onClick={() => save(phase.objectives.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </IconButton>
          </li>
        ))}
      </ol>
      <AddLineInput placeholder="Add an objective" onAdd={(text) => save([...phase.objectives, text])} />
    </Panel>
  );
}
