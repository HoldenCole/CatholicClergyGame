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
  | { kind: 'cap' };

/**
 * Supplies the events that fire during a week. Phase 1's event engine plugs in
 * here; the clock itself never touches the content pool. Must be deterministic
 * given (state, rng).
 */
export type WeekDraw = (state: GameState, rng: Rng) => PendingEvent[];

export const noDraw: WeekDraw = () => [];

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
export function advanceWeek(state: GameState, rng: Rng, draw: WeekDraw = noDraw): WeekResult {
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

  const digestEntry: DigestWeek = { week, lines: [describeWeek(clock)] };
  const digest = [...state.digest, digestEntry].slice(-DIGEST_RETENTION);

  return {
    state: {
      ...drawState,
      pending: [...state.pending, ...fired],
      digest,
    },
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
  const beat = reachedBeats[0];
  if (beat) return { kind: 'beat', beat };
  return null;
}

export interface RunOptions {
  /** Hard cap on weeks advanced in one call, so a quiet AUTO run cannot spin forever. */
  maxWeeks?: number;
  draw?: WeekDraw;
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

  if (state.speed === 'PAUSED') {
    return { state, weeksAdvanced: 0, stop: { kind: 'paused' }, beforeLast: null };
  }

  let current = state;
  let beforeLast: RunResult['beforeLast'] = null;
  let weeksAdvanced = 0;

  while (weeksAdvanced < maxWeeks) {
    beforeLast = { state: current, rngState: rng.getState() };
    const result = advanceWeek(current, rng, draw);
    current = result.state;
    weeksAdvanced++;
    const stop = stopAfterWeek(current.speed, current, result.reachedBeats);
    if (stop) return { state: current, weeksAdvanced, stop, beforeLast };
  }
  return { state: current, weeksAdvanced, stop: { kind: 'cap' }, beforeLast };
}
