import type { Choice, GameEvent, GameState, HistoryEntry, PendingEvent } from '@/types';
import { evaluateAll, evaluateCondition } from './conditions';
import { applyEffects } from './effects';
import type { Rng } from './rng';
import { resolveSelector, selectorsIn } from './selectors';
import { recordPosition } from '@/systems/reputation';

export const WEEKS_PER_YEAR = 52;

/** Whether an event may fire now. Suppression, once, and pending are all checked here. */
export function isEligible(event: GameEvent, state: GameState): boolean {
  if (event.phase !== state.phase) return false;
  if (event.yearGate && state.seminary && !event.yearGate.includes(state.seminary.year)) return false;
  if (event.once && state.firedOnce.includes(event.id)) return false;
  const until = state.suppressedUntil[event.id];
  if (until !== undefined && state.clock.week < until) return false;
  if (state.pending.some((p) => p.eventId === event.id)) return false;
  if (!evaluateAll(event.requires, state)) return false;
  // Every selector the event needs must resolve, or the text would have holes.
  for (const sel of eventSelectors(event)) {
    if (sel === '@random_classmate') continue;
    if (!resolveSelector(state, sel)) return false;
  }
  return true;
}

/** DESIGN.md §12.2: the draw is weighted by character, not uniform. */
export function eventWeight(event: GameEvent, state: GameState): number {
  let w = event.baseWeight;
  for (const b of event.bias ?? []) {
    if (evaluateCondition(b.when, state)) w *= b.multiplier;
  }
  return Math.max(0, w);
}

/** All selectors an event mentions in text, choices, conditions, and effects. */
export function eventSelectors(event: GameEvent): string[] {
  const out = new Set<string>(selectorsIn(event.title + ' ' + event.body));
  const scanCond = (c: unknown): void => {
    if (!c || typeof c !== 'object') return;
    const rec = c as Record<string, unknown>;
    if (rec.type === 'relationship' && typeof rec.npcId === 'string' && rec.npcId.startsWith('@')) out.add(rec.npcId);
    if (Array.isArray(rec.inner)) rec.inner.forEach(scanCond);
    else if (rec.inner) scanCond(rec.inner);
  };
  event.requires?.forEach(scanCond);
  event.bias?.forEach((b) => scanCond(b.when));
  for (const choice of event.choices) {
    selectorsIn(choice.label + ' ' + (choice.outcome ?? '')).forEach((s) => out.add(s));
    choice.requires?.forEach(scanCond);
    for (const e of choice.effects) {
      if ((e.target === 'relationship' || e.target === 'npc') && e.key.startsWith('@')) out.add(e.key);
    }
  }
  return [...out];
}

/**
 * Draw up to `count` distinct eligible events, weighted, without replacement.
 * Consumes the RNG once per pick.
 */
export function drawEvents(pool: GameEvent[], state: GameState, rng: Rng, count: number): GameEvent[] {
  let candidates = pool.filter((e) => isEligible(e, state));
  const weights = new Map(candidates.map((e) => [e.id, eventWeight(e, state)]));
  candidates = candidates.filter((e) => (weights.get(e.id) ?? 0) > 0);
  const picked: GameEvent[] = [];
  while (picked.length < count && candidates.length > 0) {
    const chosen = rng.weighted(candidates, (e) => weights.get(e.id) ?? 0);
    picked.push(chosen);
    candidates = candidates.filter((e) => e.id !== chosen.id);
  }
  return picked;
}

/**
 * Fire an event: bind its selectors, mark suppression and once, and return
 * the pending entry plus the updated state. The pending entry is NOT added to
 * the queue here; the caller decides whether to queue or auto-resolve it.
 */
export function fireEvent(
  state: GameState,
  event: GameEvent,
  rng: Rng,
): { state: GameState; pending: PendingEvent } {
  const bindings: Record<string, string> = {};
  for (const sel of eventSelectors(event)) {
    const npc = resolveSelector(state, sel, rng);
    if (npc) bindings[sel] = npc.id;
  }
  const pending: PendingEvent = {
    eventId: event.id,
    severity: event.severity,
    category: event.category,
    week: state.clock.week,
    bindings,
  };
  const next: GameState = {
    ...state,
    suppressedUntil: {
      ...state.suppressedUntil,
      [event.id]: state.clock.week + Math.max(1, event.suppressYears) * WEEKS_PER_YEAR,
    },
    firedOnce: event.once ? [...state.firedOnce, event.id] : state.firedOnce,
  };
  return { state: next, pending };
}

export interface ChoiceView {
  choice: Choice;
  available: boolean;
}

/** Choices to show: unavailable ones are shown greyed unless `hidden`. */
export function visibleChoices(event: GameEvent, state: GameState, bindings: Record<string, string>): ChoiceView[] {
  return event.choices
    .map((choice) => ({ choice, available: evaluateAll(choice.requires, state, bindings) }))
    .filter((v) => v.available || !v.choice.hidden);
}

/** The choice taken when the player is not consulted. */
export function defaultChoice(event: GameEvent, state: GameState, bindings: Record<string, string>): Choice | null {
  const views = visibleChoices(event, state, bindings).filter((v) => v.available);
  return views.find((v) => v.choice.default)?.choice ?? views[0]?.choice ?? null;
}

export interface ApplyResult {
  state: GameState;
  /** A follow-up event that should fire immediately with the same bindings. */
  followUp: GameEvent | null;
}

/**
 * Resolve a pending event with a choice: apply effects, record positions and
 * threads, log history, dequeue. Throws if the choice is unavailable.
 */
export function applyChoice(
  state: GameState,
  event: GameEvent,
  pending: PendingEvent,
  choiceId: string,
  lookup: (id: string) => GameEvent | undefined,
  auto = false,
): ApplyResult {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`event ${event.id} has no choice ${choiceId}`);
  if (!evaluateAll(choice.requires, state, pending.bindings)) {
    throw new Error(`choice ${choiceId} of ${event.id} is not available`);
  }
  let next = applyEffects(state, choice.effects, pending.bindings);

  if (choice.volume && choice.positionTopic !== undefined && choice.positionValue !== undefined && next.character) {
    next = {
      ...next,
      character: recordPosition(next.character, {
        topic: choice.positionTopic,
        value: choice.positionValue,
        volume: choice.volume,
        week: state.clock.week,
      }),
    };
  }
  if (choice.opensThread) {
    next = {
      ...next,
      threads: {
        ...next.threads,
        [choice.opensThread]: { id: choice.opensThread, openedWeek: state.clock.week, openedBy: event.id },
      },
    };
  }
  if (choice.resolvesThread) {
    const threads = { ...next.threads };
    delete threads[choice.resolvesThread];
    next = { ...next, threads };
  }
  const entry: HistoryEntry = { eventId: event.id, choiceId, week: state.clock.week, ...(auto ? { auto: true } : {}) };
  next = {
    ...next,
    history: [...next.history, entry],
    pending: next.pending.filter((p) => p !== pending && p.eventId !== pending.eventId),
  };
  const followUp = choice.followUpId ? (lookup(choice.followUpId) ?? null) : null;
  return { state: next, followUp };
}
