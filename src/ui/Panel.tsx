import type { ReactNode } from 'react';

/** A sheet of paper with a heading. Every panel in the game is one of these. */
export default function Panel({ title, children, className = '', tilt }: { title?: string; children: ReactNode; className?: string; tilt?: 'l' | 'r' }) {
  return (
    <div className={`paper ${tilt === 'l' ? 'paper-tilt-l' : tilt === 'r' ? 'paper-tilt-r' : ''} ${className}`}>
      {title && <div className="heading border-b rule px-5 pt-4 pb-2">{title}</div>}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
