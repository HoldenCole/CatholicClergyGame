import type { Character } from './character';
import type { HistoryEntry, PendingEvent } from './events';
import type { InterruptConfig } from './interrupts';
import type { Mode } from './mode';
import type { Npc } from './npc';
import type { SeminaryState } from './seminary';
import type { Phase } from './stats';
import type { Beat, Clock, Speed } from './time';

export type FlagValue = boolean | number | string;

/** An open chain planted by one event and resolved by a later one. */
export interface ThreadState {
  id: string;
  openedWeek: number;
  openedBy: string;
}

/** Serialized seedrandom state. Opaque; produced and consumed by engine/rng. */
export type RngState = object;

/**
 * Everything the simulation needs, minus the RNG object itself (whose state is
 * captured separately so that it can be restored byte-for-byte).
 */
export interface GameState {
  seed: string;
  clock: Clock;
  speed: Speed;
  phase: Phase;
  /** Career year, 1-based, advanced by the clock at each year boundary. */
  gameYear: number;
  interrupts: InterruptConfig;
  pending: PendingEvent[];
  history: HistoryEntry[];
  /** Upcoming beats, sorted by week. Consumed by the clock when reached. */
  beats: Beat[];
  /** Weeks that auto-resolved into the digest, most recent last. Phase 0 keeps a bounded log. */
  digest: DigestWeek[];
  mode: Mode;
  character: Character | null;
  npcs: Record<string, Npc>;
  seminary: SeminaryState | null;
  flags: Record<string, FlagValue>;
  threads: Record<string, ThreadState>;
  /** eventId -> absolute week before which it may not fire again. */
  suppressedUntil: Record<string, number>;
  /** Ids of `once` events that have fired. */
  firedOnce: string[];
}

export interface DigestWeek {
  week: number;
  lines: string[];
}

/** A snapshot of one prior week, used for the one-step rewind. */
export interface Snapshot {
  state: GameState;
  rngState: RngState;
}

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  state: GameState;
  rngState: RngState;
  /** The one retained prior week, if the last week auto-resolved. */
  previous: Snapshot | null;
  /** Cached LLM prose keyed by event instance. Empty until Phase 6. */
  prose: Record<string, string>;
}
