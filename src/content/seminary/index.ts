import type { Condition, Effect, SummerAssignment } from '@/types';
import summers from './summers.json';

export interface SummerOption {
  id: SummerAssignment;
  label: string;
  blurb: string;
  outcome: string;
  requires?: Condition[];
  effects: Effect[];
}

export const summerOptions = summers as SummerOption[];
