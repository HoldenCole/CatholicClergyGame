import type { GameEvent } from '@/types';

interface EventFile {
  _notes?: string;
  events: GameEvent[];
}

const modules = import.meta.glob<{ default: EventFile }>('./events/**/*.json', { eager: true });

/** Every authored event, across all pools. */
export const allEvents: GameEvent[] = Object.keys(modules)
  .sort()
  .flatMap((path) => modules[path]!.default.events);

const byId = new Map(allEvents.map((e) => [e.id, e]));

export function eventById(id: string): GameEvent | undefined {
  return byId.get(id);
}

export function eventsForPhase(phase: GameEvent['phase']): GameEvent[] {
  return allEvents.filter((e) => e.phase === phase);
}

/** Path of each content file, for validation messages. */
export const eventFiles: Record<string, EventFile> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [path, m.default]),
);
