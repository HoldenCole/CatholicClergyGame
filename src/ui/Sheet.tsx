import type { ReactNode } from 'react';

/** A section written on the open sheet: a small-caps heading and a body. */
export default function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b rule px-5 py-4 last:border-b-0">
      <div className="heading mb-2">{title}</div>
      {children}
    </section>
  );
}
