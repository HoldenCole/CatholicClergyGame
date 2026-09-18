import type { GameState, SideWorkDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { sideWorkDef, sideWorkDefs } from '@/content/parish';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { describeUnmet } from './doors';

/**
 * The thing a priest does besides the parish. DESIGN.md §8.8.
 *
 * A book, an hour on the radio, a lecture series, a translation, a
 * pilgrimage, Thursday mornings at the county jail. One at a time, an hour or
 * two of every week for years, milestones along the way, and an ending that is
 * not guaranteed: some of them come to nothing, and coming to nothing is also
 * a thing that happened to a man.
 */
export const SIDE_WORK = {
  /** The chance a risky work fails is rolled once, at the end. */
  failAt: 1,
} as const;

export function workOf(state: GameState): { state: NonNullable<GameState['sideWork']>; def: SideWorkDef } | null {
  const w = state.sideWork;
  const def = w ? sideWorkDef(w.id) : undefined;
  return w && def ? { state: w, def } : null;
}

export interface WorkOffer {
  def: SideWorkDef;
  available: boolean;
  why: string;
}

/** Everything he could take on, and what stands in the way of each. */
export function workOffers(state: GameState): WorkOffer[] {
  return sideWorkDefs.map((def) => {
    const why =
      !state.parish ? 'Not from where you are' :
      state.sideWork ? 'You have one in hand' :
      def.requires && !evaluateAll(def.requires, state) ? `needs ${def.requires.map((c) => describeUnmet(c, state)).find((w): w is string => !!w) ?? 'something else'}` :
      '';
    return { def, available: !why, why };
  });
}

/** Take it on. The hours come off every week from now until it is done. */
export function startWork(state: GameState, id: string): GameState {
  const offer = workOffers(state).find((o) => o.def.id === id);
  if (!offer?.available) throw new Error(offer?.why || 'not that one');
  const def = offer.def;
  return {
    ...state,
    sideWork: { id, startWeek: state.clock.week, endWeek: state.clock.week + def.weeks, passed: [] },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Took on ${def.label.toLowerCase()}.` }],
  };
}

/** Put it down. Nobody is told and it is in the drawer for the rest of his life. */
export function dropWork(state: GameState): { state: GameState; line: string | null } {
  const w = workOf(state);
  if (!w) return { state, line: null };
  const done = Math.round(((state.clock.week - w.state.startWeek) / Math.max(1, w.def.weeks)) * 100);
  return {
    state: {
      ...state,
      sideWork: null,
      flags: { ...state.flags, [`work:dropped:${w.def.id}`]: true },
      career: [...state.career, { week: state.clock.week, kind: 'note', text: `Put down ${w.def.label.toLowerCase()}, ${done}% of the way in.` }],
    },
    line: `You have stopped work on ${w.def.label.toLowerCase()}. Nobody is told, because nobody was watching, and the hours go back into the parish where they were always needed.`,
  };
}

/** Blocks of the week it takes, for the plan. */
export function workLoad(state: GameState): number {
  return workOf(state)?.def.apPerWeek ?? 0;
}

/** One week of it: a milestone may pass, and at the end it lands or it does not. */
export function sideWorkWeek(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const w = workOf(state);
  if (!w) return { state, line: null };
  const { def } = w;
  const elapsed = state.clock.week - w.state.startWeek;
  const share = elapsed / Math.max(1, def.weeks);
  // Milestones, in order, at their fraction of the way through.
  for (let i = 0; i < def.milestones.length; i++) {
    const m = def.milestones[i]!;
    if (w.state.passed.includes(i) || share < m.at) continue;
    const next = applyEffects(state, m.effects, {}, def.label);
    return { state: { ...next, sideWork: { ...w.state, passed: [...w.state.passed, i] } }, line: m.line };
  }
  if (state.clock.week < w.state.endWeek) return { state, line: null };
  // The end: the risk is rolled once, and a man who has built the right thing is spared it.
  const fails = !!def.risk && (!def.risk.unless || !evaluateAll(def.risk.unless, state)) && rng.chance(def.risk.chance);
  const result = fails ? def.risk! : def.done;
  let next = applyEffects(state, result.effects, {}, def.label);
  next = {
    ...next,
    sideWork: null,
    career: [...next.career, { week: next.clock.week, kind: 'note', text: fails ? `${def.label}: it came to nothing.` : `${def.label}: finished.` }],
  };
  return { state: next, line: result.line };
}

/** Where it stands, for the sheet. */
export function workLine(state: GameState): string | null {
  const w = workOf(state);
  if (!w) return null;
  const left = Math.max(0, w.state.endWeek - state.clock.week);
  const years = Math.round((left / 52) * 10) / 10;
  return `${w.def.label}: ${years >= 1 ? `about ${years} year${years === 1 ? '' : 's'} of it left` : `${left} weeks left`}, at an hour or two a week.`;
}

/** What he has made of himself outside the parish, for the profile and the ending. */
export function worksDone(state: GameState): string[] {
  const out: string[] = [];
  for (const [flag, line] of Object.entries(DONE_WORDS)) if (state.flags[flag]) out.push(line);
  return out;
}

const DONE_WORDS: Record<string, string> = {
  'work:published': 'wrote a book',
  'work:unpublished': 'wrote a book nobody would publish',
  'work:broadcast': 'had an hour on the radio for three years',
  'work:taken_off_air': 'was taken off the air',
  'work:lecturer': 'gave the lecture series around the diocese',
  'work:translated': 'translated a text nobody else would',
  'work:pilgrimage': 'took forty-one of his people to the Holy Land',
  'work:prison': 'went to the county jail on Thursdays for four years',
  'work:board': 'sat on the hospital board',
  'work:retreat_preacher': 'preached retreats in other men\'s parishes',
};
