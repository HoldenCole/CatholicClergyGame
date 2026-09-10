import type { ReactNode } from 'react';

export default function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-stone-800 bg-stone-900/60">
      <div className="border-b border-stone-800 px-4 py-2 text-xs uppercase tracking-widest text-stone-400">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
