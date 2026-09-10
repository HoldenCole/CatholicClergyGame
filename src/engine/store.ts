import { create } from 'zustand';
import type {
  CreationAnswers,
  EventCategory,
  GameState,
  InterruptLevel,
  ObligationKey,
  Pillar,
  Quality,
  Snapshot,
  Speed,
  SummerAssignment,
} from '@/types';
import { noDraw, noHook, runClock, type StopReason, type WeekDraw, type WeekHook } from './clock';
import { newGame as buildNewGame, type NewGameOptions } from './game';
import type { Rng } from './rng';
import { buildSave, deserialize, rngFromSave, SaveError, serialize } from './save';
import { eventById, eventsForPhase } from '@/content';
import { offerById, offersForPhase } from '@/content/offers';
import { acceptOffer as doAccept, declineOffer as doDecline } from './offers';
import { generateRun } from '@/generation';
import { generateCandidates, installWorld } from '@/generation/world';
import { fromDayNumber } from './calendar';
import { acceptAssignment as doAcceptAssignment } from './seminary';
import {
  acknowledgeEvaluation as ackEvaluation,
  chooseEmphasis as pickEmphasis,
  chooseSummer as pickSummer,
  leaveSeminary as leave,
  ordain as doOrdain,
} from './seminary';
import { parishWeekHook, resolvePending, seminaryWeekHook, type EventDeps } from './weekHook';
import { setDiscretionary as doSetDiscretionary, setObligation as doSetObligation, startAssignment } from './parish';
import { startFounding as doStartFounding, suppressGroup as doSuppress } from '@/systems/groups';
import type { GroupType } from '@/types';

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

  /** Pick one of the rolled dioceses, or 'surprise' for a blind roll with a small bonus. DESIGN §3.1a */
  chooseDiocese(presetId: string | 'surprise'): void;
  /** Character creation is done; generate the run and enter seminary. */
  startGame(answers: CreationAnswers): void;
  acceptAssignment(): void;
  setObligation(key: ObligationKey, quality: Quality): void;
  setDiscretionary(actionId: string, ap: number): void;
  foundGroup(type: GroupType): void;
  suppressGroup(groupId: string, suppressed: boolean): void;
  chooseEmphasis(emphasis: Record<Pillar, number>): void;
  chooseSummer(id: SummerAssignment): void;
  /** Resolve the event at the head of the pending queue. */
  resolveEvent(choiceId: string): void;
  acknowledgeEvaluation(): void;
  leaveSeminary(): void;
  ordain(): void;
  acceptOffer(offerId: string): void;
  declineOffer(offerId: string): void;
  /** Prose from the last offer decision, for the UI. */
  lastOfferOutcome: string | null;
}

// The live RNG is deliberately kept out of the reactive state: it is mutable,
// non-serializable, and its state is captured on demand by exportSave.
let rng: Rng | null = null;
let draw: WeekDraw = noDraw;
let hookOverride: WeekHook | null = null;

/** Tests inject a synthetic draw here. */
export function setWeekDraw(next: WeekDraw): void {
  draw = next;
}

/** Tests may replace the phase hook; pass null to restore the real one. */
export function setWeekHook(next: WeekHook | null): void {
  hookOverride = next;
}

function depsFor(state: GameState): EventDeps {
  return { pool: eventsForPhase(state.phase), lookup: eventById, offers: offersForPhase(state.phase), offerLookup: offerById };
}

/** The per-week hook for the current phase. */
function hookFor(state: GameState): WeekHook {
  if (hookOverride) return hookOverride;
  if (state.phase === 'seminary') return seminaryWeekHook(depsFor(state));
  if (state.parish) return parishWeekHook(depsFor(state));
  return noHook;
}

function update(set: (partial: Partial<GameStore>) => void, get: () => GameStore, fn: (game: GameState, rng: Rng) => GameState): void {
  const { game } = get();
  if (!game || !rng) return;
  try {
    set({ game: fn(game, rng), error: null });
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) });
  }
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
  lastOfferOutcome: null,

  newGame(options) {
    const built = buildNewGame(options);
    rng = built.rng;
    const year = fromDayNumber(built.state.clock.startDay).year;
    const candidates = generateCandidates(rng.derive('world'), year);
    set({ game: { ...built.state, candidates }, previous: null, prose: {}, lastStop: null, running: false, error: null, lastOfferOutcome: null });
  },

  chooseDiocese(presetId) {
    update(set, get, (game, r) => {
      const candidates = game.candidates ?? [];
      if (candidates.length === 0) throw new Error('no dioceses rolled');
      const year = fromDayNumber(game.clock.startDay).year;
      if (presetId === 'surprise') {
        const pick = r.derive('surprise').pick(candidates);
        const installed = installWorld(game, pick, year);
        return { ...installed, flags: { ...installed.flags, surprise_me: true } };
      }
      const chosen = candidates.find((c) => c.presetId === presetId);
      if (!chosen) throw new Error(`unknown diocese ${presetId}`);
      return installWorld(game, chosen, year);
    });
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
    const result = runClock(game, rng, { maxWeeks, draw, hook: hookFor(game) });
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

  startGame(answers) {
    update(set, get, (game, r) => generateRun(game, answers, r));
  },
  chooseEmphasis(emphasis) {
    update(set, get, (game, r) => pickEmphasis(game, emphasis, r));
  },
  chooseSummer(id) {
    update(set, get, (game) => pickSummer(game, id));
  },
  resolveEvent(choiceId) {
    update(set, get, (game, r) => {
      const pending = game.pending[0];
      if (!pending) return game;
      return resolvePending(game, pending, choiceId, r, depsFor(game));
    });
    set({ previous: null });
  },
  acknowledgeEvaluation() {
    update(set, get, (game) => ackEvaluation(game));
  },
  leaveSeminary() {
    update(set, get, (game) => leave(game));
    set({ running: false });
  },
  ordain() {
    update(set, get, (game, r) => doOrdain(game, r));
  },
  acceptAssignment() {
    update(set, get, (game, r) => startAssignment(doAcceptAssignment(game), r));
  },
  setObligation(key, quality) {
    update(set, get, (game) => doSetObligation(game, key, quality));
  },
  setDiscretionary(actionId, ap) {
    update(set, get, (game) => doSetDiscretionary(game, actionId, ap));
  },
  foundGroup(type) {
    update(set, get, (game) => doStartFounding(game, type));
  },
  suppressGroup(groupId, suppressed) {
    update(set, get, (game) => doSuppress(game, groupId, suppressed));
  },
  acceptOffer(offerId) {
    const def = offerById(offerId);
    if (!def) return;
    update(set, get, (game, r) => {
      const result = doAccept(game, def, r);
      set({ lastOfferOutcome: result.failed && def.failure ? `${def.accept.outcome} ${def.failure.outcome}` : def.accept.outcome });
      return result.state;
    });
  },
  declineOffer(offerId) {
    const def = offerById(offerId);
    if (!def) return;
    update(set, get, (game) => {
      set({ lastOfferOutcome: def.decline.outcome });
      return doDecline(game, def);
    });
  },
}));
