import type { Consultation, ConsultationOption, GameState, OrderHouse } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { dateOf } from '@/engine/time';
import { religiousOrder } from '@/content/religious';
import { PROVINCE } from '@/generation/province';
import { currentHouse, houseLine, membersOf } from './house';
import { currentPosting, moveToHouse } from './transfer';

/**
 * Obedience and mobility. E3 §3.1: the provincial assigns every friar for
 * 3–6 years; before the letter there is a consultation. The assignment
 * algorithm is the base game's shape (need, fit, a man's readiness, noise)
 * with the provincial as the deciding actor: province need dominates, fit
 * matters, and the friar's formation needs count. Tunables are invented.
 */
export const OBEDIENCE = {
  termWeeks: [156, 312] as [number, number],
  weights: { need: 0.5, fit: 0.25, formation: 0.15, preference: 0.12, objection: 0.2, noise: 8 },
  /** What the letter does to standing, by how it is taken. */
  grace: {
    good: [{ target: 'reputation', key: 'superiors', delta: 6 }, { target: 'reputation', key: 'province', delta: 4 }, { target: 'stat', key: 'piety', delta: 1.5 }],
    reluctant: [{ target: 'reputation', key: 'superiors', delta: -5 }, { target: 'reputation', key: 'province', delta: -2 }],
    refused: [{ target: 'reputation', key: 'superiors', delta: -30 }, { target: 'reputation', key: 'province', delta: -12 }, { target: 'reputation', key: 'community', delta: -8 }],
  } as const,
  /** A second refusal opens the formal process. */
  processAfterRefusals: 2,
  options: 3,
} as const;

/** How badly the house needs another man, 0..100: small for its kind, many old, formation houses always. */
function needOf(state: GameState, house: OrderHouse, year: number): number {
  const members = membersOf(state, house);
  const [lo, hi] = PROVINCE.members[house.kind];
  const short = Math.max(0, Math.min(1, (hi - members.length) / Math.max(1, hi - lo)));
  const old = members.length ? members.filter((m) => year - m.birthYear >= 65).length / members.length : 0.5;
  const kind = house.kind === 'novitiate' || house.kind === 'studium' ? 15 : house.kind === 'parish' || house.kind === 'school' ? 10 : 0;
  return Math.round(Math.min(100, short * 55 + old * 30 + kind));
}

/** How the man suits the work, 0..100. */
function fitOf(state: GameState, house: OrderHouse): number {
  const s = state.character?.stats;
  if (!s) return 50;
  const c = state.character!;
  const work = house.works[0] ?? 'priory_church';
  const base = work === 'formation' ? s.piety * 0.5 + s.charisma * 0.3 + s.theology * 0.2 : work === 'teaching' ? s.theology * 0.5 + s.knowledge * 0.5 : work === 'school' ? s.administration * 0.5 + s.charisma * 0.5 : work === 'parish' ? s.charisma * 0.5 + s.administration * 0.3 + s.piety * 0.2 : s.charisma * 0.4 + s.theology * 0.3 + s.piety * 0.3;
  const alignment = 100 - Math.abs(c.alignment - house.alignment) / 2;
  return Math.round(base * 0.7 + alignment * 0.3);
}

/** What the posting would do for a young friar's formation, 0..100: a kind he has not lived. */
function formationOf(state: GameState, house: OrderHouse, year: number): number {
  const c = state.character;
  const age = c ? year - (c.entryYear - c.background.entryAge) : 45;
  const lived = new Set((state.religious?.assignments ?? []).map((a) => state.orderHouses?.[a.houseId]?.kind));
  const young = Math.max(0, Math.min(1, (45 - age) / 15));
  return Math.round(young * (lived.has(house.kind) ? 30 : 80));
}

/** Open the talk: the provincial names the houses that need a man, the current one never among them. */
export function consult(state: GameState, rng: Rng, reason: Consultation['reason'] = 'term'): GameState {
  const r = state.religious;
  if (!r || !state.orderHouses) return state;
  const year = dateOf(state.clock).year;
  const houses = Object.values(state.orderHouses).filter((h) => h.provinceId === r.provinceId && h.id !== r.houseId);
  const scored = houses.map((house) => ({ house, need: needOf(state, house, year), fit: fitOf(state, house), formation: formationOf(state, house, year) }));
  scored.sort((a, b) => b.need + b.fit * 0.5 - (a.need + a.fit * 0.5) || a.house.id.localeCompare(b.house.id));
  // The three the provincial has in mind: the two the province needs most, and one rolled from the rest so it is not always the same list.
  const top = scored.slice(0, OBEDIENCE.options - 1);
  const rest = scored.slice(OBEDIENCE.options - 1);
  const picked = rest.length ? [...top, rng.pick(rest)] : top;
  const options: ConsultationOption[] = picked.map(({ house, need, fit, formation }) => ({ houseId: house.id, work: house.works[0] ?? 'priory_church', need, fit, formation, line: houseLine(state, house) }));
  return { ...state, religious: { ...r, consultation: { week: state.clock.week, options, reason } } };
}

/** The man states a preference, or objects on real grounds. Both are remembered. */
export function statePreference(state: GameState, houseId: string | null, objection = false): GameState {
  const r = state.religious;
  if (!r?.consultation) return state;
  const consultation: Consultation = { ...r.consultation, ...(houseId ? { preference: houseId } : {}), ...(objection ? { objection: true } : {}) };
  return { ...state, religious: { ...r, consultation } };
}

/** The provincial decides. Need dominates; fit matters; formation counts; a stated preference is heard; an objection is weighed, not obeyed. */
export function decideAssignment(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const c = r?.consultation;
  if (!r || !c) return state;
  const w = OBEDIENCE.weights;
  const ranked = c.options
    .map((o) => {
      const reasons: string[] = [];
      let score = o.need * w.need + o.fit * w.fit + o.formation * w.formation + rng.float(-w.noise, w.noise);
      if (o.need >= 60) reasons.push('the province needs a man there');
      if (o.fit >= 65) reasons.push('the work suits him');
      if (o.formation >= 60) reasons.push('a young friar should see it');
      if (c.preference === o.houseId) {
        score += 100 * w.preference;
        reasons.push('he asked for it');
      }
      if (c.objection && c.preference && c.preference !== o.houseId) score -= 100 * w.objection * 0.5;
      return { o, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
  const top = ranked[0]!;
  return { ...state, religious: { ...r, consultation: { ...c, decided: { houseId: top.o.houseId, work: top.o.work, reasons: top.reasons } } } };
}

/**
 * The letter arrives and he answers it. Good grace raises standing and a
 * little piety; visible reluctance is remembered; refusal is extremely
 * serious, and a second one opens the process that can end in dismissal.
 */
export function receiveAssignment(state: GameState, grace: 'good' | 'reluctant' | 'refused'): GameState {
  const r = state.religious;
  const decided = r?.consultation?.decided;
  if (!r || !decided) return state;
  let next = applyEffects(state, [...OBEDIENCE.grace[grace]], {}, grace === 'good' ? 'an assignment taken with good grace' : grace === 'reluctant' ? 'an assignment taken badly' : 'an assignment refused');
  const obedience = { ...r.obedience, [grace === 'good' ? 'accepted' : grace]: r.obedience[grace === 'good' ? 'accepted' : grace] + 1 };
  const flags = { ...next.flags };
  if (grace === 'reluctant') flags['obedience:reluctant'] = next.clock.week;
  if (grace === 'refused') {
    flags['obedience:refused'] = next.clock.week;
    if (obedience.refused >= OBEDIENCE.processAfterRefusals) flags['obedience:process'] = next.clock.week;
  }
  const { consultation: _done, ...rest } = next.religious!;
  next = { ...next, flags, religious: { ...rest, obedience } };
  if (grace === 'refused') return next;
  const dual = decided.work === 'parish';
  return moveToHouse(next, decided.houseId, decided.work, { ...(dual ? { dual: true } : {}), grace });
}

/** When the current posting's term is up, by the order's usual span. */
export function termEndWeek(state: GameState): number | undefined {
  const posting = currentPosting(state);
  if (!posting) return undefined;
  return posting.startWeek + OBEDIENCE.termWeeks[1];
}

/**
 * Dual authority. E3 §3.8: a religious pastor of a parish entrusted to his
 * order holds it by two keys, and either can turn. Returns who would remove
 * him this year, if anyone: the bishop when the local standing has gone
 * bad, the provincial when the province needs him or is withdrawing.
 */
export function dualAuthorityCheck(state: GameState, rng: Rng): 'bishop' | 'province' | 'withdrawal' | null {
  const posting = currentPosting(state);
  const r = state.religious;
  const c = state.character;
  if (!posting?.dual || !r || !c || !currentHouse(state)) return null;
  const bishop = c.reputation.local_bishop ?? 0;
  const superiors = c.reputation.superiors ?? 0;
  if (bishop <= -40 && rng.chance(0.5)) return 'bishop';
  const province = state.province;
  if (province?.trajectory === 'shrinking' && rng.chance(0.08)) return 'withdrawal';
  if (superiors <= -30 && rng.chance(0.35)) return 'province';
  const mechanics = religiousOrder(r.order).mechanics;
  if ((mechanics.democracy ?? 1) > 1 && rng.chance(0.03)) return 'province';
  return null;
}
