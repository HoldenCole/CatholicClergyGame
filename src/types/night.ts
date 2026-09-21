/**
 * The house at night. DESIGN §8.13: the rectory after the office closes,
 * or the priory after Compline. A small nightly state the week draws from
 * and the years shape. Shown in words, never numbers; the bottle is never
 * a number at all, only a thread in authored scenes.
 */
export type EveningKind = 'company' | 'quiet' | 'reading' | 'the_phone' | 'the_breviary' | 'television';

export const EVENING_KINDS: readonly EveningKind[] = ['company', 'quiet', 'reading', 'the_phone', 'the_breviary', 'television'] as const;

export interface NightState {
  /** What he does with an evening, as a standing habit. */
  evenings: EveningKind;
  /** 0..100: how peopled his evenings are. */
  company: number;
  /** 0..100: whether the nights rest him. */
  rest: number;
  /** 0..100: whether the breviary is kept at night. */
  prayer: number;
  /** Weeks in a row the nights have been alone and the days too much. */
  aloneWeeks: number;
  /** The week the last night scene was drawn. */
  sceneWeek?: number;
}
