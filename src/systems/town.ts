import type { Condition, Effect, GameState, Town, TownPlace, TownPlaceKind, TownPlaceState } from '@/types';
import { TOWN_PLACE_KINDS } from '@/types';
import type { Rng } from '@/engine/rng';
import { townArchetype, townArchetypes, townContent } from '@/content/town';
import { generateTown, rollPlace } from '@/generation/town';

/**
 * The town as a place. DESIGN §8.9: the parish's neighbourhood with a life of
 * its own. A town is rolled once per parish and kept in the save, so a man
 * who comes back finds it as he left it, changed by the years between.
 * The week names a place now and then; the year moves the places; scenes
 * hang on their states; the town keeps what he did among them.
 */
export const TOWN = {
  /** Share of weeks the ambient line is about the town, after the cast has had its chance. */
  lineChance: 0.25,
  /** At most so many places change in a year. */
  changesPerYear: 2,
  /** A closed place is replaced by a new one of its kind, a year or more on, this often a year. */
  refill: 0.5,
} as const;

export function townOf(state: GameState, parishId = state.assignment?.parishId): Town | undefined {
  return parishId ? state.towns?.[parishId] : undefined;
}

/** The parish's town, rolled now if the save has none for it. Called when an assignment starts. */
export function ensureTown(state: GameState, rng: Rng): GameState {
  const pid = state.assignment?.parishId;
  const parish = state.world?.parishes.find((p) => p.id === pid);
  if (!pid || !parish || !state.world || state.towns?.[pid]) return state;
  const town = generateTown(rng, parish, state.world.diocese.presetId, state.clock.week);
  return { ...state, towns: { ...(state.towns ?? {}), [pid]: town } };
}

export function placeOf(town: Town | undefined, kind: TownPlaceKind): TownPlace | undefined {
  return town?.places.find((p) => p.kind === kind && p.state !== 'closed') ?? town?.places.find((p) => p.kind === kind);
}

/** The word for a kind of place, the town's own name for it or the plain word. */
export function placeWord(state: GameState, kind: TownPlaceKind): string {
  return placeOf(townOf(state), kind)?.name ?? townArchetype(kind).plain;
}

export function regardWord(v: number): string {
  for (const [floor, word] of townContent.regard.words) if (v >= floor) return word;
  return townContent.regard.words[townContent.regard.words.length - 1]![1];
}

export function stateWord(s: TownPlaceState): string {
  return { open: 'open', thriving: 'thriving', failing: 'failing', closing: 'closing', closed: 'closed', new: 'new this year' }[s];
}

function parishName(state: GameState, town: Town): string {
  return state.world?.parishes.find((p) => p.id === town.parishId)?.name ?? 'the parish';
}

export function fillTown(template: string, place: TownPlace, town: Town, state: GameState): string {
  const vars: Record<string, string> = { name: place.name, owner: place.owner ?? 'the owner', town: town.name, parish: parishName(state, town) };
  const out = template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** A week's line about a place of the town, or null when the pools should speak instead. */
export function townLine(state: GameState, rng: Rng): string | null {
  const town = townOf(state);
  if (!town || !town.places.length || !rng.chance(TOWN.lineChance)) return null;
  const place = rng.weighted(town.places, (p) => (p.state === 'open' ? 1 : 2));
  const pool = townArchetype(place.kind).lines[place.state];
  return pool.length ? fillTown(rng.pick(pool), place, town, state) : null;
}

const LINE_PATTERNS: RegExp[] = townArchetypes.flatMap((a) => Object.values(a.lines).flat()).map((t) => new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '[^.]+?') + '$', 'i'));

const YEAR_PATTERNS: RegExp[] = Object.values(townContent.review).map((t) => new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '[^.]+?') + '\\. '));

/** Whether a digest line is one of the town's yearly changes, which belong to the parish lane. */
export function isTownYearLine(line: string): boolean {
  return YEAR_PATTERNS.some((p) => p.test(line)) || /^[^.]+ has come back\. /.test(line);
}

/** Whether a digest line is one of the town's weekly lines, for the lane it sits in. */
export function isTownLine(line: string): boolean {
  return LINE_PATTERNS.some((p) => p.test(line));
}

export interface TownChange {
  place: TownPlace;
  from: TownPlaceState;
  to: TownPlaceState;
}

function nextState(rng: Rng, place: TownPlace, weeksIn: number): TownPlaceState | null {
  const c = townArchetype(place.kind).change;
  switch (place.state) {
    case 'new': return weeksIn >= 40 ? 'open' : null;
    case 'open': return rng.chance(c.fail) ? 'failing' : rng.chance(c.thrive) ? 'thriving' : null;
    case 'thriving': return rng.chance(c.settle) ? 'open' : null;
    case 'failing': return rng.chance(c.recover) ? 'open' : rng.chance(c.close) ? 'closing' : null;
    case 'closing': return rng.chance(c.close) ? 'closed' : rng.chance(c.recover * 0.5) ? 'failing' : null;
    case 'closed': return null;
  }
}

/**
 * The year in the town: places fail and recover and close, a closed one is
 * replaced in time by something new of its kind, and the places that carry
 * the town's work take households with them when they go.
 */
export function townYear(state: GameState, rng: Rng): { state: GameState; lines: string[]; changes: TownChange[] } {
  const town = townOf(state);
  const parish = state.world?.parishes.find((p) => p.id === town?.parishId);
  if (!town || !parish || !state.world) return { state, lines: [], changes: [] };
  const week = state.clock.week;
  const changes: TownChange[] = [];
  const lines: string[] = [];
  let places = [...town.places];
  let households = parish.households;
  for (const place of rng.shuffle(town.places)) {
    if (changes.length >= TOWN.changesPerYear) break;
    const r = rng.derive(`town:${place.id}:${week}`);
    const to = nextState(r, place, week - place.sinceWeek);
    if (!to) continue;
    const moved: TownPlace = { ...place, state: to, sinceWeek: week };
    places = places.map((p) => (p.id === place.id ? moved : p));
    changes.push({ place: moved, from: place.state, to });
    const def = townArchetype(place.kind);
    const share = to === 'closed' ? def.households?.closed ?? 0 : to === 'new' ? def.households?.new ?? 0 : 0;
    if (share) households = Math.max(50, Math.round(households * (1 + share)));
    const head = townContent.review[to];
    const pool = def.lines[to];
    const line = pool.length ? fillTown(rng.pick(pool), moved, town, state) : '';
    if (to !== 'open') lines.push(`${head ? fillTown(head, moved, town, state) + '. ' : ''}${line}`.trim());
    else if (place.state === 'failing') lines.push(`${moved.name} has come back. ${line}`.trim());
  }
  // A closed place gives way, in time, to something new of its kind.
  for (const place of places.filter((p) => p.state === 'closed' && week - p.sinceWeek >= 52)) {
    if (changes.length >= TOWN.changesPerYear) break;
    const r = rng.derive(`town:refill:${place.id}:${week}`);
    if (!r.chance(TOWN.refill)) continue;
    const fresh = rollPlace(r, townArchetype(place.kind), parish, state.world.diocese.presetId, week, `${place.id}_${week}`, 'new');
    places = places.map((p) => (p.id === place.id ? fresh : p));
    changes.push({ place: fresh, from: 'closed', to: 'new' });
    const share = townArchetype(place.kind).households?.new ?? 0;
    if (share) households = Math.round(households * (1 + share));
    const pool = townArchetype(place.kind).lines.new;
    lines.push(`${fillTown(townContent.review.new ?? '{name} opened', fresh, town, state)}. ${pool.length ? fillTown(r.pick(pool), fresh, town, state) : ''}`.trim());
  }
  if (!changes.length) return { state, lines: [], changes: [] };
  const world = { ...state.world, parishes: state.world.parishes.map((p) => (p.id === parish.id ? { ...p, households } : p)) };
  return { state: { ...state, world, towns: { ...(state.towns ?? {}), [town.parishId]: { ...town, places } } }, lines, changes };
}

/** The town effect: regard on a kind of place (or all), and what the town remembers. */
export function applyTownEffect(state: GameState, effect: Effect): GameState {
  const town = townOf(state);
  if (!town) return state;
  const kind = effect.key;
  const places = town.places.map((p) => (kind === 'any' || p.kind === kind) && typeof effect.delta === 'number' ? { ...p, regard: Math.max(-100, Math.min(100, p.regard + effect.delta)) } : p);
  const place = kind === 'any' ? town.places[0] : placeOf(town, kind as TownPlaceKind);
  const memory = typeof effect.value === 'string' && effect.value
    ? [...town.memory, { week: state.clock.week, text: place ? fillTown(effect.value, place, town, state) : effect.value }]
    : town.memory;
  return { ...state, towns: { ...(state.towns ?? {}), [town.parishId]: { ...town, places, memory } } };
}

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '==': return a === b;
    default: return false;
  }
}

/** The town conditions: a place of a kind in a state, and the regard of a kind's people. */
export function townCondition(state: GameState, cond: Extract<Condition, { type: 'town' | 'town_regard' }>): boolean {
  const town = townOf(state);
  if (!town) return false;
  const places = cond.key === 'any' ? town.places : town.places.filter((p) => p.kind === cond.key);
  if (!places.length) return false;
  if (cond.type === 'town') return places.some((p) => p.state === cond.value);
  const regard = places.reduce((a, p) => a + p.regard, 0) / places.length;
  return compare(cond.op, regard, cond.value);
}

/** Text tokens: {town} and {town:diner} and the rest, the plain word where the town lacks the place. */
export function townTokens(state: GameState): Record<string, string> {
  const town = townOf(state);
  const out: Record<string, string> = {};
  if (town) out.town = town.name;
  for (const kind of TOWN_PLACE_KINDS) out[`town:${kind}`] = town ? placeWord(state, kind) : townArchetype(kind).plain;
  return out;
}

/** The average regard of the town's places for him. */
export function townRegard(town: Town): number {
  return town.places.length ? town.places.reduce((a, p) => a + p.regard, 0) / town.places.length : 0;
}

/** The year's town in a line for the review: what changed, and how the town stands to him. Null when nothing moved. */
export function townReviewLine(state: GameState, sinceWeek: number): string | null {
  const town = townOf(state);
  if (!town) return null;
  const moved = town.places.filter((p) => p.sinceWeek > sinceWeek && p.state !== 'open');
  const parts = moved.map((p) => fillTown(townContent.review[p.state] ?? '{name} changed', p, town, state).replace(/^./, (c) => c.toLowerCase()));
  if (!parts.length) return null;
  return `${parts.join('; ')}. The town is ${regardWord(townRegard(town))}.`.replace(/^./, (c) => c.toUpperCase());
}
