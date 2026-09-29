import type { GameState } from '@/types';
import { currentHouse, playerIsPrior, priorOf } from './house';
import { strainOf, WEEK } from '@/systems/week';

/**
 * Strain that does something for a friar (friar round Q8). E3 §3.3: a man
 * burning out in a house is the house's business. Past the sick line the
 * infirmarian, or the prior, or the man himself cuts the week: the free
 * blocks are halved and the body takes the afternoons back. A sabbatical
 * or a season in the province's infirmary house, granted by permission or
 * offered by the province (content/events/religious/shared_strain.json),
 * takes him off the work for its weeks and rests him faster. The scenes
 * decide; this file does the weeks. Tunables invented.
 */
export const STRAIN = {
  /** Past this the week is cut: the sick line of the parish week. */
  sick: WEEK.strainSick,
  /** The free blocks left to him while the week is cut. */
  cutShare: 0.5,
  /** Strain recovered a week while the week is cut, on top of the rest a plain week gives. */
  cutRecovery: 2.5,
  /** Weeks a sabbatical runs; a season in the infirmary house. */
  sabbaticalWeeks: 26,
  infirmaryWeeks: 13,
  /** Strain recovered a week away from the work. */
  awayRecovery: 5,
  /** The line about the cut week is said this often while it lasts. */
  cutLineEvery: 8,
} as const;

/** Whether he is away from the work on a sabbatical or in the infirmary house. */
export function awayForRest(state: GameState): { kind: 'sabbatical' | 'infirmary'; until: number } | null {
  const until = state.flags['away:until'];
  if (typeof until !== 'number') return null;
  return { kind: state.flags['away:kind'] === 'infirmary' ? 'infirmary' : 'sabbatical', until };
}

/** Who cut the week, in words: the infirmarian by name, the prior by name, or the man himself. */
function whoCuts(state: GameState): string {
  const house = currentHouse(state);
  const infirmarian = house?.officers?.infirmarian ? state.npcs[house.officers.infirmarian] : undefined;
  if (infirmarian && infirmarian.status === 'active' && infirmarian.id !== 'player') return `${infirmarian.title} ${infirmarian.name.last}, the infirmarian,`;
  const prior = house && !playerIsPrior(state, house) ? priorOf(state, house) : undefined;
  if (prior && prior.status === 'active') return `${prior.title} ${prior.name.last}`;
  return 'You';
}

function note(state: GameState, text: string): GameState {
  return { ...state, career: [...state.career, { week: state.clock.week, kind: 'note', text }] };
}

/**
 * One week of the body's accounting, before the free blocks are spent:
 * a rest begun is begun, a rest running rests him, a rest over ends, and a
 * man past the sick line has his week cut.
 */
export function strainWeek(state: GameState): { state: GameState; line: string | null } {
  const r = state.religious;
  if (!r || !state.flags.ordained || state.study) return { state, line: null };
  const week = state.clock.week;
  const flags: GameState['flags'] = { ...state.flags };
  let next = state;
  // A rest granted: by the province's letter (the scene's flag) or by the prior's permission.
  const permission = typeof flags['permission:sabbatical'] === 'number' ? flags['permission:sabbatical'] : null;
  const granted = flags['sabbatical:asked'] ? 'sabbatical' : flags['infirmary:asked'] ? 'infirmary' : permission !== null && flags['sabbatical:from'] !== permission ? 'sabbatical' : null;
  if (granted && !awayForRest(state)) {
    delete flags['sabbatical:asked'];
    delete flags['infirmary:asked'];
    if (permission !== null) flags['sabbatical:from'] = permission;
    const weeks = granted === 'sabbatical' ? STRAIN.sabbaticalWeeks : STRAIN.infirmaryWeeks;
    flags['away:until'] = week + weeks;
    flags['away:kind'] = granted;
    next = note({ ...next, flags, religious: { ...r, spends: {} } }, granted === 'sabbatical' ? `A sabbatical: ${Math.round(weeks / 4.33)} months away from the work, to rest and to read.` : 'A season in the province\'s infirmary house, among the old men.');
    return { state: next, line: granted === 'sabbatical' ? 'The sabbatical begins: a bag, a box of books, and a house where nobody needs you by name. The work is someone else\'s until you are back.' : 'The infirmary house: a room on the ground floor, Mass for six old men at eight, and an infirmarian who takes your pulse without asking.' };
  }
  const away = awayForRest(state);
  if (away) {
    if (week >= away.until) {
      delete flags['away:until'];
      delete flags['away:kind'];
      next = note({ ...next, flags, strain: Math.max(0, strainOf(state) - STRAIN.awayRecovery) }, away.kind === 'sabbatical' ? 'Back from the sabbatical.' : 'Back from the infirmary house.');
      return { state: next, line: away.kind === 'sabbatical' ? 'Home from the sabbatical with the box of books read and a face the house says looks ten years younger. The week is yours again; the house has kept your stall.' : 'Home from the infirmary house with colour in your face and a list of the old men to visit before they die. The week is yours again.' };
    }
    next = { ...next, strain: Math.max(0, strainOf(state) - STRAIN.awayRecovery), religious: { ...r, spends: {} } };
    const left = away.until - week;
    const say = (away.until - week) % 4 === 0;
    return { state: next, line: say ? (away.kind === 'sabbatical' ? `The sabbatical: ${left} weeks left of a lake, a library, and the Office said at your own hour.` : `The infirmary house: ${left} weeks left of the old men, the eight o'clock Mass, and sleep.`) : null };
  }
  // The sick line: the week is cut by whoever is there to cut it.
  if (strainOf(state) >= STRAIN.sick) {
    const spends = Object.fromEntries(Object.entries(r.spends ?? {}).map(([id, ap]) => [id, Math.floor(ap * STRAIN.cutShare)]).filter(([, ap]) => (ap as number) > 0));
    const cutBefore = typeof flags['strain:cut'] === 'number' ? flags['strain:cut'] : -Infinity;
    const say = week - cutBefore >= STRAIN.cutLineEvery;
    if (say) flags['strain:cut'] = week;
    next = { ...next, flags, strain: Math.max(0, strainOf(state) - STRAIN.cutRecovery), religious: { ...r, spends } };
    if (!say) return { state: next, line: null };
    const who = whoCuts(state);
    return { state: next, line: who === 'You' ? 'You cut your own week: the afternoons in the cell, the work handed on, the Office from the stall and nothing else. The body takes what it is owed.' : `${who} has cut your week: half the free hours are someone else's now, and the afternoons are the cell's. The house covers, and says nothing, which is how it says it.` };
  }
  return { state, line: null };
}
