import type { Parish } from '@/types';
import patrons from '@/content/patrons.json';
import type { FeastKey } from '@/engine/feasts';

interface PatronDef {
  match: string;
  month?: number;
  day?: number;
  feast?: FeastKey;
}

const defs = (patrons as unknown as { patrons: PatronDef[] }).patrons;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * The parish's patronal feast from its name: the longest patron the name
 * contains wins, and a name nobody keeps gets a day from its id, the same
 * every time. Deterministic, so a save can be given one on load.
 */
export function patronalOf(name: string, id: string): NonNullable<Parish['patronal']> {
  const lower = name.toLowerCase();
  let best: PatronDef | undefined;
  for (const d of defs) {
    if (lower.includes(d.match.toLowerCase()) && (!best || d.match.length > best.match.length)) best = d;
  }
  const label = `the feast of ${name.replace(/^(Old|the Co-Cathedral of the|the Cathedral of)\s+/i, '').replace(/\s+(Cathedral Basilica|Cathedral|Basilica|Parish|Church)$/i, '')}`;
  if (best?.feast) return { label, feast: best.feast };
  if (best?.month && best.day) return { label, month: best.month, day: best.day };
  const h = hash(id + name);
  return { label, month: 1 + (h % 12), day: 1 + ((h >>> 4) % 28) };
}
