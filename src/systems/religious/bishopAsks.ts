import type { BishopAsk, BishopAskDef, Effect, GameState, Letter } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { dateOf, priesthoodYear } from '@/engine/time';
import { bishopAskDefs, horariumDefs, religiousOrder } from '@/content/religious';
import { currentHouse } from './house';
import { horariumLoad } from './horarium';
import { friendshipLoad } from './friendship';
import { needOf } from './obedience';
import { apostolateDef, directingLoad, houseOfficeLoad, pastorTaskLoad } from './requests';
import { currentPosting } from './transfer';
import { reputationOf } from './reputations';
import { confrereTaskLoad } from './confrereAsks';
import { electedOfficeLoad } from './priorDesk';
import { workLoad } from '@/systems/sidework';
import { commitmentAp } from '@/engine/offers';

/**
 * The bishop asks the order. E3 §3.11. A bishop may be fond of a friar and
 * of his order or not, but the order is in charge of him: the bishop cannot
 * assign him or give him a chancery post without asking the provincial,
 * and the provincial spares him, refuses, or lets him do both when the
 * week has room. This module is the only road from a bishop's wish to a
 * friar's work, and it never moves the man itself: the provincial's answer
 * comes first, and the friar's after it. Tunables are invented.
 */
export const BISHOP_ASKS = {
  /** Chance a year the bishop's office writes, at regard 0, plus per point of regard. */
  base: 0.06,
  perRegard: 0.004,
  /** Regard below which the bishop does not ask. */
  minRegard: 5,
  /** Years ordained before any bishop asks. */
  minYears: 2,
  /** A week's blocks, as the base game counts them; the horarium, the office, and the work come out of it. */
  /**
   * The diocesan week's 12 blocks are counted after the daily Mass, the Office, and meals (systems/week.ts);
   * a friar's common life is charged on the sheet, so his base carries it: 12 and the horarium at standard.
   * At standard he has the diocesan priest's week less his work; the minimum buys blocks back and the whole
   * house sees it; invested costs him. E3 §3.3.
   */
  weekBlocks: 12 + horariumDefs.reduce((n, d) => n + d.ap.standard, 0),
  /** The provincial will not spare a man from a house that needs him this much, or from formation work at all. */
  spareNeed: 55,
  /** Standing. */
  grace: {
    refused: [{ target: 'reputation', key: 'local_bishop', delta: -4 }, { target: 'reputation', key: 'superiors', delta: 2 }],
    accepted: [{ target: 'reputation', key: 'local_bishop', delta: 6 }],
    declined: [{ target: 'reputation', key: 'local_bishop', delta: -5 }, { target: 'reputation', key: 'superiors', delta: 2 }, { target: 'reputation', key: 'community', delta: 2 }],
  } as const,
  /** A bishop whose regard has fallen this far ends a work he appointed to, some years. */
  bishopEndsAt: -30,
  bishopEndsChance: 0.4,
} as const;

function yearsOrdained(state: GameState): number {
  const w = state.flags.ordination_week;
  return typeof w === 'number' ? priesthoodYear(state.clock.week, w).year : 0;
}

/** The blocks his week already owes: the common life, the friends, the office, the work. */
export function friarLoad(state: GameState): number {
  return horariumLoad(state) + friendshipLoad(state) + houseOfficeLoad(state) + electedOfficeLoad(state) + (apostolateDef(state)?.ap ?? 0) + pastorTaskLoad(state) + directingLoad(state) + confrereTaskLoad(state) + workLoad(state) + commitmentAp(state);
}

/** The asks a bishop's office could make of the provincial for this man now. */
export function eligibleAsks(state: GameState): BishopAskDef[] {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !state.flags.ordained) return [];
  const institutions = state.world?.diocese.visible.institutions ?? [];
  const order = religiousOrder(r.order);
  return bishopAskDefs.filter((d) => {
    if (r.apostolate?.id === (d.kind === 'chancery' ? `chancery:${d.office}` : d.apostolate)) return false;
    if (d.institution && !institutions.includes(d.institution as (typeof institutions)[number])) return false;
    if ((d.minYears ?? 0) > yearsOrdained(state)) return false;
    if (d.kind === 'apostolate' && !order.apostolates.some((a) => a.id === d.apostolate)) return false;
    for (const [k, v] of Object.entries(d.requires ?? {})) if (c.stats[k as keyof typeof c.stats] < (v ?? 0)) return false;
    return true;
  });
}

/**
 * The provincial reads the bishop's letter. Formation work and an office
 * held are never spared; a house that needs him is not; the week decides
 * whether he can do both; otherwise the province spares him from the work
 * he has, and the friar chooses.
 */
export function provincialAnswers(state: GameState, def: BishopAskDef): { answer: BishopAsk['answer']; why: string } {
  const r = state.religious;
  const house = currentHouse(state);
  const posting = currentPosting(state);
  if (!r || !house) return { answer: 'refused', why: 'the province has no house to spare him from' };
  const title = religiousOrder(r.order).governance.provincialTitle;
  if (r.office) return { answer: 'refused', why: `the ${r.office.office === 'prior' ? 'house elected him' : 'province elected him'}, and an elected man is not lent` };
  if (r.appointment) return { answer: 'refused', why: 'he holds an office of the province, and the province needs it kept' };
  if (posting?.work === 'formation' || house.kind === 'novitiate' || house.kind === 'studium') return { answer: 'refused', why: 'he is in formation work, which the province does not lend' };
  if ((state.character?.reputation.superiors ?? 0) < -25) return { answer: 'refused', why: `the ${title} would rather not do the bishop a favour with a man the council is not sure of` };
  const ap = def.kind === 'chancery' ? def.ap : (religiousOrder(r.order).apostolates.find((a) => a.id === def.apostolate)?.ap ?? def.ap);
  if (friarLoad(state) + ap <= BISHOP_ASKS.weekBlocks) return { answer: 'both', why: 'the week has room for it beside what he does, and the house will cover the rest' };
  const need = needOf(state, house, dateOf(state.clock).year);
  if (need >= BISHOP_ASKS.spareNeed) return { answer: 'refused', why: `${house.name} cannot spare him this year` };
  if (r.apostolate) return { answer: 'spared', why: `the province can spare him from ${r.apostolate.label.toLowerCase()}, if he will give it up for this` };
  return { answer: 'spared', why: 'the province can spare him for it' };
}

/** A year passes: the bishop's office may write. The ask lands on the table as a mode. */
export function bishopAskYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !state.flags.ordained || r.bishopAsk && !r.bishopAsk.outcome && r.bishopAsk.answer !== 'refused') return state;
  if (state.mode.kind !== 'clock' || yearsOrdained(state) < BISHOP_ASKS.minYears) return state;
  const regard = c.reputation.local_bishop ?? 0;
  if (regard < BISHOP_ASKS.minRegard) return state;
  const known = Math.max(0, ...bishopAskDefs.flatMap((d) => (d.reputations ?? []).map((k) => reputationOf(state, k))));
  if (!rng.chance(BISHOP_ASKS.base + regard * BISHOP_ASKS.perRegard + known * 0.002)) return state;
  const defs = eligibleAsks(state);
  if (!defs.length) return state;
  // Bishops ask for a man by what he is known for. E3 §8.3.
  const def = rng.weighted(defs, (d) => 1 + (d.reputations ?? []).reduce((n, k) => n + reputationOf(state, k), 0) / 40);
  const { answer, why } = provincialAnswers(state, def);
  const ap = def.kind === 'chancery' ? def.ap : (religiousOrder(r.order).apostolates.find((a) => a.id === def.apostolate)?.ap ?? def.ap);
  const ask: BishopAsk = { defId: def.id, label: def.label, dioceseId: state.world?.diocese.presetId ?? '', week: state.clock.week, ap, answer, why };
  let next: GameState = { ...state, religious: { ...r, bishopAsk: ask }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `The bishop's office wrote to the provincial asking for you as ${def.label.toLowerCase()}.` }] };
  if (answer === 'refused') next = applyEffects(next, [...BISHOP_ASKS.grace.refused], {}, 'the provincial refused the bishop');
  return { ...next, mode: { kind: 'bishop_ask' } };
}

/** The letter for the sheet: what the bishop wanted, and what the provincial said. */
export function bishopAskLetter(state: GameState): Letter | null {
  const r = state.religious;
  const ask = r?.bishopAsk;
  if (!r || !ask) return null;
  const def = bishopAskDefs.find((d) => d.id === ask.defId);
  const order = religiousOrder(r.order);
  const title = order.governance.provincialTitle;
  const bishop = state.world?.diocese.visible.bishop.name ?? 'The bishop';
  const body = [
    `${bishop}'s office wrote to the ${title}, not to you, asking for you as ${ask.label.toLowerCase()}. ${def?.line ?? ''}`,
    ask.answer === 'refused' ? `The ${title} has answered for the province: no, because ${ask.why}. The bishop's office has been told, courteously, and has been told by whom.` : ask.answer === 'both' ? `The ${title} writes that ${ask.why}. He leaves it to you: ${ask.ap} blocks a week beside what you do.` : `The ${title} writes that ${ask.why}. He leaves it to you, and it would mean laying down the work you have.`,
  ];
  return { sort: 'provincial', title: ask.answer === 'refused' ? `The ${title} said no to the bishop` : `The bishop asked the ${title} for you`, body, week: ask.week };
}

/** The friar answers what the provincial left to him. */
export function answerBishopAsk(state: GameState, accept: boolean): GameState {
  const r = state.religious;
  const ask = r?.bishopAsk;
  if (!r || !ask) return state;
  const def = bishopAskDefs.find((d) => d.id === ask.defId);
  const week = state.clock.week;
  if (ask.answer === 'refused' || !def) {
    const { bishopAsk: _gone, ...rest } = r;
    return { ...state, religious: { ...rest, bishopAsk: { ...ask, outcome: 'declined' } }, mode: { kind: 'clock' } };
  }
  if (!accept) {
    let next: GameState = { ...state, religious: { ...r, bishopAsk: { ...ask, outcome: 'declined' } }, career: [...state.career, { week, kind: 'note', text: `Asked the provincial to decline the bishop's request for you as ${ask.label.toLowerCase()}.` }] };
    next = applyEffects(next, [...BISHOP_ASKS.grace.declined], {}, "declining the bishop's ask");
    return { ...next, mode: { kind: 'clock' } };
  }
  const id = def.kind === 'chancery' ? `chancery:${def.office}` : def.apostolate!;
  const flags = { ...state.flags, [`apostolate:${id}`]: week, [`bishop_ask:${def.id}`]: week, ...(def.kind === 'chancery' ? { [`office:${def.office}`]: week } : {}) };
  if (r.apostolate) delete flags[`apostolate:${r.apostolate.id}`];
  let next: GameState = {
    ...state,
    flags,
    religious: { ...r, bishopAsk: { ...ask, outcome: 'accepted' }, apostolate: { id, dioceseId: ask.dioceseId, label: ask.label, startWeek: week } },
    career: [...state.career, { week, kind: 'assignment', text: `${ask.label}, at the bishop's request and with the provincial's leave${ask.answer === 'spared' && r.apostolate ? `, in place of ${r.apostolate.label.toLowerCase()}` : ''}. ${def.line}` }],
  };
  next = applyEffects(next, [...BISHOP_ASKS.grace.accepted], {}, "the bishop's ask taken");
  return { ...next, mode: { kind: 'clock' } };
}

/** The definition a chancery work was taken from, for the week's effects and the sheet. */
export function chanceryAskDef(state: GameState): BishopAskDef | undefined {
  const id = state.religious?.apostolate?.id;
  if (!id?.startsWith('chancery:')) return undefined;
  return bishopAskDefs.find((d) => d.kind === 'chancery' && `chancery:${d.office}` === id);
}

/** One week of a chancery post: its small effects. The order's apostolates carry their own in requestsWeek. */
export function chanceryWeek(state: GameState): GameState {
  const def = chanceryAskDef(state);
  if (!def?.weekly?.length) return state;
  const effects = def.weekly.map((e) => ({ target: e.target as Effect['target'], key: e.key, delta: e.delta }) as Effect);
  return applyEffects(state, effects, {}, 'the chancery week');
}
