import { AnimatePresence, motion } from 'motion/react';
import { Check, ListChecks, Trash } from 'lucide-react';
import type { ChecklistItem, ID } from '../../types';
import { addTask, deleteTask, setTaskDone, updateTaskText } from '../../db/repository';
import { percent } from '../../lib/format';
import { EditableText } from '../ui/EditableText';
import { IconButton } from '../ui/Button';
import { AddLineInput } from '../ui/AddLineInput';
import { ProgressBar } from '../ui/ProgressBar';
import { Panel } from './Panel';

export function ChecklistPanel({ phaseId, tasks }: { phaseId: ID; tasks: ChecklistItem[] }) {
  const done = tasks.filter((t) => t.done).length;

  return (
    <Panel
      title="Work checklist"
      icon={<ListChecks className="size-4" />}
      aside={
        <span className="text-xs text-muted tabular">
          {done} of {tasks.length} complete
        </span>
      }
    >
      <ProgressBar value={percent(done, tasks.length)} className="mx-2 mb-3 w-auto" />
      <ul>
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.li
              key={task.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TaskRow task={task} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {tasks.length === 0 && <p className="px-2 py-2 text-sm text-muted">No tasks yet.</p>}
      <AddLineInput placeholder="Add a task" onAdd={(text) => addTask(phaseId, text)} />
    </Panel>
  );
}

function TaskRow({ task }: { task: ChecklistItem }) {
  return (
    <div data-item-id={task.id} className="group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2/60">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`}
        onClick={() => setTaskDone(task.id, !task.done)}
        className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
          task.done ? 'border-gold bg-gold text-on-gold' : 'border-line-strong bg-surface hover:border-gold'
        }`}
      >
        <AnimatePresence initial={false}>
          {task.done && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <div className="min-w-0 flex-1">
        <EditableText
          label="Task"
          value={task.text}
          multiline
          required
          onSave={(text) => updateTaskText(task.id, text)}
          className={`-mx-1 px-1 py-0.5 text-sm leading-snug transition-colors ${task.done ? 'text-faint line-through decoration-faint/60' : 'text-ink-2'}`}
        />
      </div>
      <IconButton size="sm" label="Delete task" className="reveal-on-hover -my-0.5 hover:!text-type-warning" onClick={() => deleteTask(task.id)}>
        <Trash className="size-3.5" />
      </IconButton>
    </div>
  );
}
