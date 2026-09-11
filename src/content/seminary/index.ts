import type { Condition, Effect, SeminaryActivityDef, SummerAssignment } from '@/types';
import summers from './summers.json';
import activities from './activities.json';

export interface SummerOption {
  id: SummerAssignment;
  label: string;
  blurb: string;
  outcome: string;
  requires?: Condition[];
  effects: Effect[];
}

export const summerOptions = summers as SummerOption[];

export const seminaryActivities = activities as SeminaryActivityDef[];

export function seminaryActivity(id: string): SeminaryActivityDef | undefined {
  return seminaryActivities.find((a) => a.id === id);
}
