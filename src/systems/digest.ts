import type { DigestWeek, GameState } from '@/types';
import { allEvents } from '@/content';
import ambient from '@/content/parish/ambient.json';
import { groupTrend, parishGroups, vitalityBand } from './groups';
import { strainOf, strainWord } from './week';

/**
 * The digest, read: every line of a week sorted into a lane so the sheet can
 * be scanned instead of read, and the numbers pulled out of the money line
 * so a week can be compared with the one before. The lines themselves are
 * unchanged; this only decides where each one sits.
 */
export type Lane = 'header' | 'decided' | 'money' | 'parish' | 'people' | 'diocese' | 'you' | 'around';

export const LANE_LABEL: Record<Lane, string> = {
  header: '', decided: 'Decided', money: 'The money', parish: 'The parish', people: 'The people', diocese: 'The diocese', you: 'You', around: 'Around the parish',
};

const AMBIENT = new Set<string>(Object.values(ambient as Record<string, string[]>).flat());
const TITLES = new Set(allEvents.map((e) => e.title));

export function laneOf(line: string): Lane {
  if (/^Week of /.test(line)) return 'header';
  const colon = line.indexOf(': ');
  if (colon > 0 && TITLES.has(line.slice(0, colon))) return 'decided';
  if (AMBIENT.has(line)) return 'around';
  if (/Collections \$|assessment|\bdebt\b|\$[\d,]+|the fund|reserve|bequest|paid down|invested|withdrew/i.test(line)) return 'money';
  if (/^You (baptized|married|buried|anointed|sat with|prepared|helped|quarreled)|is fading|is thriving|is withering|steady again|has folded|coming back|A word with|has been made|has been named|has left|has died|left the priesthood|leads it|new leader|\bwedding|\bfuneral|baptism/i.test(line)) return 'people';
  if (/chancery|bishop|Rome has|the see|diocese|the board|vicar for clergy|chancellor|personnel|letter of appointment|renewed/i.test(line)) return 'diocese';
  if (/^You |^Your |tired in a way|slept, and|sick for two days|not enough of you|ran over|homily was from the file|the club|the circle|at the gym|ran with|hours? at|\bstudy\b|prayer|retreat/i.test(line)) return 'you';
  return 'parish';
}

export interface WeekNumbers {
  collections: number | null;
  usual: number | null;
  attendance: number | null;
}

export function numbersOf(entry: DigestWeek): WeekNumbers {
  const line = entry.lines.find((l: string) => /^Collections \$/.test(l));
  if (!line) return { collections: null, usual: null, attendance: null };
  const m = /^Collections \$([\d,]+), (?:above|below|about) the usual \$([\d,]+)\. Attendance (\d+)%/.exec(line);
  if (!m) return { collections: null, usual: null, attendance: null };
  return { collections: Number(m[1]!.replace(/,/g, '')), usual: Number(m[2]!.replace(/,/g, '')), attendance: Number(m[3]) };
}

export interface ReadWeek {
  week: number;
  /** "Week of 12 May 2024 · Easter" without the prefix. */
  head: string;
  numbers: WeekNumbers;
  /** Against the week before: +1 up, −1 down, 0 flat or unknown. */
  moneySign: -1 | 0 | 1;
  pewsSign: -1 | 0 | 1;
  lanes: Partial<Record<Lane, string[]>>;
  /** Something happened this week beyond the routine. */
  eventful: boolean;
}

function sign(a: number | null, b: number | null, dead: number): -1 | 0 | 1 {
  if (a === null || b === null) return 0;
  return a - b > dead ? 1 : b - a > dead ? -1 : 0;
}

/** The digest read week by week, most recent first. */
export function readDigest(digest: DigestWeek[], count: number): ReadWeek[] {
  const out: ReadWeek[] = [];
  const slice = digest.slice(-(count + 1));
  for (let i = slice.length - 1; i >= Math.max(1, slice.length - count) - (slice.length <= count ? 1 : 0); i--) {
    const entry = slice[i]!;
    const prev = slice[i - 1] ?? null;
    const lanes: Partial<Record<Lane, string[]>> = {};
    let head = `Week ${entry.week}`;
    for (const line of entry.lines) {
      const lane = laneOf(line);
      if (lane === 'header') { head = line.replace(/^Week of /, ''); continue; }
      (lanes[lane] ??= []).push(line);
    }
    const numbers = numbersOf(entry);
    const before = prev ? numbersOf(prev) : { collections: null, usual: null, attendance: null };
    const eventful = Object.entries(lanes).some(([lane, lines]) => lane !== 'money' && lane !== 'around' && lines.length > 0);
    out.push({ week: entry.week, head, numbers, moneySign: sign(numbers.collections, before.collections, Math.max(150, (numbers.usual ?? 0) * 0.04)), pewsSign: sign(numbers.attendance, before.attendance, 0), lanes, eventful });
  }
  return out;
}

export interface WhatIsGoingOn {
  lines: string[];
}

/** The month at a glance, from the state itself rather than the lines: what a scan of the sheet should tell him first. */
export function whatIsGoingOn(state: GameState): string[] {
  const lines: string[] = [];
  const p = state.parish;
  if (!p) return lines;
  const weeks = state.digest.slice(-13).map(numbersOf);
  const first = weeks.find((w) => w.attendance !== null);
  const last = [...weeks].reverse().find((w) => w.attendance !== null);
  if (first && last && first !== last && first.attendance !== null && last.attendance !== null) {
    const d = last.attendance - first.attendance;
    lines.push(d >= 2 ? `The pews are filling: attendance ${first.attendance}% to ${last.attendance}% over the quarter.` : d <= -2 ? `The pews are thinning: attendance ${first.attendance}% to ${last.attendance}% over the quarter.` : `Attendance is holding at about ${last.attendance}%.`);
  }
  const money = weeks.filter((w) => w.collections !== null && w.usual !== null);
  if (money.length >= 4) {
    const above = money.filter((w) => w.collections! > w.usual! * 1.03).length;
    const below = money.filter((w) => w.collections! < w.usual! * 0.97).length;
    lines.push(above > money.length / 2 ? 'Collections have run above the usual most weeks this quarter.' : below > money.length / 2 ? 'Collections have run below the usual most weeks this quarter.' : 'Collections are about what the parish gives.');
  }
  if (p.finance.debt > 0) lines.push(`The parish owes $${p.finance.debt.toLocaleString()}.`);
  const sustain = p.routine.discretionary.groups ?? 0;
  const groups = parishGroups(state).filter((g) => !g.suppressed);
  const fading = groups.filter((g) => groupTrend(state, g, sustain) <= -0.3 || vitalityBand(g.vitality) === 'dying');
  const rising = groups.filter((g) => groupTrend(state, g, sustain) >= 0.3);
  if (fading.length) lines.push(`${fading.map((g) => g.name).join(', ')} ${fading.length === 1 ? 'is' : 'are'} fading.`);
  if (rising.length) lines.push(`${rising.map((g) => g.name).join(', ')} ${rising.length === 1 ? 'is' : 'are'} gaining.`);
  const strain = strainOf(state);
  if (strain >= 50) lines.push(`You are ${strainWord(strain)}.`);
  if (state.offers.length) lines.push(`${state.offers.length === 1 ? 'A letter is' : `${state.offers.length} letters are`} waiting for an answer.`);
  const left = p.arcEndWeek - state.clock.week;
  if (left > 0 && left <= 52) lines.push(`The board looks at you in ${left <= 4 ? 'weeks' : `${Math.ceil(left / 4)} months`}.`);
  return lines;
}
