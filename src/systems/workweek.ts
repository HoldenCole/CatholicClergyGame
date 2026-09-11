import type { GameSettings, GameState, WorkWeek } from '@/types';

/**
 * Settings the player keeps in the save: how long a week he works, and how
 * much a long week wears on him. Requested in playtesting; numbers invented.
 */
export const WORK_WEEKS: Record<WorkWeek, { label: string; blurb: string; parish: number; free: number }> = {
  light: { label: 'A light week', blurb: 'About 40 working hours in a parish, four free hours a week in seminary. The diocese notices, eventually.', parish: 10, free: -1 },
  standard: { label: 'A working week', blurb: 'About 48 hours in a parish after Mass, the Office, and meals; five free hours a week in seminary.', parish: 12, free: 0 },
  long: { label: 'A long week', blurb: 'About 56 hours. Every extra block wears on you a little, at whatever rate you set below.', parish: 14, free: 1 },
  punishing: { label: 'A punishing week', blurb: 'About 64 hours. The kind of week that ends careers, or makes them.', parish: 16, free: 2 },
};

export const WEAR_LEVELS: { value: number; label: string; blurb: string }[] = [
  { value: 0, label: 'None', blurb: 'Long weeks and sacrifices cost nothing. A game about the work, not the body.' },
  { value: 0.5, label: 'Light', blurb: 'Half the wear. Burnout is possible but takes years of carelessness.' },
  { value: 1, label: 'Normal', blurb: 'A long week or a cut night adds up; rest brings it back.' },
  { value: 1.5, label: 'Heavy', blurb: 'The body keeps strict accounts.' },
  { value: 2, label: 'Brutal', blurb: 'A punishing week will break you inside two years unless you rest.' },
];

export const DEFAULT_SETTINGS: GameSettings = { workWeek: 'standard', wear: 1 };

export function settingsOf(state: GameState): GameSettings {
  return state.settings ?? DEFAULT_SETTINGS;
}

export const HOURS_RANGE = { min: 32, max: 80, step: 4 } as const;

/** Working hours a week: the slider if set, else the preset. */
export function workHours(state: GameState): number {
  const s = settingsOf(state);
  if (typeof s.hours === 'number') return Math.max(HOURS_RANGE.min, Math.min(HOURS_RANGE.max, Math.round(s.hours / HOURS_RANGE.step) * HOURS_RANGE.step));
  return WORK_WEEKS[s.workWeek].parish * 4;
}

/** Parish blocks a week under the setting. */
export function parishBlocks(state: GameState): number {
  return Math.round(workHours(state) / 4);
}

/** Blocks above the standard week: each wears, at the wear rate. */
export function extraBlocks(state: GameState): number {
  return Math.max(0, parishBlocks(state) - WORK_WEEKS.standard.parish);
}

/** Free-hour adjustment for the seminary and study weeks. */
export function freeHourShift(state: GameState): number {
  const s = settingsOf(state);
  if (typeof s.hours === 'number') return Math.round((workHours(state) - 48) / 8);
  return WORK_WEEKS[s.workWeek].free;
}

export function wearOf(state: GameState): number {
  return settingsOf(state).wear;
}
