/** The five core stats. Scale 0–100. See DESIGN.md §4.1. */
export type StatKey = 'administration' | 'charisma' | 'theology' | 'knowledge' | 'piety';

export const STAT_KEYS: readonly StatKey[] = [
  'administration',
  'charisma',
  'theology',
  'knowledge',
  'piety',
] as const;

export type Stats = Record<StatKey, number>;

/** Standing with each constituency, −100..+100. See DESIGN.md §5.1. */
export type ConstituencyKey =
  | 'chancery'
  | 'brother_priests'
  | 'parishioners'
  | 'traditional_bloc'
  | 'progressive_bloc'
  | 'public'
  | 'rome';

export const CONSTITUENCY_KEYS: readonly ConstituencyKey[] = [
  'chancery',
  'brother_priests',
  'parishioners',
  'traditional_bloc',
  'progressive_bloc',
  'public',
  'rome',
] as const;

export type Reputation = Record<ConstituencyKey, number>;

/** How loudly a position was taken. See DESIGN.md §5.2. */
export type Volume = 'private' | 'semi_public' | 'public';

/** Career phase. See DESIGN.md §12.3. */
export type Phase =
  | 'seminary'
  /** Away for a degree: Rome or Washington. DESIGN §7.5, academic. */
  | 'study'
  | 'parochial_vicar'
  | 'administrator'
  | 'pastor'
  | 'chancery'
  | 'bishop';

/** A recorded position on a contested topic. */
export interface PositionRecord {
  topic: string;
  /** −100 (traditional) .. +100 (progressive) */
  value: number;
  volume: Volume;
  /** Absolute game week the position was taken. */
  week: number;
}
