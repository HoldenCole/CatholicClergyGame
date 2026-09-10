import type { Beat, DigestWeek, GameState, PendingEvent, Speed } from '@/types';
import type { Rng } from './rng';
import { shouldInterrupt } from './interrupts';
import { advanceClock, describeWeek, gameYearOf, isYearStart } from './time';

/** Why the clock stopped. */
export type StopReason =
  | { kind: 'paused' }
  | { kind: 'manual' }
  | { kind: 'event'; event: PendingEvent }
  | { kind: 'beat'; beat: Beat }
  | { kind: 'mode'; mode: GameState['mode']['kind'] }
  | { kind: 'offer'; offerId: string }
  | { kind: 'cap' };

/**
 * Supplies the events that fire during a week. Phase 1's event engine plugs in
 * here; the clock itself never touches the content pool. Must be deterministic
 * given (state, rng).
 */
export type WeekDraw = (state: GameState, rng: Rng) => PendingEvent[];

export const noDraw: WeekDraw = () => [];

/**
 * A general per-week hook run after the clock moves and events are drawn.
 * The seminary and parish loops install theirs here. Must be deterministic.
 */
export type WeekHook = (state: GameState, rng: Rng, reachedBeats: Beat[]) => GameState;

export const noHook: WeekHook = (state) => state;

/** Beats that only mark the digest; the clock does not stop for them. */
const INFORMATIONAL_BEATS: ReadonlySet<Beat['kind']> = new Set(['year_end']);

/** How many digest weeks the state retains. */
export const DIGEST_RETENTION = 52;

export interface WeekResult {
  state: GameState;
  reachedBeats: Beat[];
  fired: PendingEvent[];
}

/**
 * Advance exactly one week. Pure: returns a new state, never mutates.
 * Order within the week: move the clock, cross any year boundary, consume
 * scheduled beats, draw events, write the digest line.
 */
export function advanceWeek(
  state: GameState,
  rng: Rng,
  draw: WeekDraw = noDraw,
  hook: WeekHook = noHook,
): WeekResult {
  const clock = advanceClock(state.clock, 1);
  const week = clock.week;

  const reachedBeats: Beat[] = [];
  if (isYearStart(clock)) {
    reachedBeats.push({
      kind: 'year_end',
      week,
      label: `Year ${gameYearOf(clock)} begins`,
    });
  }
  const remaining: Beat[] = [];
  for (const beat of state.beats) {
    if (beat.week <= week) reachedBeats.push(beat);
    else remaining.push(beat);
  }

  const drawState: GameState = { ...state, clock, gameYear: gameYearOf(clock), beats: remaining };
  const fired = draw(drawState, rng);

  const digestEntry: DigestWeek = {
    week,
    lines: [describeWeek(clock), ...reachedBeats.map((b) => b.label)],
  };
  const digest = [...state.digest, digestEntry].slice(-DIGEST_RETENTION);

  const afterDraw: GameState = { ...drawState, pending: [...state.pending, ...fired], digest };
  return {
    state: hook(afterDraw, rng, reachedBeats),
    reachedBeats,
    fired,
  };
}

/**
 * Decide whether the clock stops after a week resolved at `speed`.
 * DESIGN.md §2.2:
 *   MANUAL  — every week.
 *   AUTO    — any pending event the interrupt config flags, or any beat.
 *   SKIP    — CRITICAL events and beats only.
 */
export function stopAfterWeek(speed: Speed, state: GameState, reachedBeats: Beat[]): StopReason | null {
  if (speed === 'PAUSED') return { kind: 'paused' };
  if (speed === 'MANUAL') return { kind: 'manual' };

  for (const event of state.pending) {
    if (event.severity === 'CRITICAL') return { kind: 'event', event };
    if (speed === 'AUTO' && shouldInterrupt(state.interrupts, event)) return { kind: 'event', event };
  }
  const beat = reachedBeats.find((b) => !INFORMATIONAL_BEATS.has(b.kind));
  if (beat) return { kind: 'beat', beat };
  // A decision the player must make always stops the clock.
  if (state.mode.kind !== 'clock') return { kind: 'mode', mode: state.mode.kind };
  // An offer arriving this week stops every speed: windows are short and expiry has a cost.
  const offer = state.offers.find((o) => o.arrivedWeek === state.clock.week);
  if (offer) return { kind: 'offer', offerId: offer.offerId };
  return null;
}

export interface RunOptions {
  /** Hard cap on weeks advanced in one call, so a quiet AUTO run cannot spin forever. */
  maxWeeks?: number;
  draw?: WeekDraw;
  hook?: WeekHook;
}

export interface RunResult {
  state: GameState;
  weeksAdvanced: number;
  stop: StopReason;
  /** The state and RNG state immediately before the final advanced week, for rewind. */
  beforeLast: { state: GameState; rngState: object } | null;
}

/**
 * Run the clock at the state's current speed until it stops.
 * The RNG is advanced in place; the caller snapshots it as needed.
 */
export function runClock(state: GameState, rng: Rng, options: RunOptions = {}): RunResult {
  const maxWeeks = options.maxWeeks ?? 52;
  const draw = options.draw ?? noDraw;
  const hook = options.hook ?? noHook;

  if (state.speed === 'PAUSED') {
    return { state, weeksAdvanced: 0, stop: { kind: 'paused' }, beforeLast: null };
  }
  if (state.mode.kind !== 'clock' || state.pending.length > 0) {
    return { state, weeksAdvanced: 0, stop: { kind: 'mode', mode: state.mode.kind }, beforeLast: null };
  }

  let current = state;
  let beforeLast: RunResult['beforeLast'] = null;
  let weeksAdvanced = 0;

  while (weeksAdvanced < maxWeeks) {
    beforeLast = { state: current, rngState: rng.getState() };
    const result = advanceWeek(current, rng, draw, hook);
    current = result.state;
    weeksAdvanced++;
    const stop = stopAfterWeek(current.speed, current, result.reachedBeats);
    if (stop) return { state: current, weeksAdvanced, stop, beforeLast };
  }
  return { state: current, weeksAdvanced, stop: { kind: 'cap' }, beforeLast };
}
