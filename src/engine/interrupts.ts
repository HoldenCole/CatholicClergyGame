import type { EventCategory, InterruptConfig, InterruptLevel, Severity } from '@/types';
import { EVENT_CATEGORIES } from '@/types';

const SEVERITY_RANK: Record<Severity, number> = {
  ROUTINE: 0,
  NOTABLE: 1,
  MAJOR: 2,
  CRITICAL: 3,
};

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

/**
 * DESIGN.md §2.2: stop on everything except routine finance and routine admin.
 */
export function defaultInterruptConfig(): InterruptConfig {
  const config = {} as InterruptConfig;
  for (const category of EVENT_CATEGORIES) config[category] = 'ROUTINE';
  config.finance = 'NOTABLE';
  config.admin = 'NOTABLE';
  return config;
}

/**
 * Whether an event stops the clock under this configuration.
 * CRITICAL events always stop, whatever the setting.
 */
export function shouldInterrupt(
  config: InterruptConfig,
  event: { severity: Severity; category: EventCategory },
): boolean {
  if (event.severity === 'CRITICAL') return true;
  const level: InterruptLevel = config[event.category];
  if (level === 'never') return false;
  return severityRank(event.severity) >= severityRank(level);
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  formation: 'Formation',
  parish_death: 'Parish deaths',
  finance: 'Finance',
  admin: 'Administration',
  chancery: 'Chancery communications',
  group: 'Group problems',
  classmate: 'Classmate news',
  personal: 'Personal and spiritual',
  scandal: 'Scandal',
  assignment: 'Assignment and evaluation',
};
