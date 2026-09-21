import type { ApostolateDef, Effect, GameState, HouseOfficeDef, Letter, OrderHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { dateOf, priesthoodYear } from '@/engine/time';
import { religiousOrder } from '@/content/religious';
import { currentHouse, houseById, houseLine, priorOf } from './house';
import { needOf, fitOf } from './obedience';
import { currentPosting, moveToHouse } from './transfer';

/**
 * Asking for a work. E3 §3.10. Two roads: an office of the house is asked
 * of the prior at the table and answered there; a work beyond the house's
 * own is asked of the provincial by letter, and the letter is answered in
 * weeks, against the province's need, the man's fit, and how often he has
 * written. Both are data on the order (houseOffices, apostolates); the
 * local works are drawn from the institutions the generated diocese holds.
 * Tunables are invented.
 */
export const REQUESTS = {
  /** Weeks the provincial takes to answer. */
  waitWeeks: [4, 10] as [number, number],
  /** Weeks in the posting before the provincial reads a letter about leaving it. */
  minWeeksInPost: 52,
  /** Standing with the provincial's council lost for each letter past the first in five years. */
  superiorsPerExtra: -3,
  askedWindowWeeks: 52 * 5,
  /** What moves the provincial's yes, added to a base. */
  chance: {
    base: 0.3,
    perFit: 0.004,
    perNeed: 0.003,
    perSuperiors: 0.004,
    perExtraAsk: -0.1,
    /** A local work the bishop appoints to: his regard counts too. */
    perBishop: 0.002,
    floor: 0.05,
    ceiling: 0.92,
  },
  /** The prior's yes to an office of the house. */
  prior: { base: 0.45, perFit: 0.004, perRelationship: 0.003, perCommunity: 0.002, refusedAgainAfterWeeks: 26 },
  /** A house office laid down before a year is remembered. */
  resignedEarlyWeeks: 52,
} as const;

export interface HouseOfficeOffer {
  def: HouseOfficeDef;
  available: boolean;
  why: string;
}

export interface ApostolateOffer {
  def: ApostolateDef;
  /** kind house: the house it would move him to. */
  houseId?: string;
  label: string;
  available: boolean;
  why: string;
}

function yearsOrdained(state: GameState): number {
  const w = state.flags.ordination_week;
  return typeof w === 'number' ? priesthoodYear(state.clock.week, w).year : 0;
}

/** How the man suits a work, 0..100, from the floors the definition names. */
function fitFor(state: GameState, requires: Partial<Record<string, number>> | undefined): number {
  const s = state.character?.stats;
  if (!s) return 50;
  const keys = Object.keys(requires ?? {}) as (keyof typeof s)[];
  if (!keys.length) return 55;
  return Math.round(keys.reduce((n, k) => n + Math.min(100, (s[k] / Math.max(1, requires![k] ?? 1)) * 60), 0) / keys.length);
}

function shortOf(state: GameState, requires: Partial<Record<string, number>> | undefined): string | null {
  const s = state.character?.stats;
  if (!s) return 'no one';
  for (const [k, v] of Object.entries(requires ?? {})) if (s[k as keyof typeof s] < (v ?? 0)) return k;
  return null;
}

// ---- Offices of the house ----

export function houseOfficeOffers(state: GameState): HouseOfficeOffer[] {
  const r = state.religious;
  if (!r) return [];
  const order = religiousOrder(r.order);
  const week = state.clock.week;
  return order.houseOffices.map((def) => {
    if (r.houseOffice?.id === def.id) return { def, available: false, why: 'Held now' };
    if (r.houseOffice) return { def, available: false, why: 'One office of the house at a time' };
    if (def.ordained && !state.flags.ordained) return { def, available: false, why: 'For a priest of the house' };
    if (def.vows === 'solemn' && r.vows.solemnWeek === undefined) return { def, available: false, why: 'After solemn profession' };
    if (def.vows === 'simple' && r.vows.simpleWeek === undefined) return { def, available: false, why: 'After first profession' };
    const refused = state.flags[`house_office:refused:${def.id}`];
    if (typeof refused === 'number' && week - refused < REQUESTS.prior.refusedAgainAfterWeeks) return { def, available: false, why: 'The prior said no this year' };
    const short = shortOf(state, def.requires);
    if (short) return { def, available: false, why: `The prior wants more ${short}` };
    return { def, available: true, why: '' };
  });
}

/** The prior answers at the table. */
export function askHouseOffice(state: GameState, id: string, rng: Rng): { state: GameState; line: string } {
  const r = state.religious;
  const house = currentHouse(state);
  const offer = houseOfficeOffers(state).find((o) => o.def.id === id);
  if (!r || !house || !offer?.available) return { state, line: '' };
  const prior = priorOf(state, house);
  const c = state.character!;
  const p = REQUESTS.prior;
  const chance = Math.max(0.05, Math.min(0.95, p.base + fitFor(state, offer.def.requires) * p.perFit + (prior?.relationship ?? 0) * p.perRelationship + (c.reputation.community ?? 0) * p.perCommunity));
  const week = state.clock.week;
  const who = prior ? `${prior.title} ${prior.name.last}` : 'The prior';
  if (!rng.chance(chance)) {
    const flags = { ...state.flags, [`house_office:refused:${id}`]: week };
    const next = { ...state, flags, career: [...state.career, { week, kind: 'note' as const, text: `Asked the prior to be ${offer.def.label.toLowerCase()}; he said not yet.` }] };
    return { state: next, line: `${who} says the house has managed without one, or that he has someone in mind, and that you should ask again in a while.` };
  }
  const flags = { ...state.flags, [`house_office:${id}`]: week };
  const next: GameState = { ...state, flags, religious: { ...r, houseOffice: { id, startWeek: week } }, career: [...state.career, { week, kind: 'promotion' as const, text: `Named ${offer.def.label.toLowerCase()} of ${house.name}.` }] };
  return { state: next, line: `${who} says yes before you have finished asking. ${offer.def.line}` };
}

/** Laid down. Before a year, the house remembers it. */
export function resignHouseOffice(state: GameState): GameState {
  const r = state.religious;
  if (!r?.houseOffice) return state;
  const def = religiousOrder(r.order).houseOffices.find((o) => o.id === r.houseOffice!.id);
  const early = state.clock.week - r.houseOffice.startWeek < REQUESTS.resignedEarlyWeeks;
  const { houseOffice, ...rest } = r;
  const flags = { ...state.flags };
  delete flags[`house_office:${houseOffice.id}`];
  let next: GameState = { ...state, flags, religious: rest, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Laid down the office of ${def?.label.toLowerCase() ?? 'the house'}${early ? ', early' : ''}.` }] };
  if (early) next = applyEffects(next, [{ target: 'reputation', key: 'community', delta: -4 }], {}, 'an office of the house laid down early');
  return next;
}

export function houseOfficeDef(state: GameState): HouseOfficeDef | undefined {
  const r = state.religious;
  return r?.houseOffice ? religiousOrder(r.order).houseOffices.find((o) => o.id === r.houseOffice!.id) : undefined;
}

export function houseOfficeLoad(state: GameState): number {
  return houseOfficeDef(state)?.ap ?? 0;
}

// ---- Apostolates: the letter to the provincial ----

export function apostolateDef(state: GameState): ApostolateDef | undefined {
  const r = state.religious;
  return r?.apostolate ? religiousOrder(r.order).apostolates.find((a) => a.id === r.apostolate!.id) : undefined;
}

export function apostolateLoad(state: GameState): number {
  return apostolateDef(state)?.ap ?? 0;
}

/** The houses of the province a work of that kind could be asked for, the current one never among them. */
function housesOfKind(state: GameState, kind: string): OrderHouse[] {
  const r = state.religious;
  if (!r || !state.orderHouses) return [];
  return Object.values(state.orderHouses).filter((h) => h.provinceId === r.provinceId && h.kind === kind && h.id !== r.houseId).sort((a, b) => a.id.localeCompare(b.id));
}

/** The works he may write to the provincial for now, and why not. */
export function apostolateOffers(state: GameState): ApostolateOffer[] {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !state.flags.ordained) return [];
  const order = religiousOrder(r.order);
  const posting = currentPosting(state);
  const weeksIn = posting ? state.clock.week - posting.startWeek : 0;
  const standing = r.request && r.request.outcome === undefined;
  const institutions = state.world?.diocese.visible.institutions ?? [];
  const out: ApostolateOffer[] = [];
  for (const def of order.apostolates) {
    const gate = (): string => {
      if (standing) return 'A letter already stands';
      if (r.office || r.appointment) return 'Not while an office is held';
      if ((def.minYears ?? 0) > yearsOrdained(state)) return `Not before ${def.minYears} years ordained`;
      const short = shortOf(state, def.requires);
      if (short) return `The provincial would want more ${short}`;
      if ((c.reputation.superiors ?? 0) < -20) return 'The provincial does not trust him';
      return '';
    };
    if (def.kind === 'local') {
      const label = def.label;
      if (r.apostolate?.id === def.id) { out.push({ def, label, available: false, why: 'Held now' }); continue; }
      if (r.apostolate) { out.push({ def, label, available: false, why: 'One work beyond the house at a time' }); continue; }
      if (def.institution && !institutions.includes(def.institution as (typeof institutions)[number])) { out.push({ def, label, available: false, why: 'Not in this diocese' }); continue; }
      const why = gate();
      out.push({ def, label, available: !why, why });
    } else {
      for (const house of housesOfKind(state, def.houseKind ?? '')) {
        const label = `${def.label}: ${house.name}`;
        const why = gate() || (weeksIn < REQUESTS.minWeeksInPost ? 'Too soon after the last letter of assignment' : '');
        out.push({ def, houseId: house.id, label, available: !why, why });
      }
    }
  }
  return out;
}

/** The letter goes in. Past the first in five years, the council notices. */
export function fileRequest(state: GameState, apostolateId: string, houseId?: string): GameState {
  const r = state.religious;
  const offer = apostolateOffers(state).find((o) => o.def.id === apostolateId && (o.houseId ?? undefined) === (houseId ?? undefined));
  if (!r || !offer?.available) return state;
  const week = state.clock.week;
  const recent = state.career.filter((e) => e.kind === 'note' && e.text.startsWith('Wrote to the provincial asking for') && week - e.week < REQUESTS.askedWindowWeeks).length;
  const asked = (r.requestsMade ?? 0) + 1;
  const request = { apostolateId, ...(houseId ? { houseId } : {}), label: offer.label, week, asked };
  let next: GameState = { ...state, religious: { ...r, request, requestsMade: asked }, career: [...state.career, { week, kind: 'note', text: `Wrote to the provincial asking for ${offer.label.toLowerCase()}.` }] };
  if (recent > 0) next = applyEffects(next, [{ target: 'reputation', key: 'superiors', delta: REQUESTS.superiorsPerExtra * recent }], {}, 'another letter to the provincial');
  return next;
}

export function withdrawRequest(state: GameState): GameState {
  const r = state.religious;
  if (!r?.request || r.request.outcome) return state;
  return { ...state, religious: { ...r, request: { ...r.request, outcome: 'withdrawn', answeredWeek: state.clock.week } }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Withdrew the letter asking for ${r.request.label.toLowerCase()}.` }] };
}

/** The provincial's odds of yes, for the sheet and the roll. */
export function requestChance(state: GameState, offer: ApostolateOffer): number {
  const c = state.character;
  const r = state.religious;
  if (!c || !r) return 0;
  const k = REQUESTS.chance;
  const year = dateOf(state.clock).year;
  const house = offer.houseId ? houseById(state, offer.houseId) : undefined;
  const fit = house ? fitOf(state, house) : fitFor(state, offer.def.requires);
  const need = house ? needOf(state, house, year) : 50;
  const extra = Math.max(0, (r.requestsMade ?? 0) - 1);
  let p = k.base + fit * k.perFit + need * k.perNeed + (c.reputation.superiors ?? 0) * k.perSuperiors + extra * k.perExtraAsk;
  if (offer.def.bishop) p += (c.reputation.local_bishop ?? 0) * k.perBishop;
  return Math.max(k.floor, Math.min(k.ceiling, p));
}

export function requestWord(p: number): string {
  return p >= 0.7 ? 'likely' : p >= 0.45 ? 'a fair chance' : p >= 0.25 ? 'a long shot' : 'unlikely';
}

/** The answer, weeks later: a letter that stops the clock, and a move or a work begun when it is yes. */
export function requestWeek(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const req = r?.request;
  if (!r || !req || req.outcome || state.mode.kind !== 'clock') return state;
  const week = state.clock.week;
  const [lo, hi] = REQUESTS.waitWeeks;
  if (week - req.week < lo) return state;
  if (week - req.week < hi && !rng.chance(1 / (hi - (week - req.week) + 1))) return state;
  const order = religiousOrder(r.order);
  const def = order.apostolates.find((a) => a.id === req.apostolateId);
  const house = req.houseId ? houseById(state, req.houseId) : undefined;
  if (!def || (def.kind === 'house' && !house)) return { ...state, religious: { ...r, request: { ...req, outcome: 'withdrawn', answeredWeek: week } } };
  const offer: ApostolateOffer = { def, ...(req.houseId ? { houseId: req.houseId } : {}), label: req.label, available: true, why: '' };
  const p = requestChance(state, offer);
  const yes = rng.chance(p);
  const title = order.governance.provincialTitle;
  const c = state.character!;
  const superiors = c.reputation.superiors ?? 0;
  let next: GameState = { ...state, religious: { ...r, request: { ...req, outcome: yes ? 'granted' : 'refused', answeredWeek: week } } };
  const letter: Letter = { sort: 'provincial', title: yes ? `The ${title} says yes` : `The ${title} says no`, body: [], week };
  if (!yes) {
    const why = superiors < 0 ? 'He writes that the council does not know you well enough yet for a letter of this kind to carry.' : def.kind === 'house' ? `He writes that ${house!.name} has what it needs this year and that the province needs you where you are.` : 'He writes that the province cannot spare you from the house for it this year, and that the letter is in your file, which is not nothing.';
    letter.body = [`You asked for ${req.label.toLowerCase()}. ${why}`, req.asked > 1 ? 'It is not the first letter, and he says so, kindly.' : 'He thanks you for asking rather than manoeuvring, which is a sentence the province reads.'];
    next = { ...next, career: [...next.career, { week, kind: 'note', text: `The ${title} declined the letter asking for ${req.label.toLowerCase()}.` }] };
    return { ...next, mode: { kind: 'letter', letter } };
  }
  if (def.kind === 'house') {
    next = moveToHouse(next, house!.id, def.work ?? house!.works[0] ?? 'priory_church', { ...(def.work === 'parish' ? { dual: true } : {}), grace: 'good' });
    letter.body = [`You asked for ${req.label.toLowerCase()}, and the letter of assignment is under this one. ${def.line}`, houseLine(next, house!)];
    return { ...next, mode: { kind: 'letter', letter } };
  }
  const dioceseId = state.world?.diocese.presetId ?? currentHouse(state)?.dioceseId ?? '';
  const flags = { ...next.flags, [`apostolate:${def.id}`]: week };
  next = { ...next, flags, religious: { ...next.religious!, apostolate: { id: def.id, dioceseId, label: def.label, startWeek: week } }, career: [...next.career, { week, kind: 'assignment', text: `${def.label}, from ${currentHouse(state)?.name ?? 'the house'}. ${def.line}` }] };
  letter.body = [`You asked for ${req.label.toLowerCase()}, and it is yours from Monday. ${def.line}`, def.bishop ? "The bishop's office signed the appointment on the provincial's presentation, which means the bishop's office can unsign it." : 'The house covers what it costs the horarium, and remembers that it does.'];
  return { ...next, mode: { kind: 'letter', letter } };
}

/** A local work given up. */
export function endApostolate(state: GameState, why: 'resigned' | 'moved' | 'bishop' = 'resigned'): GameState {
  const r = state.religious;
  if (!r?.apostolate) return state;
  const { apostolate, ...rest } = r;
  const flags = { ...state.flags };
  delete flags[`apostolate:${apostolate.id}`];
  const text = why === 'resigned' ? `Gave up ${apostolate.label.toLowerCase()}.` : why === 'bishop' ? `The bishop's office ended ${apostolate.label.toLowerCase()}.` : `${apostolate.label} ended with the move.`;
  return { ...state, flags, religious: rest, career: [...state.career, { week: state.clock.week, kind: 'note', text }] };
}

/** One week of the work and the office: small effects, and strain when the definition says so. */
export function requestsWeek(state: GameState): GameState {
  const r = state.religious;
  if (!r) return state;
  const effects: Effect[] = [];
  for (const e of houseOfficeDef(state)?.weekly ?? []) effects.push({ target: e.target as Effect['target'], key: e.key, delta: e.delta } as Effect);
  for (const e of apostolateDef(state)?.weekly ?? []) effects.push({ target: e.target as Effect['target'], key: e.key, delta: e.delta } as Effect);
  if (!effects.length) return state;
  return applyEffects(state, effects, {}, 'the work of the week');
}

/** The week's blocks the office and the work take, for the sheet. */
export function requestsLoad(state: GameState): number {
  return houseOfficeLoad(state) + apostolateLoad(state);
}
