import { create } from 'zustand';
import type { EventCategory, GameState, InterruptLevel, Snapshot, Speed } from '@/types';
import { noDraw, runClock, type StopReason, type WeekDraw } from './clock';
import { newGame as buildNewGame, type NewGameOptions } from './game';
import type { Rng } from './rng';
import { buildSave, deserialize, rngFromSave, SaveError, serialize } from './save';

/** Weeks per synchronous batch when running to the next stop. */
export const BATCH_WEEKS: Record<Speed, number> = {
  PAUSED: 0,
  MANUAL: 1,
  AUTO: 52,
  SKIP: 52 * 10,
};

export interface GameStore {
  game: GameState | null;
  /** The one retained auto-resolved week, for rewind. */
  previous: Snapshot | null;
  prose: Record<string, string>;
  lastStop: StopReason | null;
  /** True while the UI is ticking the clock on a timer. */
  running: boolean;
  error: string | null;

  newGame(options: NewGameOptions): void;
  setSpeed(speed: Speed): void;
  /** Advance up to `weeks` weeks at the current speed (MANUAL always advances one). */
  tick(weeks?: number): StopReason | null;
  /** Advance until the clock stops or the batch cap is reached. */
  runToStop(): StopReason | null;
  /** Restore the week before the last auto-resolved one and drop to MANUAL. */
  rewind(): void;
  setInterrupt(category: EventCategory, level: InterruptLevel): void;
  setRunning(running: boolean): void;
  exportSave(): string;
  importSave(json: string): void;
  clearError(): void;
}

// The live RNG is deliberately kept out of the reactive state: it is mutable,
// non-serializable, and its state is captured on demand by exportSave.
let rng: Rng | null = null;
let draw: WeekDraw = noDraw;

/** Later phases install the event engine here. Tests use it to inject fixtures. */
export function setWeekDraw(next: WeekDraw): void {
  draw = next;
}

/** Test hook: the live RNG, or null before a game exists. */
export function currentRng(): Rng | null {
  return rng;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: null,
  previous: null,
  prose: {},
  lastStop: null,
  running: false,
  error: null,

  newGame(options) {
    const built = buildNewGame(options);
    rng = built.rng;
    set({ game: built.state, previous: null, prose: {}, lastStop: null, running: false, error: null });
  },

  setSpeed(speed) {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, speed }, running: speed === 'PAUSED' ? false : get().running });
  },

  tick(weeks = 1) {
    const { game } = get();
    if (!game || !rng || game.speed === 'PAUSED') return null;
    const maxWeeks = game.speed === 'MANUAL' ? 1 : weeks;
    const result = runClock(game, rng, { maxWeeks, draw });
    const autoResolved = game.speed === 'AUTO' || game.speed === 'SKIP';
    // A one-week timer tick that simply kept going has no stop worth reporting.
    const keptGoing = result.stop.kind === 'cap' && maxWeeks === 1;
    set({
      game: result.state,
      lastStop: keptGoing ? null : result.stop,
      previous: autoResolved ? result.beforeLast : null,
      running: result.stop.kind === 'cap' ? get().running : false,
    });
    return result.stop;
  },

  runToStop() {
    const { game } = get();
    if (!game) return null;
    return get().tick(BATCH_WEEKS[game.speed]);
  },

  rewind() {
    const { previous } = get();
    if (!previous || !rng) return;
    rng = rngFromSave({ version: 1, state: previous.state, rngState: previous.rngState, previous: null, prose: {} });
    set({
      game: { ...previous.state, speed: 'MANUAL' },
      previous: null,
      lastStop: null,
      running: false,
    });
  },

  setInterrupt(category, level) {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, interrupts: { ...game.interrupts, [category]: level } } });
  },

  setRunning(running) {
    const { game } = get();
    if (!game || game.speed === 'PAUSED' || game.speed === 'MANUAL') {
      set({ running: false });
      return;
    }
    set({ running });
  },

  exportSave() {
    const { game, previous, prose } = get();
    if (!game || !rng) throw new SaveError('no game to save');
    return serialize(buildSave(game, rng, previous, prose));
  },

  importSave(json) {
    try {
      const save = deserialize(json);
      rng = rngFromSave(save);
      set({
        game: { ...save.state, speed: 'PAUSED' },
        previous: save.previous,
        prose: save.prose,
        lastStop: null,
        running: false,
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  clearError() {
    set({ error: null });
  },
}));
