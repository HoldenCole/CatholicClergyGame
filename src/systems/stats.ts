import type { StatKey, Stats } from '@/types';
import { DECAY, STAT_LOG_KNEE, STAT_LOG_SCALE, STAT_MAX, STAT_MIN } from './tuning';

export function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

/** Multiplier on a positive gain at the given current value. 1 at or below the knee. */
export function gainFactor(current: number): number {
  if (current <= STAT_LOG_KNEE) return 1;
  return 1 / (1 + (current - STAT_LOG_KNEE) / STAT_LOG_SCALE);
}

/**
 * Apply a delta to one stat. Gains are scaled by the logarithmic curve above
 * the knee, integrating across the knee so a large gain from 65 does not get
 * the full rate all the way to 90. Losses apply in full.
 */
export function applyStatDelta(current: number, delta: number): number {
  if (delta <= 0) return clampStat(current + delta);
  let value = current;
  let remaining = delta;
  // Integrate in small steps so the factor tracks the rising value.
  const step = 0.5;
  while (remaining > 0 && value < STAT_MAX) {
    const chunk = Math.min(step, remaining);
    value += chunk * gainFactor(value);
    remaining -= chunk;
  }
  return clampStat(value);
}

export function applyStat(stats: Stats, key: StatKey, delta: number): Stats {
  return { ...stats, [key]: applyStatDelta(stats[key], delta) };
}

export interface WeekUsage {
  /** AP spent on administration this week. */
  adminAp: number;
  theologyUsed: boolean;
  knowledgeUsed: boolean;
}

/**
 * One week of decay. DESIGN.md §4.2: Administration and Charisma never decay;
 * Theology and Knowledge atrophy if unused; Piety drains in proportion to
 * administrative load. Decay never pulls a stat below the floor.
 */
export function decayWeek(stats: Stats, usage: WeekUsage): Stats {
  const floored = (value: number, loss: number) =>
    value <= DECAY.floor ? value : Math.max(DECAY.floor, value - loss);
  return {
    ...stats,
    theology: usage.theologyUsed ? stats.theology : floored(stats.theology, DECAY.atrophyPerWeek),
    knowledge: usage.knowledgeUsed ? stats.knowledge : floored(stats.knowledge, DECAY.atrophyPerWeek),
    piety: floored(stats.piety, DECAY.pietyBasePerWeek + DECAY.pietyPerAdminAp * Math.max(0, usage.adminAp)),
  };
}

export function emptyStats(value = 0): Stats {
  return { administration: value, charisma: value, theology: value, knowledge: value, piety: value };
}
