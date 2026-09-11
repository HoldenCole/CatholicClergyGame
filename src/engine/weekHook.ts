import type { Beat, GameEvent, GameState, OfferDef, PendingEvent, Role } from '@/types';
import { applyChoice, defaultChoice, drawEvents, fireEvent } from './events';
import { shouldInterrupt } from './interrupts';
import { offersWeek } from './offers';
import type { Rng } from './rng';
import { formationBeats, markBeatFired, weekPool } from './seminary';
import { isPlayedWeek, parishWeek } from './parish';
import { careerYear, directedTransfer, isCareerYear, nextAssignment } from './career';
import { projectWeek } from '@/systems/projects';
import { workWeek } from '@/systems/problems';
import { resolvePermissions } from '@/systems/decor';
import { seminaryWeek } from '@/systems/seminaryWeek';
import { studyWeek } from '@/systems/studyWeek';
import { endStudy } from './study';
import { careOf, WEEK } from '@/systems/week';
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
    let next = formationBeats(state, reachedBeats);
    if (next.mode.kind !== 'clock' || !next.seminary) return next;
    // What he did with the week, whether or not anything else happens in it.
    const week = seminaryWeek(next, rng.derive(`seminary-week:${next.clock.week}`));
    next = week.line ? addDigestLine(week.state, week.line) : week.state;
    const pool = weekPool(deps.pool, next);
    if (pool.length === 0) return next;
    const [event] = drawEvents(pool, next, rng, 1);
    if (!event) return next;
    return fireOrResolve(next, event, rng, deps);
  };
}

/** A well-tended parish has fewer fires: finance, admin, and group problems draw less often at high care. */
export function careRelief(state: GameState): (e: GameEvent) => number {
  const relief = WEEK.careProblemRelief * careOf(state);
  return (e) => (FIRE_CATEGORIES.has(e.category) ? 1 - relief : 1);
}
const FIRE_CATEGORIES = new Set<GameEvent['category']>(['finance', 'admin', 'group']);

/** Roughly how often a week away carries a scene. Invented. */
const STUDY_EVENT_CHANCE = 0.1;

/** The week away: the hours resolve, a scene may come, the years end with the board. */
export function studyWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng) => {
    if (!state.study) return state;
    const week = studyWeek(state, rng.derive(`study-week:${state.clock.week}`));
    let next = week.line ? addDigestLine(week.state, week.line) : week.state;
    if (isCareerYear(next)) next = careerYear(next, rng);
    if (next.mode.kind !== 'clock') return next;
    if (next.study && next.clock.week >= next.study.endWeek) {
      const def = deps.offerLookup?.(next.study.offerId);
      if (def) return addDigestLine(endStudy(next, def, rng.derive(`study-end:${next.clock.week}`)), 'The degree is defended, the room is packed, and the plane home is full of people going somewhere else.');
    }
    if (rng.derive(`study-scene:${next.clock.week}`).chance(STUDY_EVENT_CHANCE)) {
      const [event] = drawEvents(deps.pool.filter((e) => !e.beat), next, rng, 1);
      if (event) next = fireOrResolve(next, event, rng, deps);
    }
    if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    return offersStep(next, rng, deps);
  };
}

/** The parish week: the routine resolves, a played week may fire an event, the arc may end, offers tick. */
export function parishWeekHook(deps: EventDeps): WeekHook {
  return (state: GameState, rng: Rng, reachedBeats: Beat[]) => {
    if (!state.parish) return state;
    // A move he said yes to last week: the letter arrives, and the week is spent packing.
    const pending = state.flags.transfer_pending;
    if (typeof pending === 'string') {
      const [kind, role] = pending.split(':');
      const asRole: Role = role === 'pastor' || role === 'administrator' ? role : 'parochial_vicar';
      const moved = directedTransfer(state, rng, kind ?? 'difficult', asRole);
      if (moved.moved) return addDigestLine(moved.state, 'The letter of appointment came, as the vicar for clergy said it would. You packed.');
    }
    let next = parishWeek(state, rng);
    const project = projectWeek(next);
    next = project.state;
    if (project.line) next = addDigestLine(next, project.line);
    const work = workWeek(next);
    next = work.state;
    if (work.line) next = addDigestLine(next, work.line);
    const letters = resolvePermissions(next, rng.derive(`permissions:${next.clock.week}`));
    next = letters.state;
    for (const line of letters.lines) next = addDigestLine(next, line);
    if (isCareerYear(next)) next = careerYear(next, rng);
    if (next.mode.kind !== 'clock') return next;
    if (next.flags.new_bishop_pending) {
      // A succession always gets its scene, played week or not. DESIGN 5.3
      const [event] = drawEvents(deps.pool.filter((e) => e.beat === 'succession'), next, rng, 1);
      next = { ...next, flags: { ...next.flags, new_bishop_pending: false } };
      if (event) next = fireOrResolve(next, event, rng, deps);
      if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    }
    if (isPlayedWeek(next)) {
      // Beat events (a succession) fire only through their beat, never on an ordinary played week.
      const [event] = drawEvents(deps.pool.filter((e) => !e.beat), next, rng, 1, careRelief(next));
      if (event) next = fireOrResolve(next, event, rng, deps);
    }
    if (reachedBeats.some((b) => b.kind === 'assignment') && next.mode.kind === 'clock') {
      next = nextAssignment(next, rng).state;
    }
    if (next.mode.kind !== 'clock' || next.pending.length > 0) return next;
    return offersStep(next, rng, deps);
  };
}
