import type { Condition, EveningKind, GameState, NightState } from '@/types';
import { EVENING_KINDS } from '@/types';
import type { Rng } from '@/engine/rng';
import nightJson from '@/content/night.json';
import { applyEffects } from '@/engine/effects';
import { strainOf } from './week';

/**
 * The house at night. DESIGN §8.13: the rectory after the office closes,
 * the priory after Compline. What a man does with an evening (a standing
 * habit he chooses), and what the nights are as a result: company, rest,
 * the breviary kept or not. The week draws from it (rest is how strain
 * recovers; the night office is a little piety), the years shape it, and
 * once a season a scene is drawn in which the night is the whole story.
 * The bottle is never a number: only authored scenes, with ways out.
 */
interface EveningDef { label: string; blurb: string; targets: { company: number; rest: number; prayer: number }; lines: string[] }
const content = nightJson as unknown as {
  follow: number; lineChance: number; sceneEveryWeeks: number; sceneChance: number;
  evenings: Record<EveningKind, EveningDef>;
  friar: { company: number; rest: number; prayer: number };
  words: Record<'company' | 'rest' | 'prayer', [number, string][]>;
  review: { alone: string; fine: string };
};

export const NIGHT = {
  follow: content.follow,
  lineChance: content.lineChance,
  sceneEveryWeeks: content.sceneEveryWeeks,
  sceneChance: content.sceneChance,
  /** Piety a week when the night office is kept. */
  prayerPiety: 0.1,
  prayerKept: 60,
  /** Alone: company under this, with strain over that, counts the weeks. */
  aloneCompany: 25,
  aloneStrain: 35,
  /** How rest scales the week's strain recovery: from this at zero rest to this plus the span at full. */
  restFloor: 0.6,
  restSpan: 0.6,
  /** The phone warms the closest classmate, a little a week. */
  phoneWarmth: 0.3,
} as const;

export const eveningDefs = content.evenings;

export function eveningLabel(kind: EveningKind): string {
  return content.evenings[kind].label;
}

export function eveningBlurb(kind: EveningKind): string {
  return content.evenings[kind].blurb;
}

/** The nights as they start: a vicar shares a rectory, a pastor is alone, a friar has a house. */
export function defaultNight(state: GameState): NightState {
  const friar = !!state.religious && !state.parish;
  const vicar = state.assignment?.role === 'parochial_vicar';
  return { evenings: friar ? 'the_breviary' : 'quiet', company: friar ? 65 : vicar ? 45 : 30, rest: 60, prayer: friar ? 65 : 40, aloneWeeks: 0 };
}

export function nightOf(state: GameState): NightState {
  return state.night ?? defaultNight(state);
}

export function setEvenings(state: GameState, kind: EveningKind): GameState {
  if (!EVENING_KINDS.includes(kind)) return state;
  return { ...state, night: { ...nightOf(state), evenings: kind } };
}

/** How rest scales strain recovery: 0.6 at no rest, 1.2 at full. Games without a night yet recover as before. */
export function restFactor(state: GameState): number {
  if (!state.night) return 1;
  return NIGHT.restFloor + NIGHT.restSpan * (state.night.rest / 100);
}

function word(key: 'company' | 'rest' | 'prayer', v: number): string {
  for (const [floor, w] of content.words[key]) if (v >= floor) return w;
  return content.words[key][content.words[key].length - 1]![1];
}

/** The nights in words for the sheet, never numbers. */
export function nightWords(state: GameState): { company: string; rest: string; prayer: string } {
  const n = nightOf(state);
  return { company: word('company', n.company), rest: word('rest', n.rest), prayer: word('prayer', n.prayer) };
}

/** The week: the nights follow the evenings, the house, and the strain; rest and prayer pay a little; the alone weeks are counted. */
export function nightWeek(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  if (!state.character || (!state.parish && !(state.religious && state.flags.ordained))) return { state, line: null };
  const n = nightOf(state);
  const def = content.evenings[n.evenings];
  const friar = !!state.religious && !state.parish;
  const vicar = state.assignment?.role === 'parochial_vicar';
  const strain = strainOf(state);
  const target = {
    company: def.targets.company + (friar ? content.friar.company : 0) + (vicar ? 10 : 0),
    rest: def.targets.rest + (friar ? content.friar.rest : 0) - strain * 0.3,
    prayer: def.targets.prayer + (friar ? content.friar.prayer : 0) + (state.character.direction && state.character.direction.endedWeek === undefined ? 5 : 0),
  };
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const follow = (v: number, t: number) => clamp(v + (clamp(t) - v) * NIGHT.follow);
  const moved: NightState = {
    ...n,
    company: follow(n.company, target.company),
    rest: follow(n.rest, target.rest),
    prayer: follow(n.prayer, target.prayer),
    aloneWeeks: n.company < NIGHT.aloneCompany && strain >= NIGHT.aloneStrain ? n.aloneWeeks + 1 : Math.max(0, n.aloneWeeks - 1),
  };
  let next: GameState = { ...state, night: moved };
  if (moved.prayer >= NIGHT.prayerKept) next = applyEffects(next, [{ target: 'stat', key: 'piety', delta: NIGHT.prayerPiety }], {}, 'the night office');
  if (n.evenings === 'the_phone') next = applyEffects(next, [{ target: 'relationship', key: '@closest_classmate', delta: NIGHT.phoneWarmth }], {}, 'the phone at night');
  const line = def.lines.length && rng.chance(NIGHT.lineChance) ? rng.pick(def.lines) : null;
  return { state: next, line };
}

/** Whether a night scene is due: one a season, when the dice say. */
export function nightSceneDue(state: GameState, rng: Rng): boolean {
  const n = nightOf(state);
  if (n.sceneWeek !== undefined && state.clock.week - n.sceneWeek < NIGHT.sceneEveryWeeks) return false;
  return rng.chance(NIGHT.sceneChance);
}

export function markNightScene(state: GameState): GameState {
  return { ...state, night: { ...nightOf(state), sceneWeek: state.clock.week } };
}

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '==': return a === b;
    default: return false;
  }
}

export function nightCondition(state: GameState, cond: Extract<Condition, { type: 'night' }>): boolean {
  const n = nightOf(state);
  if (cond.key === 'evenings') return n.evenings === cond.value;
  const v = cond.key === 'alone_weeks' ? n.aloneWeeks : n[cond.key];
  return compare(cond.op, v, cond.value);
}

/** The review's line on the nights. */
export function nightReviewLine(state: GameState): string | null {
  if (!state.night) return null;
  const n = state.night;
  const w = nightWords(state);
  if (n.aloneWeeks >= 8) return content.review.alone.replace('{weeks}', String(n.aloneWeeks));
  return content.review.fine.replace('{company}', w.company).replace('{rest}', w.rest).replace('{prayer}', w.prayer);
}
