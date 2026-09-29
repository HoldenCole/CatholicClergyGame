import type { GameState, Letter, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { currentHouse, membersOf, nudgeHouse, playerIsPrior, playerIsProvincial, priorOf } from './house';
import { ruleOf } from './priorDesk';
import { deliverLetter } from '@/systems/review';

/**
 * Cohesion and observance with teeth (friar round D4). E3 §3.2. A house at
 * odds with itself loses men (growth.ts reads the cohesion when men leave
 * or ask to be moved); a house whose observance has drifted brings the
 * provincial's visitation; a prior's rule that moves the house rubs the
 * men it moves against him. The flags the scenes read are set here each
 * week. Tunables invented.
 */
export const TEETH = {
  /** Below this the house is thin: men leave and ask to be moved more, and the scenes say so. */
  cohesionLow: 35,
  /** Below this the observance has drifted and the provincial comes. */
  observanceLow: 30,
  /** Weeks between visitations of one house. */
  visitEvery: 104,
  /** What the visitation does: observance up, cohesion down, and the prior answers for it. */
  visit: { observance: 10, cohesion: -3, priorCommunity: -3, priorSuperiors: -4 },
  /** The prior's rule rubs the men it moves against him: regard a week per man of the other mind, per ten points still to go. */
  rubRegard: -0.12,
  /** How far off the rule a man's alignment must be to mind it. */
  rubMind: 20,
} as const;

/** The house's state as flags the scenes read: house:cohesion:low, house:observance:low, rule:rubs. */
export function houseFlagsWeek(state: GameState): GameState {
  const house = currentHouse(state);
  if (!house || !state.religious) return state;
  const flags = { ...state.flags };
  const set = (k: string, on: boolean) => { if (on) flags[k] = true; else delete flags[k]; };
  set('house:cohesion:low', house.cohesion < TEETH.cohesionLow);
  set('house:observance:low', house.observance < TEETH.observanceLow);
  const rule = ruleOf(house);
  set('rule:rubs', !!rule && playerIsPrior(state, house) && Math.abs(rule.observance - house.observance) >= 10);
  const visited = typeof flags['provincial:visited'] === 'number' ? flags['provincial:visited'] : null;
  set('provincial:visited:recent', visited !== null && state.clock.week - visited <= 12);
  return { ...state, flags };
}

/** A man's mind about the rule: the observant dislike loosening, the adapted dislike tightening. */
function minds(rule: number, house: number, n: Npc): boolean {
  const tightening = rule > house;
  return tightening ? n.alignment > TEETH.rubMind : n.alignment < -TEETH.rubMind;
}

/** The prior's rule, felt by the men: those of the other mind cool toward the prior moving the house. */
export function ruleRubsWeek(state: GameState): GameState {
  const house = currentHouse(state);
  const rule = house ? ruleOf(house) : undefined;
  if (!house || !rule || !playerIsPrior(state, house)) return state;
  const gap = rule.observance - house.observance;
  if (Math.abs(gap) < 10) return state;
  const tens = Math.abs(gap) / 10;
  const npcs = { ...state.npcs };
  let changed = false;
  for (const n of membersOf(state, house)) {
    if (!minds(rule.observance, house.observance, n)) continue;
    npcs[n.id] = { ...n, relationship: Math.max(-100, n.relationship + TEETH.rubRegard * tens) };
    changed = true;
  }
  return changed ? { ...state, npcs } : state;
}

/**
 * The year: a house whose observance has drifted is visited by the
 * provincial (the letter comes; the house tidies; the prior answers for it).
 * A provincial is not visited by himself: his council writes instead.
 */
export function houseTeethYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house || !state.flags.ordained || state.study) return state;
  const week = state.clock.week;
  if (house.observance >= TEETH.observanceLow) return state;
  const last = typeof state.flags['provincial:visited'] === 'number' ? state.flags['provincial:visited'] : -Infinity;
  if (week - last < TEETH.visitEvery) return state;
  void rng;
  let next = nudgeHouse(state, house.id, { observance: TEETH.visit.observance, cohesion: TEETH.visit.cohesion });
  next = { ...next, flags: { ...next.flags, 'provincial:visited': week } };
  const mine = playerIsPrior(state, house);
  const prior = priorOf(state, house);
  const provincial = state.province ? state.npcs[state.province.provincialId] : undefined;
  const whoVisits = playerIsProvincial(state) ? 'the council, in your place,' : provincial ? `${provincial.title} ${provincial.name.last}` : 'the provincial';
  const body = [
    `${whoVisits} came for three days: the books, the chapter, every man alone for a quarter of an hour. The finding was what the house knew: the Office when enough men are home, the habit seldom, the table thin. The house tidied for the week and remembers that someone came.`,
    mine ? 'You are the prior, and the letter that followed was addressed to you: the observance is yours to answer for, and the province has written down that it asked.' : prior ? `${prior.title} ${prior.name.last}, as prior, had the letter that followed, and read it at chapter without comment, which was the comment.` : 'The letter that followed went to the house, since it had no prior to send it to.',
  ];
  if (mine) next = applyEffects(next, [{ target: 'reputation', key: 'community', delta: TEETH.visit.priorCommunity }, { target: 'reputation', key: 'superiors', delta: TEETH.visit.priorSuperiors }], {}, 'the visitation');
  const letter: Letter = { sort: 'provincial', title: `The visitation of ${house.name}`, body, week };
  next = { ...next, career: [...next.career, { week, kind: 'note', text: `${house.name} was visited by the provincial: the observance had drifted.` }] };
  return deliverLetter(next, letter);
}
