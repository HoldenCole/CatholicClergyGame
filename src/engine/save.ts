import type { GameState, SaveFile, Snapshot } from '@/types';
import { SAVE_VERSION, EVENT_CATEGORIES, SPEEDS } from '@/types';
import { createRng, restoreRng, type Rng } from './rng';
import { withLiturgy } from '@/systems/liturgy';
import { generateHouses } from '@/generation/houses';
import { patronalOf } from '@/generation/patronal';

/** Parishes saved before the pastor's Mass existed get one now, rolled from the seed so a reload rolls the same. */
function giveEveryParishItsMass(state: GameState): void {
  const world = state.world;
  if (!world) return;
  if (world.parishes.every((p) => p.liturgy && p.taste)) return;
  world.parishes = world.parishes.map((p) => (p.liturgy && p.taste ? p : withLiturgy(createRng(`${state.seed}:mass:${p.id}`), p)));
}

/** Parishes saved before patronal feasts existed get theirs from their names. */
function giveEveryParishItsPatron(state: GameState): void {
  const world = state.world;
  if (!world || world.parishes.every((p) => p.patronal)) return;
  world.parishes = world.parishes.map((p) => (p.patronal ? p : { ...p, patronal: patronalOf(p.name, p.id) }));
}

/** Dioceses saved before religious houses existed get theirs now, rolled from the seed so a reload rolls the same. */
function giveEveryDioceseItsHouses(state: GameState): void {
  const world = state.world;
  if (!world || world.diocese.visible.houses) return;
  world.diocese.visible.houses = generateHouses(createRng(`${state.seed}:houses`), world.diocese.visible.size);
}

/**
 * JSON with keys in sorted order at every level, so two saves of the same
 * state are byte-identical regardless of how the objects were built.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function buildSave(
  state: GameState,
  rng: Rng,
  previous: Snapshot | null,
  prose: Record<string, string> = {},
): SaveFile {
  // Derived streams are named from the RNG's seed, so a save must carry the same seed
  // or a restored game would draw different sub-streams than the live one.
  if (rng.seed !== state.seed) throw new SaveError(`rng seed ${rng.seed} does not match state seed ${state.seed}`);
  return {
    version: SAVE_VERSION,
    state,
    rngState: rng.getState(),
    previous,
    prose,
  };
}

export function serialize(save: SaveFile): string {
  return stableStringify(save);
}

export class SaveError extends Error {
  override name = 'SaveError';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertState(v: unknown, path: string): asserts v is GameState {
  if (!isRecord(v)) throw new SaveError(`${path}: not an object`);
  if (typeof v.seed !== 'string' || v.seed.length === 0) throw new SaveError(`${path}.seed missing`);
  const clock = v.clock;
  if (!isRecord(clock) || typeof clock.startDay !== 'number' || typeof clock.week !== 'number') {
    throw new SaveError(`${path}.clock malformed`);
  }
  if (!SPEEDS.includes(v.speed as (typeof SPEEDS)[number])) throw new SaveError(`${path}.speed invalid`);
  if (typeof v.gameYear !== 'number') throw new SaveError(`${path}.gameYear missing`);
  if (!isRecord(v.interrupts)) throw new SaveError(`${path}.interrupts missing`);
  for (const category of EVENT_CATEGORIES) {
    if (typeof v.interrupts[category] !== 'string') {
      throw new SaveError(`${path}.interrupts.${category} missing`);
    }
  }
  for (const key of ['pending', 'history', 'beats', 'digest', 'firedOnce', 'offers', 'commitments', 'offerHistory', 'openings', 'career'] as const) {
    if (!Array.isArray(v[key])) throw new SaveError(`${path}.${key} must be an array`);
  }
  for (const key of ['npcs', 'flags', 'threads', 'suppressedUntil', 'mode', 'clusters', 'groups', 'decor', 'permissions'] as const) {
    if (!isRecord(v[key])) throw new SaveError(`${path}.${key} must be an object`);
  }
  for (const key of ['candidates', 'world', 'assignment', 'parish', 'founding', 'project'] as const) {
    if (!(key in v)) throw new SaveError(`${path}.${key} missing`);
  }
}

/** Parse and validate a save. Throws SaveError on anything unusable. */
export function deserialize(json: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveError('not valid JSON');
  }
  if (!isRecord(raw)) throw new SaveError('save is not an object');
  if (raw.version === 3) {
    // v3 → v4: the study-away phase added a field.
    if (isRecord(raw.state) && raw.state.study === undefined) raw.state.study = null;
    if (isRecord(raw.previous) && isRecord(raw.previous.state) && raw.previous.state.study === undefined) raw.previous.state.study = null;
    raw.version = 4;
  }
  if (raw.version === 4) {
    // v4 → v5: strain moved from the parish to the game; settings added.
    const lift = (st: unknown) => {
      if (!isRecord(st)) return;
      if (st.strain === undefined) st.strain = isRecord(st.parish) && typeof st.parish.strain === 'number' ? st.parish.strain : 0;
    };
    lift(raw.state);
    if (isRecord(raw.previous)) lift(raw.previous.state);
    raw.version = 5;
  }
  if (raw.version === 5) {
    // v5 → v6: several projects at once.
    const lift = (st: unknown) => {
      if (!isRecord(st)) return;
      if (st.projects === undefined) st.projects = st.project ? [st.project] : [];
    };
    lift(raw.state);
    if (isRecord(raw.previous)) lift(raw.previous.state);
    raw.version = SAVE_VERSION;
  }
  if (raw.version !== SAVE_VERSION) {
    throw new SaveError(`unsupported save version ${String(raw.version)} (expected ${SAVE_VERSION})`);
  }
  assertState(raw.state, 'state');
  if (!isRecord(raw.rngState)) throw new SaveError('rngState missing');
  if (raw.previous !== null && raw.previous !== undefined) {
    if (!isRecord(raw.previous)) throw new SaveError('previous malformed');
    assertState(raw.previous.state, 'previous.state');
    if (!isRecord(raw.previous.rngState)) throw new SaveError('previous.rngState missing');
  }
  const prose = isRecord(raw.prose) ? (raw.prose as Record<string, string>) : {};
  giveEveryParishItsMass(raw.state as GameState);
  if (isRecord(raw.previous)) giveEveryParishItsMass(raw.previous.state as GameState);
  giveEveryDioceseItsHouses(raw.state as GameState);
  if (isRecord(raw.previous)) giveEveryDioceseItsHouses(raw.previous.state as GameState);
  giveEveryParishItsPatron(raw.state as GameState);
  if (isRecord(raw.previous)) giveEveryParishItsPatron(raw.previous.state as GameState);
  return {
    version: SAVE_VERSION,
    state: raw.state,
    rngState: raw.rngState,
    previous: (raw.previous as Snapshot | null | undefined) ?? null,
    prose,
  };
}

/** Rebuild the live RNG from a save. */
export function rngFromSave(save: SaveFile): Rng {
  return restoreRng(save.state.seed, save.rngState);
}
