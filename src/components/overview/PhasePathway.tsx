import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { ID, Phase, PhaseStats } from '../../types';
import { AddPhaseNode, PhaseNode, phaseStatus } from './PhaseNode';

interface PhasePathwayProps {
  phases: Phase[];
  stats: Map<ID, PhaseStats> | undefined;
  onOpen: (id: ID) => void;
  onAdd: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const columnsFor = (width: number) => (width >= 1080 ? 4 : width >= 780 ? 3 : width >= 520 ? 2 : 1);

/**
 * The phases laid out as a serpentine path: left→right, then right→left on the
 * next row, so each phase sits next to its successor. A connector line is drawn
 * behind the cards from measured positions, so it adapts to any phase count
 * and screen width.
 */
export function PhasePathway({ phases, stats, onOpen, onAdd }: PhasePathwayProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [boxes, setBoxes] = useState<Box[]>([]);

  const count = phases.length + 1; // + "Add a phase" node
  nodeRefs.current.length = count;
  const cols = columnsFor(width);

  const measure = useCallback(() => {
    // Array.from (not .map) so empty slots for just-added nodes become real entries.
    const next = Array.from(nodeRefs.current, (n) =>
      n ? { x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 },
    );
    setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    const grid = gridRef.current!;
    setWidth(grid.clientWidth);
    const observer = new ResizeObserver(() => {
      setWidth(grid.clientWidth);
      measure();
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [measure]);

  useLayoutEffect(measure, [measure, cols, phases]);

  const place = (i: number) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    return { gridRow: row + 1, gridColumn: (row % 2 === 0 ? c : cols - 1 - c) + 1 };
  };

  // Boxes lag one render behind when phases are added or removed; draw only once they match.
  const measured = boxes.length === count && boxes.every((b) => b.w > 0);
  const segments = (measured ? boxes.slice(0, -1) : []).map((a, i) => {
    const b = boxes[i + 1];
    const from = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const to = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const horizontal = Math.abs(from.y - to.y) < 1;
    // Midpoint of the visible gap between the two cards (for the direction chevron).
    const mid = horizontal
      ? { x: (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y: from.y }
      : { x: from.x, y: (Math.min(a.y + a.h, b.y + b.h) + Math.max(a.y, b.y)) / 2 };
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const toAdd = i === phases.length - 1;
    const complete = !toAdd && phaseStatus(stats?.get(phases[i].id)) === 'complete';
    return { from, to, mid, angle, toAdd, complete, key: toAdd ? 'add' : phases[i].id };
  });

  return (
    <div
      ref={gridRef}
      className="relative grid gap-x-10 gap-y-12"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {segments.map((s) => (
          <g key={s.key}>
            <line
              x1={s.from.x}
              y1={s.from.y}
              x2={s.to.x}
              y2={s.to.y}
              stroke="var(--line-strong)"
              strokeWidth={1.5}
              strokeDasharray={s.toAdd ? '4 5' : undefined}
            />
            {s.complete && (
              <motion.line
                x1={s.from.x}
                y1={s.from.y}
                x2={s.to.x}
                y2={s.to.y}
                stroke="var(--gold)"
                strokeWidth={2}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
            {!s.toAdd && (
              <g transform={`translate(${s.mid.x} ${s.mid.y}) rotate(${s.angle})`}>
                <circle r={9} fill="var(--canvas)" />
                <path
                  d="M -2.5 -3.5 L 1.5 0 L -2.5 3.5"
                  fill="none"
                  stroke={s.complete ? 'var(--gold)' : 'var(--faint)'}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </g>
        ))}
      </svg>

      {phases.map((phase, i) => (
        <motion.div
          key={phase.id}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          layout="position"
          className="relative z-10"
          style={place(i)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: Math.min(i * 0.035, 0.5), ease: [0.22, 1, 0.36, 1] }}
        >
          <PhaseNode phase={phase} index={i} stats={stats?.get(phase.id)} onOpen={() => onOpen(phase.id)} />
        </motion.div>
      ))}
      <motion.div
        key="add"
        ref={(el) => {
          nodeRefs.current[phases.length] = el;
        }}
        layout="position"
        className="relative z-10"
        style={place(phases.length)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <AddPhaseNode onAdd={onAdd} />
      </motion.div>
    </div>
  );
}
