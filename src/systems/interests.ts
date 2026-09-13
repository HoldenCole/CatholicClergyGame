import type { GameState } from '@/types';

/**
 * Indicate interest: the Gregorian, a parish, the posts. The chancery reads
 * it; the ordination choice and the letters follow it when the man is good
 * enough. Requested in playtesting; numbers invented.
 */
export const INTERESTS = {
  /** How many a man may have on file at once: more reads as asking for everything. */
  max: 3,
  /** A letter a man asked for is likelier to come. */
  offerWeight: 2.5,
  /** A parish he asked for, as a vicar's next posting, on top of the board's weights. */
  postingWeight: 30,
  /** Standing below the ordination bar that a parish asked for still earns a hearing. */
  parishSlack: 10,
} as const;

export interface InterestDef {
  id: string;
  label: string;
  blurb: string;
  /** The letter it makes likelier. */
  offer?: string;
}

export const INTEREST_DEFS: InterestDef[] = [
  { id: 'rome', label: 'The Gregorian', blurb: 'Three years in Rome for a licentiate. The top of the class may go straight from ordination; a strong record earns the letter later.', offer: 'pv_rome_study' },
  { id: 'canon_law', label: 'Canon law in Washington', blurb: 'Two years at the Catholic University for the tribunal. The judicial vicar keeps a list.', offer: 'pv_canon_law_licentiate' },
  { id: 'seminary_faculty', label: 'The seminary faculty', blurb: 'A chair, a classroom, and the formation reports. The rector asks the bishop for men who asked.', offer: 'pv_seminary_faculty' },
  { id: 'hospital', label: 'A hospital chaplaincy', blurb: 'The pager, the wards, the room where families are told things. The director of pastoral care remembers who wanted it.', offer: 'pv_hospital_chaplain' },
  { id: 'newman', label: 'The Newman Center', blurb: 'Sunday night Mass and a room of twenty-year-olds with questions. Campus ministry asks for the men who asked.', offer: 'pv_university_chaplain' },
  { id: 'secretary', label: "The bishop's secretary", blurb: "The calendar, the car, and the bishop's mind from the next chair. He picks the men who wanted it, when he trusts them.", offer: 'pv_bishops_secretary' },
];

export function interestDef(id: string): InterestDef | undefined {
  return INTEREST_DEFS.find((d) => d.id === id);
}

/** Every interest on file, by key: 'rome', 'hospital', 'parish:<id>'. */
export function interestsOf(state: GameState): string[] {
  return Object.keys(state.flags).filter((k) => k.startsWith('interest:') && state.flags[k]).map((k) => k.slice('interest:'.length));
}

export function hasInterest(state: GameState, key: string): boolean {
  return !!state.flags[`interest:${key}`];
}

/** The parish he asked for, if one. */
export function parishInterest(state: GameState): string | null {
  const k = interestsOf(state).find((x) => x.startsWith('parish:'));
  return k ? k.slice('parish:'.length) : null;
}

/** Put an interest on file, or take it off. A man asks for one parish at a time and no more than a few things. */
export function setInterest(state: GameState, key: string, on: boolean): GameState {
  const flags: GameState['flags'] = { ...state.flags };
  if (!on) {
    delete flags[`interest:${key}`];
    return { ...state, flags };
  }
  if (key.startsWith('parish:')) {
    for (const k of Object.keys(flags)) if (k.startsWith('interest:parish:')) delete flags[k];
  }
  const count = Object.keys(flags).filter((k) => k.startsWith('interest:') && flags[k]).length;
  if (count >= INTERESTS.max) throw new Error(`The chancery reads a man with ${INTERESTS.max} interests as asking for everything. Take one off first.`);
  flags[`interest:${key}`] = true;
  const parish = key.startsWith('parish:') ? state.world?.parishes.find((p) => p.id === key.slice('parish:'.length)) : undefined;
  const label = parish ? parish.name : (interestDef(key)?.label ?? key);
  return { ...state, flags, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Told the chancery you would be interested: ${label.toLowerCase().startsWith('the ') ? label.toLowerCase() : label}.` }] };
}
