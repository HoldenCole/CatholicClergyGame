import type { GameState, Letter, SeeState } from '@/types';
import type { Rng } from './rng';
import { seeDefs } from '@/content/sees';
import type { FormerSee } from '@/types';
import { clampSigned } from '@/systems/reputation';

/** Invented. The last act: a small see, held until the letter at seventy-five. */
export const SEE = {
  /** Each dial drifts toward zero a little every year: a diocese forgets. */
  driftPerYear: 4,
  /** Ordinations a year at shortage 1 .. 5, before the vocations work adds to it. */
  ordinationsBase: [2, 1.5, 1, 0.6, 0.3] as const,
  /** Closings forced a year when the shortage is critical and nobody has begun them. */
  closingsForced: 1,
} as const;

function word(v: number): string {
  return v >= 50 ? 'devoted' : v >= 20 ? 'warm' : v > -20 ? 'watchful' : v > -50 ? 'cool' : 'against you';
}
const SHORTAGE_WORD = ['a deep bench', 'enough priests, barely', 'short', 'badly short', 'critically short'];

export function shortageWord(n: number): string {
  return SHORTAGE_WORD[Math.max(0, Math.min(4, Math.round(n) - 1))]!;
}
export function moneyWord(v: number): string {
  return v >= 40 ? 'sound' : v >= 0 ? 'tight' : v >= -50 ? 'in the red' : 'in crisis';
}
export function regardWord(v: number): string {
  return word(v);
}

/** The weight of each see in the pool: small ones first, the great ones on a translation or for a man Rome has watched. Invented. */
export const SEE_POOL = { small: 3, greatFirst: 0.35, greatFirstWatched: 1.2, greatTranslation: 3, smallTranslation: 0.4, watchedRome: 50 } as const;

/** What the see he leaves becomes on the record. */
export function formerOf(state: GameState, see: SeeState): FormerSee {
  return { id: see.id, name: see.name, see: see.see, region: see.region, years: Math.max(0, Math.round((state.clock.week - see.installedWeek) / 52)), ordinations: see.ordinations, closings: see.closings };
}

/** A see from the pool, never the home diocese and never the one he holds, its dials rolled around the pool's leans. */
export function generateSee(state: GameState, rng: Rng): SeeState {
  const home = state.world?.diocese.presetId;
  const current = state.see;
  const translation = !!current;
  const watched = (state.character?.reputation.rome ?? 0) >= SEE_POOL.watchedRome;
  const pool = seeDefs.filter((d) => d.id !== home && d.id !== current?.id);
  const def = rng.weighted(pool, (d) => (d.great ? (translation ? SEE_POOL.greatTranslation : watched ? SEE_POOL.greatFirstWatched : SEE_POOL.greatFirst) : translation ? SEE_POOL.smallTranslation : SEE_POOL.small));
  const lean = def.leans ?? {};
  const roll = (k: keyof NonNullable<typeof def.leans>, spread: number) => Math.round((lean[k] ?? 0) * 25 + rng.gaussian() * spread);
  return {
    id: def.id,
    name: def.name,
    see: def.see,
    region: def.region,
    installedWeek: state.clock.week,
    presbyterate: clampSigned(roll('presbyterate', 12)),
    people: clampSigned(roll('people', 12)),
    rome: clampSigned(roll('rome', 10) + Math.round(state.character!.reputation.rome / 4)),
    money: clampSigned(roll('money', 15)),
    shortage: Math.max(1, Math.min(5, 3 + Math.round((lean.shortage ?? 0) + rng.gaussian() * 0.8))),
    ordinations: 0,
    closings: 0,
    years: [],
    ...(current ? { former: [...(current.former ?? []), formerOf(state, current)] } : {}),
  };
}

/** A week of the bishop's routine moves the dials by the hours given. */
export function applySeeHours(see: SeeState, deltas: Partial<Record<'presbyterate' | 'people' | 'rome' | 'money' | 'shortage', number>>, hours: number): SeeState {
  const next = { ...see };
  for (const [k, d] of Object.entries(deltas) as [keyof typeof deltas, number][]) {
    if (k === 'shortage') next.shortage = Math.max(1, Math.min(5, next.shortage + d * hours));
    else next[k] = clampSigned(next[k] + d * hours);
  }
  return next;
}

/** Once a year: ordinations, closings the arithmetic forces, drift, and the line for the record. */
export function seeYear(state: GameState, rng: Rng): { state: GameState; letter: Letter } {
  const see = state.see!;
  const years = Math.round((state.clock.week - see.installedWeek) / 52);
  const vocationsHours = state.study?.hoursLogged.see_seminary ?? 0;
  const ordained = Math.round(SEE.ordinationsBase[Math.max(0, Math.min(4, see.shortage - 1))]! + vocationsHours / 104 + (rng.chance(0.5) ? 0 : -0.5) + (rng.chance(0.3) ? 1 : 0));
  const began = !!state.flags.bp_began_closings;
  const forced = see.shortage >= 5 && !began ? SEE.closingsForced : 0;
  const drift = (v: number) => (Math.abs(v) <= SEE.driftPerYear ? 0 : v > 0 ? v - SEE.driftPerYear : v + SEE.driftPerYear);
  const next: SeeState = {
    ...see,
    presbyterate: drift(see.presbyterate) - forced * 3,
    people: drift(see.people) - forced * 5,
    rome: drift(see.rome),
    money: clampSigned(drift(see.money) + (see.shortage >= 4 ? -3 : 0)),
    shortage: Math.max(1, Math.min(5, see.shortage - (ordained >= 2 ? 0.3 : 0) + (rng.chance(0.4) ? 0.2 : 0))),
    ordinations: see.ordinations + Math.max(0, ordained),
    closings: see.closings + forced,
  };
  const line = `Year ${years}: ${ordained > 0 ? `${ordained} ordained` : 'no one ordained'}; ${forced ? 'a parish closed because there was no one to send' : 'no parish closed'}; the priests ${word(next.presbyterate)}, the people ${word(next.people)}, Rome ${word(next.rome)}, the money ${moneyWord(next.money)}.`;
  const letter: Letter = {
    sort: 'review',
    title: `${next.name}: year ${years}`,
    body: [
      `${years === 1 ? 'A year' : `${years} years`} in the chair. The diocese is ${shortageWord(next.shortage)} of priests${next.ordinations ? `; you have ordained ${next.ordinations}` : ''}${next.closings ? ` and closed ${next.closings} parish${next.closings === 1 ? '' : 'es'}` : ''}.`,
      `The priests are ${word(next.presbyterate)}. The people are ${word(next.people)}. Rome is ${word(next.rome)}. The money is ${moneyWord(next.money)}.`,
      ordained > 0 ? `${ordained === 1 ? 'One man' : `${ordained} men`} ordained this year, which in a see like this is the whole future.` : 'No ordinations this year. Every priest of the diocese is a year older.',
      forced ? 'A parish closed this year because there was no one to send, and you had not begun the closings yourself; the town blames the bishop, which is the job.' : '',
    ].filter(Boolean),
    rows: [{ label: 'The see', value: `${next.name}, ${next.region}` }],
    week: state.clock.week,
  };
  return { state: { ...state, see: { ...next, years: [...next.years, line] } }, letter };
}
