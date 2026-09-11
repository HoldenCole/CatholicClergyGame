import type { HiddenTrait } from '@/types';

/** What the player has learned about a person, once he has. DESIGN §9.2: never shown before then. */
export const TRAIT_LABEL: Record<HiddenTrait, string> = {
  fragile: 'more fragile than he lets on',
  careerist: 'a careerist, under it all',
  mystic: 'a genuine mystic',
  hiding_something: 'hiding something',
  smarter_than_he_lets_on: 'smarter than he lets on',
  loyal: 'loyal past reason',
  restless: 'restless',
};
