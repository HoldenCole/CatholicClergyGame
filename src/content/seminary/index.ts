import type { Condition, Effect, SeminaryActivityDef, SummerAssignment } from '@/types';
import summers from './summers.json';
import religiousSummers from '../religious/summers.json';
import activities from './activities.json';

export interface SummerOption {
  id: SummerAssignment;
  label: string;
  blurb: string;
  outcome: string;
  requires?: Condition[];
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
