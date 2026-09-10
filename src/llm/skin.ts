import type { GameEvent, GameState, PendingEvent } from '@/types';
import { arcContext, eventContext, isSensitive } from './context';
import type { Provider } from './provider';

export function eventKey(pending: PendingEvent): string {
  return `event:${pending.eventId}:${pending.week}`;
}

export function outcomeKey(pending: PendingEvent, choiceId: string): string {
  return `outcome:${pending.eventId}:${pending.week}:${choiceId}`;
}

export function arcKey(state: GameState): string | null {
  return state.assignment ? `arc:${state.assignment.parishId}:${state.assignment.startWeek}` : null;
}

const inFlight = new Set<string>();

export interface SkinResult {
  key: string;
  prose: string;
}

/**
 * Skin one thing, if it should be skinned and is not already cached or in
 * flight. Resolves null on anything that should fall back to the authored
 * text. Never throws: failure means the authored body is shown.
 */
async function skin(key: string, cache: Record<string, string>, provider: Provider, build: () => ReturnType<typeof arcContext>): Promise<SkinResult | null> {
  if (cache[key] || inFlight.has(key)) return null;
  const ctx = build();
  if (!ctx) return null;
  inFlight.add(key);
  try {
    const prose = await provider.skin(ctx);
    return { key, prose };
  } catch {
    return null;
  } finally {
    inFlight.delete(key);
  }
}

export function skinEvent(state: GameState, event: GameEvent, pending: PendingEvent, cache: Record<string, string>, provider: Provider): Promise<SkinResult | null> {
  if (isSensitive(event)) return Promise.resolve(null);
  return skin(eventKey(pending), cache, provider, () => eventContext(state, event, pending));
}

export function skinOutcome(state: GameState, event: GameEvent, pending: PendingEvent, choiceId: string, cache: Record<string, string>, provider: Provider): Promise<SkinResult | null> {
  if (isSensitive(event)) return Promise.resolve(null);
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice?.outcome) return Promise.resolve(null);
  return skin(outcomeKey(pending, choiceId), cache, provider, () => eventContext(state, event, pending, choice.outcome));
}

export function skinArc(state: GameState, cache: Record<string, string>, provider: Provider): Promise<SkinResult | null> {
  const key = arcKey(state);
  if (!key) return Promise.resolve(null);
  return skin(key, cache, provider, () => arcContext(state));
}

/** Test hook. */
export function _resetInFlight(): void {
  inFlight.clear();
}
