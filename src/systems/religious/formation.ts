import type { FormationStage, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';
import { applyEffects } from '@/engine/effects';
import { currentHouse, membersOf } from './house';
import { moveToHouse } from './transfer';

/**
 * Seven years of formation as an order shapes them, on the seminary engine:
 * the years, the evaluations, the emphasis, and the beats are the base
 * game's; the labels, the houses, and the milestones are the order's data.
 * E3 §5. Vows are the milestones; the community votes on a profession.
 * Tunables are invented.
 */
export const VOWS = {
  /** The share of the house's professed who must be for him. */
  majority: 0.5,
  /** Fewer professed than this in the house, and the council votes too. */
  quorum: 4,
  /** What a member's regard adds to his chance of voting yes, across −100..100. */
  regardSwing: 0.3,
  /** What his standing with the house as a whole adds, across −100..100. */
  communitySwing: 0.2,
  /** The novice master or master of students speaks first at the chapter: his regard moves every vote, across −100..100. */
  guideSwing: 0.15,
  /** Base chance a member votes yes, before regard and the year's evaluation: a house professes the men it has formed unless it has a reason. */
  base: 0.78,
  /** The evaluation's weight: this year's concerns pull the vote down, at most so many of them; the old years' concerns are the old years'. */
  concern: -0.06,
  concernsCounted: 3,
  /** A man the house held back once has been watched a year longer: a little easier the next time, not harder. */
  watchedAgain: 0.05,
  /** Each man's own reading of him, either way: a vote is the house's regard with some noise in it, not a lottery. */
  jitter: 0.3,
  /** Standing when professed, and when a vote is close. */
  professed: [{ target: 'reputation', key: 'community', delta: 6 }, { target: 'reputation', key: 'province', delta: 3 }, { target: 'stat', key: 'piety', delta: 2 }],
  solemn: [{ target: 'reputation', key: 'community', delta: 8 }, { target: 'reputation', key: 'province', delta: 6 }, { target: 'stat', key: 'piety', delta: 4 }],
} as const;

/** The stage the man is in now: the order's line for this year of formation. */
export function formationStage(state: GameState): FormationStage | undefined {
  const r = state.religious;
  const year = state.seminary?.year;
  if (!r || !year) return undefined;
  return religiousOrder(r.order).formation.find((s) => s.year === year);
}

/** The guide's title for the year: the novice master, the master of students. */
export function formationGuide(state: GameState): string {
  return formationStage(state)?.guide ?? 'rector';
}

export interface VowVote {
  yes: number;
  no: number;
  passed: boolean;
}

/** The house's professed vote on a profession or a renewal. Deterministic from the rng. */
export function communityVote(state: GameState, rng: Rng): VowVote {
  const house = currentHouse(state);
  let voters = house ? membersOf(state, house).filter((m) => m.tags.includes('vows:solemn')) : [];
  // A formation house with too few professed does not decide alone: the provincial's council votes with it.
  if (voters.length < VOWS.quorum && state.province) {
    const council = state.province.councilIds.map((id) => state.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n && n.status === 'active' && !voters.some((v) => v.id === n.id));
    voters = [...voters, ...council];
  }
  // This year's concerns, not every concern ever written; a house votes on the year it has watched.
  const all = state.seminary?.concerns.length ?? 0;
  const before = Number(state.flags.concerns_at_year_start ?? 0);
  const concerns = Math.min(VOWS.concernsCounted, Math.max(0, all - Math.min(all, before)));
  const community = ((state.character?.reputation.community ?? 0) / 100) * VOWS.communitySwing;
  const guideTag = formationStage(state)?.house === 'novitiate' ? 'novice_master' : 'master_of_students';
  const guide = house ? membersOf(state, house).find((m) => m.tags.includes(guideTag)) : undefined;
  const guideWord = guide ? (guide.relationship / 100) * VOWS.guideSwing : 0;
  const watched = state.flags['vows:refused'] !== undefined ? VOWS.watchedAgain : 0;
  let yes = 0;
  for (const v of voters) {
    const p = VOWS.base + (v.relationship / 100) * VOWS.regardSwing + community + guideWord + concerns * VOWS.concern + watched;
    if (p + rng.float(-VOWS.jitter, VOWS.jitter) > 0.5) yes++;
  }
  const no = voters.length - yes;
  return { yes, no, passed: voters.length === 0 || yes / voters.length > VOWS.majority };
}

/**
 * The year ends: the milestone the order sets for it. A profession or a
 * renewal is voted; a vote against holds the man back a year (the base
 * game's HELD_BACK, with the community as the reason). Returns the state
 * and what happened, for the year's letter.
 */
export function formationYearEnd(state: GameState, rng: Rng): { state: GameState; line: string; heldBack: boolean } {
  const r = state.religious;
  const stage = formationStage(state);
  if (!r || !stage) return { state, line: '', heldBack: false };
  const week = state.clock.week;
  let next = state;
  if (stage.milestone === 'simple_profession' || stage.milestone === 'renewal' || stage.milestone === 'solemn_profession') {
    const vote = stage.communityVote ? communityVote(next, rng.derive(`vote:${week}`)) : { yes: 1, no: 0, passed: true };
    if (!vote.passed) {
      // Held back by the house, not by the evaluation: the year repeats and the house watches; no concern is written, since one would only feed the next vote.
      next = { ...next, flags: { ...next.flags, 'vows:refused': week } };
      return { state: next, line: `The house voted, ${vote.yes} to ${vote.no}, and not for you. Another year, and the question again.`, heldBack: true };
    }
    if (stage.milestone === 'simple_profession') {
      next = { ...next, religious: { ...r, vows: { ...r.vows, simpleWeek: week } }, flags: { ...next.flags, 'vows:simple': week } };
      next = applyEffects(next, [...VOWS.professed], {}, 'first profession');
      return { state: next, line: `Simple profession, ${vote.no ? `the house ${vote.yes} to ${vote.no}` : 'the house of one mind'}.`, heldBack: false };
    }
    if (stage.milestone === 'renewal') {
      next = { ...next, religious: { ...r, vows: { ...r.vows, renewals: [...r.vows.renewals, week] } }, flags: { ...next.flags, 'vows:renewed': week } };
      return { state: next, line: `Vows renewed${stage.communityVote ? `, the house ${vote.yes} to ${vote.no}` : ''}.`, heldBack: false };
    }
    next = { ...next, religious: { ...r, vows: { ...r.vows, solemnWeek: week } }, flags: { ...next.flags, 'vows:solemn': week } };
    next = applyEffects(next, [...VOWS.solemn], {}, 'solemn profession');
    return { state: next, line: 'Solemn profession, kneeling before the provincial: the point of no return.', heldBack: false };
  }
  if (stage.milestone === 'clothing') return { state: { ...next, flags: { ...next.flags, 'vows:clothed': week } }, line: 'Clothed with the habit.', heldBack: false };
  if (stage.milestone === 'diaconate') return { state: { ...next, flags: { ...next.flags, diaconate: week } }, line: 'Ordained deacon.', heldBack: false };
  return { state: next, line: '', heldBack: false };
}

/** The year opens: if the order lives this year in another kind of house, he moves there. */
export function formationYearStart(state: GameState): GameState {
  const r = state.religious;
  const stage = formationStage(state);
  if (!r || !stage?.house) return state;
  const here = currentHouse(state);
  if (here?.kind === stage.house) return state;
  const target = Object.values(state.orderHouses ?? {}).find((h) => h.provinceId === r.provinceId && h.kind === stage.house);
  if (!target) return state;
  return moveToHouse(state, target.id, 'formation');
}

/** Whether he is solemnly professed: the point of no return passed. */
export function solemnlyProfessed(state: Pick<GameState, 'religious'>): boolean {
  return !!state.religious?.vows.solemnWeek;
}
