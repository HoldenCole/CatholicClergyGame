import type { Beat, GameEvent, GameState, OfferDef, PendingEvent } from '@/types';
import { applyChoice, defaultChoice, drawEvents, fireEvent } from './events';
import { shouldInterrupt } from './interrupts';
import { offersWeek } from './offers';
import type { Rng } from './rng';
import { formationBeats, markBeatFired, weekPool } from './seminary';
import { renderText } from './text';
import type { WeekHook } from './clock';

export interface EventDeps {
  pool: GameEvent[];
  lookup: (id: string) => GameEvent | undefined;
  offers?: OfferDef[];
  offerLookup?: (id: string) => OfferDef | undefined;
}

/** Offers tick after everything else in the week. */
export function offersStep(state: GameState, rng: Rng, deps: EventDeps): GameState {
  if (!deps.offers || !deps.offerLookup) return state;
  return offersWeek(state, rng, deps.offers, deps.offerLookup);
}

/** Whether a fired event reaches the player or resolves itself at the current speed. */
export function reachesPlayer(state: GameState, pending: PendingEvent): boolean {
  if (state.speed === 'MANUAL' || state.speed === 'PAUSED') return true;
  if (pending.severity === 'CRITICAL') return true;
  if (state.speed === 'SKIP') return false;
  return shouldInterrupt(state.interrupts, pending);
}

function addDigestLine(state: GameState, line: string): GameState {
  const last = state.digest[state.digest.length - 1];
  if (!last || last.week !== state.clock.week) {
    return { ...state, digest: [...state.digest, { week: state.clock.week, lines: [line] }] };
  }
  return { ...state, digest: [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, line] }] };
}

/**
 * Fire an event and either queue it for the player or resolve it with its
 * default choice, following any follow-up chain the same way.
 */
export function fireOrResolve(state: GameState, event: GameEvent, rng: Rng, deps: EventDeps): GameState {
  const fired = fireEvent(state, event, rng);
  let next = markBeatFired(fired.state, event);
  const pending = fired.pending;
  if (reachesPlayer(next, pending)) {
    return { ...next, pending: [...next.pending, pending] };
  }
  const choice = defaultChoice(event, next, pending.bindings);
  if (!choice) return { ...next, pending: [...next.pending, pending] };
  next = { ...next, pending: [...next.pending, pending] };
  const result = applyChoice(next, event, pending, choice.id, deps.lookup, true);
  next = addDigestLine(result.state, `${renderText(event.title, next, pending.bindings)}: ${renderText(choice.label, next, pending.bindings)}.`);
  if (result.followUp) return fireOrResolve(next, result.followUp, rng, deps);
  return next;
}

/** Resolve a pending event with the player's choice; fire its follow-up if any. */
export function resolvePending(state: GameState, pending: PendingEvent, choiceId: string, rng: Rng, deps: EventDeps): GameState {
  const event = deps.lookup(pending.eventId);
  if (!event) throw new Error(`unknown event ${pending.eventId}`);
  const result = applyChoice(state, event, pending, choiceId, deps.lookup);
  const choice = event.choices.find((c) => c.id === choiceId)!;
  let next = addDigestLine(result.state, `${renderText(event.title, state, pending.bindings)}: ${renderText(choice.label, state, pending.bindings)}.`);
  if (result.followUp) {
    const fired = fireEvent(next, result.followUp, rng);
    next = { ...markBeatFired(fired.state, result.followUp), pending: [...fired.state.pending, { ...fired.pending, bindings: { ...pending.bindings, ...fired.pending.bindings } }] };
  }
  return next;
}

/** The seminary week: formation accrual and beats, then any played-week event. */
export function seminaryWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng, reachedBeats: Beat[]) => {
    const next = formationBeats(state, reachedBeats);
    if (next.mode.kind !== 'clock' || !next.seminary) return next;
    const pool = weekPool(deps.pool, next);
    if (pool.length === 0) return next;
    const [event] = drawEvents(pool, next, rng, 1);
    if (!event) return next;
    return fireOrResolve(next, event, rng, deps);
  };
}
