import type { GameState, Letter, Papacy, PapacyEnd, RomeState, Vacancy } from '@/types';
import { createRng } from '@/engine/rng';
import { fromDayNumber, toDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';
import { papalHistory, papalPools } from '@/content/rome';

/**
 * E1 R1.0 — the papacy as the man lives under it (docs/EXPANSION-E1-ROME.md
 * §3). The record is data up to the last pope no longer living; after it the
 * popes are generated, each from the seed and his place in the line, so a
 * world lives through the same popes on every replay. Everything here reads
 * the seed, never the week's stream, so it moves nothing else in the game.
 * Tunables are invented and flagged.
 */
export const PAPACY = {
  /** Days from the vacancy to the white smoke: fifteen to twenty days to the conclave, one to three in it. Canonical window, flagged. */
  conclaveAfter: [15, 20] as [number, number],
  ballotDays: [1, 3] as [number, number],
  /** Age at election. */
  electionAge: { mean: 70, sd: 5, min: 58, max: 84 },
  /** Yearly chance of death: a floor, and a rise per year past seventy. */
  death: { base: 0.02, perYearPast70: 0.009 },
  /** Yearly chance of renunciation from eighty-five. */
  renounceFrom: 85,
  renounce: 0.03,
  /** The College's temper: how much of the last popes' reading it carries, and how much it leans away from the last. */
  collegeCarry: 0.6,
  leanAway: 0.25,
  temperamentSd: 30,
} as const;

function iso(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return toDayNumber({ year: y!, month: m!, day: d! });
}

function historical(i: number): Papacy {
  const h = papalHistory[i]!;
  return { id: `hist:${h.key}`, name: h.name, born: h.born, electedDay: iso(h.elected), endDay: iso(h.ended), end: h.end, from: h.from, temperament: h.temperament, historical: true, line: h.line };
}

/** The day the record's last see fell vacant: after it, every pope is generated. */
export function recordEndDay(): number {
  return iso(papalHistory[papalHistory.length - 1]!.ended);
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  let left = n;
  for (const [v, s] of ROMAN) while (left >= v) { out += s; left -= v; }
  return out;
}

function clamp(n: number): number {
  return Math.max(-100, Math.min(100, Math.round(n)));
}

/** Where the College stands: the last popes' reading, carried, and leaning a little away from the last one. */
function collegeTemper(line: Papacy[]): number {
  const last = line.slice(-3);
  if (!last.length) return 0;
  const mean = last.reduce((n, p) => n + p.temperament, 0) / last.length;
  return mean * PAPACY.collegeCarry - (line[line.length - 1]!.temperament) * PAPACY.leanAway;
}

/** A generated pope: his name, his age, where he came from, how he reads, and when his see will fall vacant. */
export function generatePope(seed: string, index: number, electedDay: number, line: Papacy[], ordinals: Record<string, number>): { pope: Papacy; ordinals: Record<string, number> } {
  const rng = createRng(`${seed}:pope:${index}`);
  const names = Object.keys(papalPools.regnal);
  const base = rng.pick(names);
  const n = (ordinals[base] ?? papalPools.regnal[base] ?? 0) + 1;
  const name = n === 1 ? base : `${base} ${roman(n)}`;
  const from = rng.weighted(papalPools.origins, (o) => o.weight).from;
  const year = fromDayNumber(electedDay).year;
  const a = PAPACY.electionAge;
  const age = Math.max(a.min, Math.min(a.max, Math.round(a.mean + rng.gaussian() * a.sd)));
  const temperament = clamp(collegeTemper(line) + rng.gaussian() * PAPACY.temperamentSd);
  const before = rng.pick(papalPools.before).replace('{from}', from);
  // His years, rolled now: each year a chance of death that rises with age, and from eighty-five a chance he lays it down.
  let endDay = electedDay + 365 * 40;
  let end: PapacyEnd = 'died';
  for (let y = 0; y < 40; y++) {
    const at = age + y;
    const die = PAPACY.death.base + Math.max(0, at - 70) * PAPACY.death.perYearPast70;
    const renounce = at >= PAPACY.renounceFrom ? PAPACY.renounce : 0;
    const roll = rng.next();
    if (roll < die + renounce) {
      end = roll < die ? 'died' : 'resigned';
      endDay = electedDay + y * 365 + rng.int(20, 364);
      break;
    }
  }
  const pope: Papacy = { id: `gen:${index}`, name, born: year - age, electedDay, endDay, end, from, temperament, historical: false, line: `Elected at ${age}: ${before}.` };
  return { pope, ordinals: { ...ordinals, [base]: n } };
}

/** The day the white smoke rises after a vacancy that opened on `sinceDay`. */
function electionAfter(seed: string, sinceDay: number): number {
  const rng = createRng(`${seed}:conclave:${sinceDay}`);
  return sinceDay + rng.int(PAPACY.conclaveAfter[0], PAPACY.conclaveAfter[1]) + rng.int(PAPACY.ballotDays[0], PAPACY.ballotDays[1]);
}

/** The next pope after the one who reigned: the record's while there is one, a generated one after. */
function successor(seed: string, rome: RomeState, prior: Papacy, electedDay: number): { rome: RomeState; pope: Papacy } {
  if (prior.historical) {
    const i = papalHistory.findIndex((h) => `hist:${h.key}` === prior.id);
    if (i >= 0 && i + 1 < papalHistory.length) {
      const pope = historical(i + 1);
      return { rome: { ...rome, popes: [...rome.popes, pope] }, pope };
    }
  }
  const index = (rome.generated ?? 0) + 1;
  // The College reads the whole line, the record and the generated popes since, whatever year the man's life began.
  const line = [...papalHistory.map((_, i) => historical(i)), ...rome.popes.filter((p) => !p.historical && p.id !== `gen:${index}`)];
  const made = generatePope(seed, index, electedDay, line, rome.ordinals ?? {});
  return { rome: { ...rome, popes: [...rome.popes, made.pope], ordinals: made.ordinals, generated: index }, pope: made.pope };
}

/**
 * Rome from 1939 to `day`: every pope of the line, found by walking the
 * record and then the generated line forward, and the vacancy if one is open.
 */
export function walkRome(seed: string, day: number): RomeState {
  let rome: RomeState = { popes: [historical(0)] };
  for (let guard = 0; guard < 60; guard++) {
    const current = rome.popes[rome.popes.length - 1]!;
    if (current.endDay === undefined || current.endDay > day) break;
    const next = successorElectedDay(seed, current);
    if (next > day) {
      rome = { ...rome, vacancy: { sinceDay: current.endDay, electionDay: next, cause: current.end ?? 'died', priorId: current.id } };
      break;
    }
    rome = successor(seed, rome, current, next).rome;
  }
  return rome;
}

/** Rome as it stands on `day`: only the pope of that day is kept, for the man's life begins there. */
export function romeOn(seed: string, day: number): RomeState {
  const rome = walkRome(seed, day);
  // The life begins now: keep the reigning pope (or the one whose see is vacant), and the generated line's counters.
  const last = rome.popes[rome.popes.length - 1]!;
  return { ...rome, popes: [last] };
}

/** When the next pope is elected after `prior`: the record's date, or the generated conclave's. */
function successorElectedDay(seed: string, prior: Papacy): number {
  if (prior.historical) {
    const i = papalHistory.findIndex((h) => `hist:${h.key}` === prior.id);
    if (i >= 0 && i + 1 < papalHistory.length) return iso(papalHistory[i + 1]!.elected);
  }
  return electionAfter(seed, prior.endDay!);
}

export function reigning(state: Pick<GameState, 'rome'>): Papacy | null {
  const r = state.rome;
  if (!r || r.vacancy) return null;
  return r.popes[r.popes.length - 1] ?? null;
}

/** Whether the see of Rome is vacant: no bishops are named, no documents issued (E1 §3.2, §9 B). */
export function sedeVacante(state: Pick<GameState, 'rome'>): boolean {
  return !!state.rome?.vacancy;
}

function yearOf(day: number): number {
  return fromDayNumber(day).year;
}

export function dateWords(day: number): string {
  const d = fromDayNumber(day);
  return `${d.day} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.month - 1]} ${d.year}`;
}

export interface PapacyWeek {
  state: GameState;
  lines: string[];
  letters: Letter[];
}

/**
 * One week of Rome: the see falls vacant when the pope's day comes, the
 * conclave elects when its day comes, and the man hears of each. Older saves
 * are given the Rome of the week they are opened in, without letters.
 */
export function papacyWeek(state: GameState): PapacyWeek {
  const day = sundayOf(state.clock);
  if (!state.rome) return { state: { ...state, rome: romeOn(state.seed, day) }, lines: [], letters: [] };
  let rome = state.rome;
  const lines: string[] = [];
  const letters: Letter[] = [];
  let career = state.career;
  const week = state.clock.week;
  for (let guard = 0; guard < 4; guard++) {
    if (rome.vacancy) {
      if (rome.vacancy.electionDay > day) break;
      const prior = rome.popes.find((p) => p.id === rome.vacancy!.priorId) ?? rome.popes[rome.popes.length - 1]!;
      const electionDay = rome.vacancy.electionDay;
      const { vacancy: _v, ...open } = rome;
      const made = successor(state.seed, open, prior, electionDay);
      rome = made.rome;
      const p = made.pope;
      const age = yearOf(p.electedDay) - p.born;
      lines.push(`Habemus papam: ${p.name}, elected ${dateWords(p.electedDay)}, from ${p.from}, at ${age}.`);
      letters.push({ sort: 'rome', title: `Habemus papam: ${p.name}`, body: [`The white smoke rose on ${dateWords(p.electedDay)}, and the bells of Rome after it. The cardinal deacon came out onto the balcony, and the name was ${p.name}: ${p.historical ? '' : 'a cardinal '}from ${p.from}, ${age} years old.`, p.line ?? '', 'On Sunday the Canon names him for the first time. People ask you after Mass what he will be like, and you say what every priest in the world is saying: that nobody knows, and that everyone will find out.'].filter(Boolean), week });
      career = [...career, { week, kind: 'note', text: `${p.name} was elected pope.` }];
      continue;
    }
    const current = rome.popes[rome.popes.length - 1]!;
    if (current.endDay === undefined || current.endDay > day) break;
    const electionDay = successorElectedDay(state.seed, current);
    const vacancy: Vacancy = { sinceDay: current.endDay, electionDay, cause: current.end ?? 'died', priorId: current.id };
    rome = { ...rome, vacancy };
    const died = vacancy.cause === 'died';
    lines.push(died ? `${current.name} died on ${dateWords(current.endDay)}. The see of Rome is vacant.` : `${current.name} renounced the see of Peter, effective ${dateWords(current.endDay)}. The see of Rome is vacant.`);
    letters.push({ sort: 'rome', title: died ? `${current.name} has died` : `${current.name} has renounced the papacy`, body: [died ? `The bells tolled on ${dateWords(current.endDay)}. ${current.name} is dead at ${yearOf(current.endDay) - current.born}, after ${Math.max(1, Math.round((current.endDay - current.electedDay) / 365))} year${Math.round((current.endDay - current.electedDay) / 365) === 1 ? '' : 's'} in the chair.` : `${current.name} has laid down the see of Peter, effective ${dateWords(current.endDay)}, at ${yearOf(current.endDay) - current.born}.`, 'Sede vacante: until the conclave elects, no bishops are named and nothing new comes from Rome. The dioceses go on as they were; his name drops out of the Canon, and the parish prays for the Church and for the cardinals.', 'The cardinals gather. The conclave is two or three weeks away.'], week });
    career = [...career, { week, kind: 'note', text: died ? `${current.name} died; the see of Rome fell vacant.` : `${current.name} renounced the papacy.` }];
  }
  return { state: { ...state, rome, career }, lines, letters };
}

/** The popes of his life, for the profile and the summary: "Benedict XVI (from 2010), Francis (2013–2025)". */
export function popesOfHisLife(state: Pick<GameState, 'rome' | 'clock'>): string[] {
  const r = state.rome;
  if (!r) return [];
  const startYear = fromDayNumber(state.clock.startDay).year;
  return r.popes.map((p, i) => {
    const from = i === 0 ? Math.max(startYear, yearOf(p.electedDay)) : yearOf(p.electedDay);
    const to = p.endDay !== undefined && (p.endDay <= sundayOf(state.clock) || (r.vacancy && r.vacancy.priorId === p.id)) ? yearOf(p.endDay) : null;
    return `${p.name} (${i === 0 && from > yearOf(p.electedDay) ? 'from ' : ''}${from}${to ? `–${to}` : '–'})`;
  });
}

