import type { CalendarDate, GameState } from '@/types';
import { defaultInterruptConfig } from './interrupts';
import { createRng, type Rng } from './rng';
import { createClock } from './time';

export interface NewGameOptions {
  seed: string;
  /** The date seminary opens. Defaults to late August of `startYear`. */
  start?: CalendarDate;
  startYear?: number;
}

/** Seminary years conventionally open in the second half of August. */
export const DEFAULT_START_YEAR = 2010;

export function newGame(options: NewGameOptions): { state: GameState; rng: Rng } {
  const start: CalendarDate = options.start ?? {
    year: options.startYear ?? DEFAULT_START_YEAR,
    month: 8,
    day: 20,
  };
  const rng = createRng(options.seed);
  const state: GameState = {
    seed: options.seed,
    clock: createClock(start),
    speed: 'PAUSED',
    phase: 'seminary',
    gameYear: 1,
    interrupts: defaultInterruptConfig(),
    pending: [],
    history: [],
    beats: [],
    digest: [],
    mode: { kind: 'creation' },
    character: null,
    npcs: {},
    seminary: null,
    flags: {},
    threads: {},
    suppressedUntil: {},
    firedOnce: [],
    offers: [],
    commitments: [],
    offerHistory: [],
    clusters: {},
    candidates: null,
    world: null,
    assignment: null,
    parish: null,
    groups: {},
    founding: null,
    openings: [],
    project: null,
    career: [],
    romeTemperament: 0,
    decor: {},
  };
  return { state, rng };
}
