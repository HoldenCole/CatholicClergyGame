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

/**
 * Standing with each constituency, −100..+100. See DESIGN.md §5.1. The keys
 * are the union of every campaign's set; which of them are live in a run is
 * data (content/campaigns.json), read through systems/campaign.ts. E3 §3.9.
 */
export type DiocesanConstituencyKey =
  | 'chancery'
  | 'brother_priests'
  | 'parishioners'
  | 'traditional_bloc'
  | 'progressive_bloc'
  | 'public'
  | 'rome';

/** The religious campaign's set. `progressive_bloc` and `rome` are shared keys with their own labels there. */
export type ReligiousConstituencyKey =
  | 'community'
  | 'province'
  | 'superiors'
  | 'local_bishop'
  | 'laity'
  | 'order'
  | 'observant_bloc'
  /** The presbyterate of the diocese he is posted in now: the deanery, the pastors who ask for him. E3 §3.12. */
  | 'diocesan_clergy';

export type ConstituencyKey = DiocesanConstituencyKey | ReligiousConstituencyKey;

/** The diocesan campaign's constituencies, the base game's set, in the order the sheets show them. */
export const CONSTITUENCY_KEYS: readonly DiocesanConstituencyKey[] = [
  'chancery',
  'brother_priests',
  'parishioners',
  'traditional_bloc',
  'progressive_bloc',
  'public',
  'rome',
] as const;

export const RELIGIOUS_CONSTITUENCY_KEYS: readonly ReligiousConstituencyKey[] = [
  'community',
  'province',
  'superiors',
  'local_bishop',
  'laity',
  'order',
  'observant_bloc',
  'diocesan_clergy',
] as const;

export const ALL_CONSTITUENCY_KEYS: readonly ConstituencyKey[] = [...CONSTITUENCY_KEYS, ...RELIGIOUS_CONSTITUENCY_KEYS] as const;

/**
 * The base keys are always present; the religious keys exist only once
 * something has written them, so a diocesan save is byte-for-byte what it was.
 * Read a key through `standing()` in systems/reputation.ts rather than by index.
 */
export type Reputation = Record<DiocesanConstituencyKey, number> & Partial<Record<ReligiousConstituencyKey, number>>;

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
