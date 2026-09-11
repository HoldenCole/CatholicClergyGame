import type { GameState, Parish, SeminaryState } from '@/types';
import { summerOptions } from '@/content/seminary';

/**
 * The formation record as the bishop and the personnel board read it at
 * ordination. DESIGN §6.6 (the exit payload) and §7.4. Numbers invented.
 */
export const STANDING = {
  base: 50,
  advanced: 8,
  concerns: -6,
  heldBack: -15,
  /** Per point of average pillar score over the record, around the "steady" band. */
  pillarPerPoint: 1.5,
  pillarSteady: 9,
  rectorPerPoint: 0.12,
  summer: 4,
  rectorRecommends: 12,
  rectorDoubts: -12,
  leader: 6,
  noticed: 8,
  wary: -10,
  cap: [0, 100] as [number, number],
} as const;

export interface Standing {
  /** 0..100. 50 is an unremarkable man. */
  value: number;
  word: string;
  reasons: string[];
}

export function standingWord(value: number): string {
  if (value >= 80) return 'the top of the class';
  if (value >= 65) return 'a strong record';
  if (value >= 45) return 'an ordinary record';
  if (value >= 30) return 'a thin record';
  return 'a record with concerns';
}

/** Read the record. Works during seminary too, so the man can see how he is being read. */
export function formationStanding(state: GameState): Standing {
  const sem = state.seminary;
  const reasons: string[] = [];
  if (!sem) return { value: STANDING.base, word: standingWord(STANDING.base), reasons };
  let value: number = STANDING.base;
  const evals = sem.evaluations;
  const advanced = evals.filter((e) => e.result === 'ADVANCED').length;
  const concerns = evals.filter((e) => e.result === 'ADVANCED_WITH_CONCERNS').length;
  value += advanced * STANDING.advanced + concerns * STANDING.concerns + sem.heldBackCount * STANDING.heldBack;
  if (evals.length) {
    const avg = evals.reduce((n, e) => n + Object.values(e.pillars).reduce((a, b) => a + b, 0) / 4, 0) / evals.length;
    value += (avg - STANDING.pillarSteady) * STANDING.pillarPerPoint;
  }
  const rector = Object.values(state.npcs).find((n) => n.tags.includes('rector'));
  if (rector) value += rector.relationship * STANDING.rectorPerPoint;
  const summers = Object.values(sem.summers).filter((s) => s !== 'home_parish').length;
  value += summers * STANDING.summer;
  // What the seminary years wrote in the file (events/seminary/career.json).
  if (state.flags.rector_recommends) value += STANDING.rectorRecommends;
  if (state.flags.rector_doubts) value += STANDING.rectorDoubts;
  if (state.flags.seminary_leader) value += STANDING.leader;
  if (state.flags.noticed_by_bishop) value += STANDING.noticed;
  if (state.flags.bishop_wary) value += STANDING.wary;
  value = Math.max(STANDING.cap[0], Math.min(STANDING.cap[1], value));

  if (advanced >= 4 && concerns === 0) reasons.push('every evaluation clean');
  else if (advanced >= 3) reasons.push('the evaluations were good');
  if (concerns >= 2) reasons.push('the file has concerns in it');
  if (sem.heldBackCount > 0) reasons.push('a year repeated');
  if (rector && rector.relationship >= 30) reasons.push('the rector spoke for you');
  if (rector && rector.relationship <= -20) reasons.push('the rector did not');
  if (summers >= 3) reasons.push('the summers were used well');
  if (state.flags.rector_recommends) reasons.push('the rector will write for you');
  if (state.flags.rector_doubts) reasons.push("the rector's letter will be careful");
  if (state.flags.seminary_leader) reasons.push('the house followed you');
  if (state.flags.noticed_by_bishop) reasons.push('the bishop knows your name, and likes it');
  if (state.flags.bishop_wary) reasons.push('the bishop has a reservation');
  return { value, word: standingWord(value), reasons };
}

/**
 * How much a first posting there says about the man sent. The flagship and
 * the growing parish are where a bishop puts the men he wants seen; the
 * rural post and the difficult parish are where he seasons or hides them.
 */
export function parishPrestige(parish: Parish): number {
  const byKind: Record<Parish['kind'], number> = { flagship_suburban: 1, immigrant_growing: 0.65, struggling_urban: 0.4, rural: 0.25, difficult: 0.15 };
  return Math.max(0, Math.min(1, byKind[parish.kind] + (parish.wealth - 3) * 0.08));
}

/** The summers on the record, in words, oldest first. */
export function summersOnRecord(sem: SeminaryState | null | undefined): { year: number; label: string }[] {
  if (!sem) return [];
  return Object.entries(sem.summers)
    .map(([y, id]) => ({ year: Number(y), label: summerOptions.find((o) => o.id === id)?.label ?? id }))
    .sort((a, b) => a.year - b.year);
}
