import type { ReactNode } from 'react';

export function Panel({ title, icon, aside, children }: { title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-3 px-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink uppercase">
          <span className="text-gold">{icon}</span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
