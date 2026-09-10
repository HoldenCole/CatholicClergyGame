import type { Archetype, EvaluationRecord, EvaluationResult, GameState, Pillar, SeminaryState, StatKey } from '@/types';
import { ARCHETYPES, PILLARS } from '@/types';
import { applyStat, decayWeek } from './stats';
import { creationContent } from '@/content/creation';

/** Tunables. Formulas not in DESIGN.md are invented and marked. */
export const FORMATION = {
  /** Emphasis points allocated across the four pillars each year. */
  emphasisPoints: 10,
  emphasisMax: 6,
  /** Extra points in the philosophy years for men with prior study (DESIGN §6.3), scaled by discount. Invented. */
  discountBonusPoints: 3,
  /** Weeks of the formation year that accrue emphasis. Invented. */
  academicWeeks: 40,
  /** Pillar score per emphasis point over a full year. Invented: 6 points → 12. */
  pillarPerPoint: 2,
  /** Stat growth per emphasis point over a full year, before the log curve. Invented. */
  statPerPoint: 1.2,
  /** Evaluation thresholds on pillar scores. Invented. */
  weakPillar: 5,
  failingPillar: 2,
  failingTotal: 16,
  /** Years of zero emphasis in one pillar before it is grounds for dismissal. */
  zeroStreakDismissal: 3,
} as const;

const PILLAR_STATS: Record<Pillar, { key: StatKey; share: number }[]> = {
  human: [{ key: 'charisma', share: 1 }],
  spiritual: [{ key: 'piety', share: 1 }],
  intellectual: [
    { key: 'theology', share: 0.6 },
    { key: 'knowledge', share: 0.4 },
  ],
  pastoral: [
    { key: 'charisma', share: 0.5 },
    { key: 'piety', share: 0.3 },
    { key: 'administration', share: 0.2 },
  ],
};

export function zeroPillars(): Record<Pillar, number> {
  return { human: 0, spiritual: 0, intellectual: 0, pastoral: 0 };
}

/** Philosophy-year discount for the character, 0..1. DESIGN.md §3.3 and §6.3 */
export function philosophyDiscount(state: GameState): number {
  const bg = state.character?.background;
  if (!bg) return 0;
  const path = creationContent.paths.find((p) => p.id === bg.path);
  const field = creationContent.fields.find((f) => f.id === bg.field);
  if (!path?.hasField || !field) return 0;
  return Math.min(1, path.philosophyDiscount * field.philosophyDiscount + (path.philosophyDiscount >= 1 ? 0.2 : 0));
}

export function emphasisPointsFor(state: GameState): number {
  const year = state.seminary?.year ?? 1;
  const bonus = year === 2 || year === 3 ? Math.round(FORMATION.discountBonusPoints * philosophyDiscount(state)) : 0;
  return FORMATION.emphasisPoints + bonus;
}

export function validateEmphasis(emphasis: Record<Pillar, number>, points: number): string | null {
  let total = 0;
  for (const p of PILLARS) {
    const v = emphasis[p];
    if (!Number.isInteger(v) || v < 0 || v > FORMATION.emphasisMax) return `${p} must be 0–${FORMATION.emphasisMax}`;
    total += v;
  }
  if (total !== points) return `Allocate exactly ${points} points (you have ${total})`;
  return null;
}

export function setEmphasis(state: GameState, emphasis: Record<Pillar, number>): GameState {
  if (!state.seminary) throw new Error('no seminary state');
  const err = validateEmphasis(emphasis, emphasisPointsFor(state));
  if (err) throw new Error(err);
  return { ...state, seminary: { ...state.seminary, emphasis: { ...emphasis } } };
}

/**
 * One week of formation: emphasis accrues to pillars and stats, and decay
 * runs with no administrative load. Weeks without an emphasis (summer) only
 * decay.
 */
export function formationWeek(state: GameState): GameState {
  const sem = state.seminary;
  const c = state.character;
  if (!sem || !c) return state;
  const e = sem.emphasis;
  let stats = c.stats;
  const pillarScores = { ...sem.pillarScores };
  if (e) {
    for (const p of PILLARS) {
      const points = e[p];
      if (points === 0) continue;
      pillarScores[p] += (points * FORMATION.pillarPerPoint) / FORMATION.academicWeeks;
      for (const { key, share } of PILLAR_STATS[p]) {
        stats = applyStat(stats, key, (points * FORMATION.statPerPoint * share) / FORMATION.academicWeeks);
      }
    }
  }
  stats = decayWeek(stats, {
    adminAp: 0,
    theologyUsed: !!e && e.intellectual > 0,
    knowledgeUsed: !!e && e.intellectual > 0,
  });
  return { ...state, character: { ...c, stats }, seminary: { ...sem, pillarScores } };
}

export interface EvaluationInput {
  seminary: SeminaryState;
  /** Concerns recorded during this year (not carried from earlier years). */
  newConcerns: string[];
  flags: GameState['flags'];
}

const PILLAR_LABEL: Record<Pillar, string> = {
  human: 'human formation',
  spiritual: 'the spiritual life',
  intellectual: 'academic work',
  pastoral: 'pastoral formation',
};

/**
 * DESIGN.md §6.4. Dismissal only through sustained neglect or a serious
 * event, never before Y2. Held back never before Y2 either.
 */
export function evaluate(input: EvaluationInput): EvaluationRecord {
  const { seminary, newConcerns, flags } = input;
  const scores = seminary.pillarScores;
  const rounded = Object.fromEntries(PILLARS.map((p) => [p, Math.round(scores[p] * 10) / 10])) as Record<Pillar, number>;
  const notes: string[] = [];
  const weakest = PILLARS.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
  const total = PILLARS.reduce((sum, p) => sum + scores[p], 0);
  const emphasis = seminary.emphasis ?? zeroPillars();

  for (const p of PILLARS) {
    if (emphasis[p] === 0) notes.push(`Gave nothing to ${PILLAR_LABEL[p]} this year.`);
    else if (scores[p] < FORMATION.weakPillar) notes.push(`Weak in ${PILLAR_LABEL[p]}.`);
  }
  notes.push(...newConcerns);

  const seriousFlag = flags.dismissal_pending === true;
  const chronicZero = PILLARS.some((p) => emphasis[p] === 0 && seminary.zeroStreak[p] + 1 >= FORMATION.zeroStreakDismissal);
  const failing = scores[weakest] < FORMATION.failingPillar || total < FORMATION.failingTotal;

  let result: EvaluationResult;
  if (seminary.year >= 2 && (seriousFlag || chronicZero || (failing && seminary.heldBackCount >= 1))) {
    result = 'DISMISSED';
    notes.push(seriousFlag ? 'The rector has recommended dismissal.' : 'Sustained neglect of formation.');
  } else if (seminary.year >= 2 && failing) {
    result = 'HELD_BACK';
    notes.push('Not ready to advance; the year will be repeated.');
  } else if (notes.length > 0 || flags.candidacy_concern === true) {
    result = 'ADVANCED_WITH_CONCERNS';
    if (flags.candidacy_concern === true && seminary.year === 4) notes.push('Admitted to candidacy with reservations noted.');
    if (seminary.year === 1 && failing) notes.push('A poor first year, forgiven once.');
  } else {
    result = 'ADVANCED';
  }
  return { year: seminary.year, result, pillars: rounded, notes };
}

/** Which archetype the seminary names at ordination. DESIGN.md §3.7 */
export function nameArchetype(state: GameState): Archetype {
  const c = state.character;
  if (!c) return 'pastoral';
  const s = c.stats;
  const fromStats: Record<Archetype, number> = {
    pastoral: s.charisma * 0.6 + s.piety * 0.4,
    teaching: s.knowledge * 0.5 + s.charisma * 0.5,
    theological: s.theology * 0.7 + s.knowledge * 0.3,
    administrative: s.administration,
    missionary: s.piety * 0.5 + s.charisma * 0.3 + s.knowledge * 0.2,
  };
  const history = state.seminary?.evaluations ?? [];
  const pillarSum = zeroPillars();
  for (const ev of history) for (const p of PILLARS) pillarSum[p] += ev.pillars[p];
  const fromPillars: Record<Archetype, number> = {
    pastoral: pillarSum.pastoral + pillarSum.human * 0.5,
    teaching: pillarSum.intellectual * 0.6 + pillarSum.human * 0.4,
    theological: pillarSum.intellectual,
    administrative: pillarSum.pastoral * 0.5 + pillarSum.human * 0.3,
    missionary: pillarSum.spiritual + pillarSum.pastoral * 0.5,
  };
  let best: Archetype = 'pastoral';
  let bestScore = -Infinity;
  for (const a of ARCHETYPES) {
    const score = fromStats[a] + fromPillars[a] * 0.5 + c.archetypeLeaning[a] * 8;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}
