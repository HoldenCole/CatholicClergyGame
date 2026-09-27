import type { Cardinal, GameState } from '@/types';
import { fromDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';
import { studyProgram } from '@/content/study';
import { placeWord } from '@/systems/studyWeek';
import { electorsOn } from './conclave';

/** E1 R1.6 — the pontificate in words: the dials, the life's line, the epilogue, and the scenes' tokens. */

/** A dial of the pontificate in its own words, from the program's data. */
export function dialWord(id: string, value: number): string {
  const d = studyProgram('papacy')?.place?.dials.find((x) => x.id === id);
  return d ? placeWord(value, d.low, d.high) : String(value);
}

export function reading(t: number): string {
  return t <= -40 ? 'a traditionalist' : t <= -12 ? 'a conservative' : t < 12 ? 'a man of the centre' : t < 40 ? 'a moderate reformer' : 'a reformer';
}

/** What the reign added up to, for the shelf page. */
export function pontificateLine(state: GameState): string | null {
  const p = state.rome?.pontificate;
  if (!p) return null;
  const r = state.study?.record ?? {};
  const place = state.study?.place ?? {};
  const years = Math.max(1, Math.round((state.clock.week - p.electedWeek) / 52));
  const parts = [
    `${p.written.length} document${p.written.length === 1 ? '' : 's'}`,
    `${p.journeys.length} journey${p.journeys.length === 1 ? '' : 's'}`,
    `${r.cardinals ?? 0} cardinal${r.cardinals === 1 ? '' : 's'} created`,
    `${r.bishops ?? 0} bishops named`,
    ...(r.saints ? [`${r.saints} saint${r.saints === 1 ? '' : 's'} canonized`] : []),
  ];
  return `As ${p.name} you reigned ${years} year${years === 1 ? '' : 's'}: ${parts.join(', ')}. At the end the Church was ${dialWord('church', place.church ?? 0)}, the Curia ${dialWord('curia', place.curia ?? 0)}, the world ${dialWord('world', place.world ?? 0)}, and the priest in you ${dialWord('soul', place.soul ?? 0)}.`;
}

/** The conclave after him, read against the College he made. */
export function pontificateEpilogue(state: GameState, successor: Cardinal | null, name: string | null, day: number): string {
  const p = state.rome?.pontificate;
  const college = state.rome?.college ?? [];
  const electors = electorsOn(college, day);
  const mine = electors.filter((c) => c.createdBy === 'player').length;
  const me = state.character?.alignment ?? 0;
  const lines: string[] = [];
  lines.push(`${mine === 0 ? 'None' : mine} of the ${electors.length} cardinal electors ${mine === 1 ? 'was' : 'were'} men you had created.`);
  if (!successor || !name) {
    lines.push('The conclave was long, and what it decided is for another life to tell.');
    return lines.join(' ');
  }
  const age = fromDayNumber(day).year - successor.born;
  const his = successor.createdBy === 'player';
  const gap = Math.abs(successor.temperament - me);
  lines.push(`They elected Cardinal ${successor.name} of ${successor.from}, ${age}, ${his ? 'one of your own creations' : 'a man an earlier pope had made'}, who took the name ${name}.`);
  lines.push(`He is ${reading(successor.temperament)}; ${gap < 20 ? 'he reads the Church much as you did, and what you began will go on' : gap < 45 ? 'he reads the Church a little otherwise, and will keep some of what you did and let the rest go quiet' : 'he reads the Church otherwise, and the men in the parishes will find out what that costs'}.`);
  if (p && p.consistories.length === 0) lines.push('You never held a consistory. The College that chose him was your predecessors\', not yours.');
  return lines.join(' ');
}

/** {pope_name}, {pope_journey}, {pope_draft}, {pope_years}, {pope_from}: the words the pontificate's scenes need. */
export function popeTokens(state: GameState): Record<string, string> {
  const p = state.rome?.pontificate;
  if (!p) return {};
  const issued = state.rome?.issued ?? [];
  const last = p.written.length ? issued.find((d) => d.id === p.written[p.written.length - 1]) : undefined;
  const years = Math.max(0, Math.floor((state.clock.week - p.electedWeek) / 52));
  const journey = state.flags['pope:journey'];
  return {
    pope_name: p.name,
    pope_journey: typeof journey === 'string' ? journey : 'Portugal',
    pope_draft: p.draft?.title ?? last?.title ?? 'the first encyclical',
    pope_years: String(years),
    pope_from: p.from,
    pope_age: String(fromDayNumber(sundayOf(state.clock)).year - (state.character ? state.character.entryYear - state.character.background.entryAge : 0)),
  };
}
