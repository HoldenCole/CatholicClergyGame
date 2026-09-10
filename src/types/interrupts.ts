import type { EventCategory, Severity } from './events';

/**
 * The minimum severity at which an event in a category stops the clock.
 * `never` means the category never interrupts. CRITICAL events always stop
 * regardless of configuration.
 */
export type InterruptLevel = 'ROUTINE' | 'NOTABLE' | 'MAJOR' | 'CRITICAL' | 'never';

export type InterruptConfig = Record<EventCategory, InterruptLevel>;

export const INTERRUPT_LEVELS: readonly InterruptLevel[] = [
  'ROUTINE',
  'NOTABLE',
  'MAJOR',
  'CRITICAL',
  'never',
] as const;

/** Convenience alias used by the clock when explaining why it stopped. */
export type StopSeverity = Severity;
