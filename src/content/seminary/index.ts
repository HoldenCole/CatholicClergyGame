import type { Condition, DevotionDef, Effect, RecreationDef, SeminaryActivityDef, SeminaryHorariumDef, SummerAssignment } from '@/types';
import rule from './rule.json';
import summers from './summers.json';
import religiousSummers from '../religious/summers.json';
import activities from './activities.json';
import rome from './rome.json';

export interface SummerOption {
  id: SummerAssignment;
  label: string;
  blurb: string;
  outcome: string;
  /** Greyed when these fail: the man is not ready for it. */
  requires?: Condition[];
  /** Not listed at all where these fail: the diocese has no such place. Diocese-specific summers live here. */
  where?: Condition[];
  effects: Effect[];
  /** Absent: the diocesan seminary's. E3: an order's summers live in content/religious/summers.json. */
  campaign?: 'diocesan' | 'religious';
  orders?: string[];
  /** The kinds of house a formation year is lived in that this summer fits: a novice's summer is not a student's. */
  houses?: string[];
}

export const summerOptions = summers as SummerOption[];
export const religiousSummerOptions = (religiousSummers as { summers: SummerOption[] }).summers;

/** Every summer there is, for the record. */
export function summerOptionById(id: string): SummerOption | undefined {
  return summerOptions.find((o) => o.id === id) ?? religiousSummerOptions.find((o) => o.id === id);
}

export const seminaryActivities = activities as SeminaryActivityDef[];

export function seminaryActivity(id: string): SeminaryActivityDef | undefined {
  return seminaryActivities.find((a) => a.id === id);
}

/** The seminary as a house with a rule: the day as posted, its lines, the devotions, the evenings. content/seminary/rule.json */
const ruleContent = rule as unknown as { day: { time: string; label: string }[]; horarium: SeminaryHorariumDef[]; devotions: DevotionDef[]; recreation: RecreationDef[] };
export const horariumDay = ruleContent.day;
export const seminaryHorariumDefs = ruleContent.horarium;
export const devotionDefs = ruleContent.devotions;
export const recreationDefs = ruleContent.recreation;

/** The North American College: the seminary in Rome, its day, the universities it sends its men to. content/seminary/rome.json */
export interface RomeUniversityDef {
  id: string;
  label: string;
  blurb: string;
  share: number;
  lean: number;
  stats: Partial<Record<'theology' | 'knowledge' | 'piety' | 'administration', number>>;
}
export const romeCollege = rome as unknown as { name: string; short: string; city: string; day: { time: string; label: string }[]; universities: RomeUniversityDef[]; classes: Record<string, string>; arrival: string; lines: Record<string, string> };
