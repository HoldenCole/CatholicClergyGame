import type { GameState, Letter } from '@/types';
import { applyEffects } from '@/engine/effects';
import { deliverLetter } from './review';

/**
 * The anniversary of ordination, kept every year: a line in the record,
 * and at twenty-five a jubilee the parish or the house makes something
 * of. The ruby and the golden are authored scenes (mi_ruby_jubilee,
 * mi_golden_jubilee); this only writes their flags. Tunables are invented.
 */
export const ANNIVERSARIES = {
  silver: { laity: 6, community: 6, brothers: 3, strain: -8 },
} as const;

const LINES: Record<number, string> = {
  1: 'A year ordained today. Nobody said anything, and the Mass was the same Mass, which is the point.',
  5: 'Five years ordained today. The bishop\'s office sent a card with a printed signature.',
  10: 'Ten years ordained today. Two people remembered, and one of them was your mother.',
  20: 'Twenty years ordained today. Half of what you were ordained with has moved, and one has left.',
  25: 'Twenty-five years ordained today: the silver jubilee.',
  30: 'Thirty years ordained today. The younger priests call you Father in the other tone now.',
  40: 'Forty years ordained today: the ruby jubilee.',
  50: 'Fifty years ordained today: the golden jubilee, which few reach in the work.',
};

/** Years ordained on this exact week, or null when it is not the anniversary. */
export function anniversaryYears(state: GameState): number | null {
  const w = state.flags.ordination_week;
  if (typeof w !== 'number' || state.clock.week <= w) return null;
  const weeks = state.clock.week - w;
  return weeks % 52 === 0 ? weeks / 52 : null;
}

/** The week: the anniversary's line, and the silver jubilee's letter and its effects. */
export function anniversaryWeek(state: GameState): { state: GameState; line: string | null } {
  const years = anniversaryYears(state);
  if (years === null || !state.character) return { state, line: null };
  const line = LINES[years] ?? `${years} years ordained today.`;
  let next: GameState = { ...state, flags: { ...state.flags, [`anniversary:${years}`]: state.clock.week, ...(years === 25 ? { 'jubilee:25': state.clock.week } : years === 40 ? { 'jubilee:40': state.clock.week } : years === 50 ? { 'jubilee:50': state.clock.week } : {}) } };
  if (years !== 25) return { state: next, line };
  const religious = !!next.religious;
  const j = ANNIVERSARIES.silver;
  next = applyEffects(next, [
    { target: 'reputation', key: religious ? 'community' : 'parishioners', delta: religious ? j.community : j.laity },
    { target: 'reputation', key: religious ? 'province' : 'brother_priests', delta: j.brothers },
    { target: 'strain', key: '', delta: j.strain },
  ], {}, 'the silver jubilee');
  const letter: Letter = {
    sort: religious ? 'provincial' : 'bishop',
    title: 'The silver jubilee',
    body: [
      religious
        ? 'Twenty-five years a priest. The house made something of it: a Mass with the province\'s men who could come, a dinner the cook had planned for a month, and a gift from the community that the prior said was from everyone and was mostly from three of them. The provincial wrote a page that named the houses you have lived in, which is what a province remembers.'
        : 'Twenty-five years a priest. The parish made something of it: a Mass with the bishop, or his letter when he could not come; a reception in the hall that the women had planned for a month; a purse, a chalice, and a book of photographs with people in it you have buried. The classmates who could come came, and stood at the back the way they did at the ordination.',
      'It is not a thing a man arranges for himself, and it is not a thing he forgets. A week of it, and then the Tuesday after.',
    ],
    week: state.clock.week,
  };
  next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: 'The silver jubilee: twenty-five years ordained.' }] };
  return { state: deliverLetter(next, letter), line };
}
