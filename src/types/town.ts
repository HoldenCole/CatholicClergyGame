/**
 * The town as a place: the parish's neighbourhood with a life of its own.
 * DESIGN §8.9. Every parish has a handful of places rolled from archetypes
 * by terrain (content/town.json), named from pools, changing over the
 * years, remembering what the priest did among them.
 */
export type TownPlaceKind =
  | 'diner' | 'employer' | 'school' | 'funeral_home' | 'bar' | 'field' | 'other_church' | 'hall'
  | 'store' | 'library' | 'city_hall' | 'clinic' | 'shelter' | 'nursing_home' | 'park' | 'station';

export const TOWN_PLACE_KINDS: readonly TownPlaceKind[] = [
  'diner', 'employer', 'school', 'funeral_home', 'bar', 'field', 'other_church', 'hall',
  'store', 'library', 'city_hall', 'clinic', 'shelter', 'nursing_home', 'park', 'station',
] as const;

/** How a place is doing. `new` is a place opened this year in a kind the town had lost. */
export type TownPlaceState = 'open' | 'thriving' | 'failing' | 'closing' | 'closed' | 'new';

export const TOWN_PLACE_STATES: readonly TownPlaceState[] = ['open', 'thriving', 'failing', 'closing', 'closed', 'new'] as const;

export interface TownPlace {
  id: string;
  kind: TownPlaceKind;
  /** "Kowalski's", "the Route 9 plant", "Central High". */
  name: string;
  /** One line on what it is to the parish, rolled at generation. */
  blurb: string;
  state: TownPlaceState;
  /** The week the state last changed. */
  sinceWeek: number;
  /** −100..100: what the place's people make of the priest. */
  regard: number;
  /** A surname for the one who runs it, where the archetype has an owner. */
  owner?: string;
}

/** What the town remembers of him: one line, and the week. */
export interface TownMemory {
  week: number;
  text: string;
}

export interface Town {
  parishId: string;
  /** The parish's place line: "Pilsen", "Winnetka", "Galveston". */
  name: string;
  places: TownPlace[];
  memory: TownMemory[];
}
