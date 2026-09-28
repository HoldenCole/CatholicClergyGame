import type { ReactNode } from 'react';
import { useUiStore } from './uiStore';

/** Whether a section is open: the reader's own fold if he has made one, else the sheet's default. */
export function useFold(key: string, defaultOpen: boolean): [boolean, () => void] {
  const folded = useUiStore((s) => s.prefs.folds?.[key]);
  const setFold = useUiStore((s) => s.setFold);
  const open = folded ?? defaultOpen;
  return [open, () => setFold(key, !open)];
}

/** A small-caps heading that folds what is under it: a chevron, a count, and a line of summary while it is closed. */
export function FoldHeading({ open, onToggle, title, summary, className = '' }: { open: boolean; onToggle: () => void; title: string; summary?: ReactNode; className?: string }) {
  return (
    <button type="button" className={'fold-head flex w-full items-baseline gap-2 text-left ' + className} onClick={onToggle} aria-expanded={open}>
      <span className="fold-chevron ink-faint" aria-hidden>{open ? '▾' : '▸'}</span>
      <span className="heading">{title}</span>
      {!open && summary && <span className="ink-faint min-w-0 flex-1 truncate text-xs normal-case tracking-normal">{summary}</span>}
    </button>
  );
}

/**
 * A section written on the open sheet: a small-caps heading and a body.
 * Given `fold`, the heading folds the body away; `'closed'` keeps a long or
 * secondary section out of the way until it is wanted, with `summary` standing
 * in for it. The reader's own folds are remembered in the browser.
 */
export default function Sheet({ title, children, fold, summary, foldKey }: { title: string; children: ReactNode; fold?: 'open' | 'closed'; summary?: ReactNode; foldKey?: string }) {
  const [open, toggle] = useFold(foldKey ?? `sheet:${title}`, fold !== 'closed');
  if (!fold) {
    return (
      <section className="border-b rule px-5 py-4 last:border-b-0">
        <div className="heading mb-2">{title}</div>
        {children}
      </section>
    );
  }
  return (
    <section className={'border-b rule px-5 last:border-b-0 ' + (open ? 'py-4' : 'py-2.5')}>
      <FoldHeading open={open} onToggle={toggle} title={title} {...(summary !== undefined ? { summary } : {})} className={open ? 'mb-2' : ''} />
      {open && children}
    </section>
  );
}
