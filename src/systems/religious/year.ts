import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';
import { consult, dualAuthorityCheck, termEndWeek } from './obedience';
import { chapterYear, openChapter, termOver } from './chapter';
import { appointmentYear, conferCredentials } from './offices';
import { currentHouse } from './house';
import { BISHOP_ASKS, bishopAskYear } from './bishopAsks';
import { pastorAskYear } from './pastorAsks';
import { diocesanClassmateYear } from './diocesanClassmates';
import { directingYear, seminaryMenStart, seminaryMenYear } from './directing';
import { provinceYear } from './foundations';
import { crossingYear } from './crossing';
import { foundingYear } from './founding';
import { foundationsYear } from './foundationYear';
import { endApostolate } from './requests';
import { bishopAskDefs } from '@/content/religious';

/**
 * The friar's year and week, on top of the base career's. E3 §3.1, §3.6,
 * §3.7: a posting whose term is up opens a consultation; a parish held by
 * two keys can be taken by either; the house elects its prior when the
 * term runs out and the province its provincial; an office held runs out
 * and he returns to the ranks; ambition fades; credentials arrive.
 */
export const RELIGIOUS_YEAR = {
  /** Weeks a consultation waits after ordination before the first posting is decided, when the man does not answer. */
  consultationGrace: 8,
} as const;

/** The week the house last elected, by house id, from the flags. */
function lastHouseChapter(state: GameState, houseId: string): number {
  return Number(state.flags[`chapter:house:${houseId}`] ?? 0);
}

export function religiousYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r || !state.flags.ordained) return state;
  let next = chapterYear(state);
  next = appointmentYear(next);
  const conferred = conferCredentials(next);
  next = conferred.state;
  // The term of office is up: he returns to the ranks, and the player says how.
  if (termOver(next) && next.mode.kind === 'clock') return { ...next, mode: { kind: 'term_end' } };
  // The house elects a prior when the prior's term has run; the province a provincial when the provincial's has.
  const order = religiousOrder(r.order);
  const house = currentHouse(next);
  const year = Math.floor(next.clock.week / 52);
  if (house && !r.chapter && next.mode.kind === 'clock') {
    const since = lastHouseChapter(next, house.id);
    const due = since === 0 ? (year * 52 + next.clock.week) % (order.governance.priorTermYears * 52) < 52 : next.clock.week - since >= order.governance.priorTermYears * 52;
    if (due && r.vows.solemnWeek !== undefined) {
      next = openChapter({ ...next, flags: { ...next.flags, [`chapter:house:${house.id}`]: next.clock.week } }, 'house', house.id, 'prior');
      return { ...next, mode: { kind: 'chapter' } };
    }
  }
  const p = next.province;
  if (p && !r.chapter && next.mode.kind === 'clock') {
    const sinceProv = Number(next.flags['chapter:provincial'] ?? 0);
    const provYear = 2010 + Math.floor(next.clock.week / 52);
    const due = sinceProv === 0 ? provYear - p.provincialSince >= order.governance.provincialTermYears : next.clock.week - sinceProv >= order.governance.provincialTermYears * 52;
    if (due) {
      next = openChapter({ ...next, flags: { ...next.flags, 'chapter:provincial': next.clock.week } }, 'provincial', p.id, 'provincial');
      return { ...next, mode: { kind: 'chapter' } };
    }
  }
  // A work the bishop appointed to is his to end, and a bishop who has soured does. E3 §3.11.
  const work = next.religious?.apostolate;
  if (work && (work.id.startsWith('chancery:') || bishopAskDefs.some((d) => d.apostolate === work.id)) && (next.character?.reputation.local_bishop ?? 0) <= BISHOP_ASKS.bishopEndsAt && rng.derive(`bishop-ends:${next.clock.week}`).chance(BISHOP_ASKS.bishopEndsChance)) {
    next = endApostolate(next, 'bishop');
  }
  // Men crossing over, both ways; and the province closing or founding a house, which stops the clock with a letter. E3 §3.14.
  next = crossingYear(next, rng.derive(`crossing:${next.clock.week}`));
  next = provinceYear(next, rng.derive(`province:${next.clock.week}`));
  if (next.mode.kind !== 'clock') return next;
  // The houses of his line, and the invitations and asks that start one. E3 §9.
  next = foundationsYear(next, rng.derive(`foundations:${next.clock.week}`));
  next = foundingYear(next, rng.derive(`founding:${next.clock.week}`));
  // The diocese's men: the classmates from the seminary lectures, the seminary's men when he teaches there, and the ones he directs. E3 §3.13.
  next = diocesanClassmateYear(next, rng.derive(`dcm:${next.clock.week}`));
  next = seminaryMenYear(seminaryMenStart(next, rng.derive(`dsem:${next.clock.week}`)), rng.derive(`dsem-year:${next.clock.week}`));
  next = directingYear(next, rng.derive(`directing:${next.clock.week}`));
  // A pastor of the diocese may write to the prior for him. E3 §3.12.
  next = pastorAskYear(next, rng.derive(`pastor-ask:${next.clock.week}`));
  // The bishop's office may write to the provincial for him. E3 §3.11.
  if (!r.consultation && next.mode.kind === 'clock') {
    next = bishopAskYear(next, rng.derive(`bishop-ask:${next.clock.week}`));
    if (next.mode.kind !== 'clock') return next;
  }
  // The posting: the term up, or a key turned.
  if (!r.consultation && next.mode.kind === 'clock') {
    const end = termEndWeek(next);
    const turned = dualAuthorityCheck(next, rng.derive(`dual:${next.clock.week}`));
    if (turned) {
      next = consult({ ...next, flags: { ...next.flags, [`dual:${turned}`]: next.clock.week } }, rng.derive(`consult:${next.clock.week}`), turned === 'withdrawal' ? 'withdrawal' : turned);
      return { ...next, mode: { kind: 'consultation' } };
    }
    if (end !== undefined && next.clock.week >= end) {
      next = consult(next, rng.derive(`consult:${next.clock.week}`), 'term');
      return { ...next, mode: { kind: 'consultation' } };
    }
  }
  return next;
}

/** A consultation opened by ordination or a year waits on the clock until the man is at his desk. */
export function religiousModeStep(state: GameState): GameState {
  const r = state.religious;
  if (!r || state.mode.kind !== 'clock' || state.pending.length) return state;
  if (r.consultation && !r.consultation.decided) return { ...state, mode: { kind: 'consultation' } };
  if (r.consultation?.decided) return { ...state, mode: { kind: 'obedience_letter' } };
  if (r.chapter && !r.chapter.outcome) return { ...state, mode: { kind: 'chapter' } };
  if (r.bishopAsk && !r.bishopAsk.outcome) return { ...state, mode: { kind: 'bishop_ask' } };
  return state;
}
