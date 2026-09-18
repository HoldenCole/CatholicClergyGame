/**
 * The book: what a ministry adds up to. DESIGN.md §8.6.
 *
 * Fractional while it accrues — a parish of two thousand households buries
 * about one person a week and marries one a fortnight — and whole only when
 * the sheet prints it.
 */
export interface Ministry {
  masses: number;
  confessions: number;
  baptisms: number;
  firstCommunions: number;
  confirmations: number;
  weddings: number;
  funerals: number;
  anointings: number;
  /** Received into the Church: converts and those already baptized elsewhere. */
  converts: number;
  /** Men ordained by his own hands, in the last act. */
  ordinations: number;
}

export type MinistryKey = keyof Ministry;

export const MINISTRY_KEYS: readonly MinistryKey[] = [
  'masses',
  'confessions',
  'baptisms',
  'firstCommunions',
  'confirmations',
  'weddings',
  'funerals',
  'anointings',
  'converts',
  'ordinations',
] as const;
