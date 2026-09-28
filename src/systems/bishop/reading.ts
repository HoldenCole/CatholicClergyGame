import type { DiocesanNorm, GameState, Implementation } from '@/types';
import { axisDef } from '@/content/rome';
import { latestOn, docLean } from '@/systems/rome/policy';
import { applySeeHours } from '@/engine/see';

/**
 * E4 R1.1 — the bishop's own reading of Rome (E1 §4.2 step 2, from his side
 * of the desk). When a document on an axis reaches a man who holds a see, the
 * cascade asks him his norm; the record keeps it as the diocese's, and the
 * dials move by whether the diocese wanted what Rome sent and whether he
 * gave it to them. Weights are invented and flagged.
 */
export const READING = {
  /** The dials, per unit of agreement (the document's lean against the diocese's disposition) times the norm's weight. */
  presbyterate: 8,
  people: 6,
  /** Rome's regard: for the reading itself, whatever the diocese wanted. */
  rome: 5,
  weight: { enthusiastic: 1, faithful: 0.5, minimal: -0.5, slow: -1 } as Record<DiocesanNorm, number>,
} as const;

/** What a norm is on the record as an implementation: the profile reads both the same way. */
export const NORM_AS_DONE: Record<DiocesanNorm, Implementation> = { enthusiastic: 'eager', faithful: 'faithful', minimal: 'minimal', slow: 'defiant' };

const NORM_WORD: Record<DiocesanNorm, string> = { enthusiastic: 'welcomed it and asked every parish to act at once', faithful: 'received it, and sent guidelines', minimal: 'gave it the minimum', slow: 'slow-walked it' };

/** The bishop reads: the latest document on the axis carries his norm, the dials move, the record says so. */
export function recordNorm(state: GameState, axis: string, norm: DiocesanNorm): GameState {
  const issued = state.rome?.issued;
  const doc = latestOn(state, axis);
  if (!issued || !doc || !state.see) return state;
  const i = issued.lastIndexOf(doc);
  const read = { ...doc, norm, bishopId: 'player', implemented: NORM_AS_DONE[norm], implementedWeek: state.clock.week };
  const lean = docLean(axis, doc.from, doc.value ?? '');
  const disposition = (state.world?.diocese.visible.disposition ?? 0) / 100;
  const agreement = lean * disposition;
  const w = READING.weight[norm];
  const see = applySeeHours(state.see, { presbyterate: Math.round(READING.presbyterate * agreement * w), people: Math.round(READING.people * agreement * w), rome: Math.round(READING.rome * w) }, 1);
  const label = axisDef(axis)?.label ?? axis;
  return {
    ...state,
    see,
    rome: { ...state.rome!, issued: issued.map((d, j) => (j === i ? read : d)) },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Read ${doc.title} to the diocese on ${label}: ${NORM_WORD[norm]}.` }],
  };
}
