import type { Beat, GameState, ParishState, Quality, ObligationKey } from '@/types';
import type { Rng } from './rng';
import { generateParishPeople, generateParishioner } from '@/generation/parishPeople';
import { arrivalLine, castLine, castYear, openRoles, type CastRole } from '@/systems/cast';
import { ensureTown, townLine } from '@/systems/town';
import { withLiturgy } from '@/systems/liturgy';
import { formDeanery } from '@/systems/deanery';
import { generateGroups } from '@/systems/groups';
import { resolveWeek } from '@/systems/week';
import { takeSnapshot } from '@/systems/trajectory';
import { arcsOnMove } from '@/systems/arcs';
import { seasonOf } from './time';
import { fromDayNumber } from './calendar';
import ambient from '@/content/parish/ambient.json';

/** Tunables. DESIGN 2.4: an arc is 20–30 played weeks over 2–8 years. */
export const ARC = {
  minYears: 2,
  maxYears: 8,
  playedWeeksPerYear: [4, 6] as [number, number],
  /** Lay support carried over on transfer. DESIGN 5.1 */
  parishionersCarryover: 0.3,
  startingCashWeeks: 6,
} as const;

export function defaultRoutine(): ParishState['routine'] {
  return {
    obligations: {
      sunday_masses: 'standard',
      weekday_masses: 'standard',
      confessions: 'standard',
      meetings: 'standard',
      sacramental_prep: 'standard',
    },
    discretionary: { visits: 1, prayer: 1, study: 1 },
  };
}

function calendarYearOf(state: GameState): number {
  return fromDayNumber(state.clock.startDay + state.clock.week * 7).year;
}

function schedulePlayedWeeks(rng: Rng, fromWeek: number): number[] {
  const count = rng.int(ARC.playedWeeksPerYear[0], ARC.playedWeeksPerYear[1]);
  const weeks = new Set<number>();
  while (weeks.size < count) weeks.add(fromWeek + rng.int(2, 50));
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Take up an assignment: generate the parish's people, set the default
 * routine, pick the arc length, schedule the first year's played weeks, and
 * hand the clock back.
 */
export function startAssignment(state: GameState, rng: Rng): GameState {
  const assignment = state.assignment;
  const world = state.world;
  if (!assignment || !world) return { ...state, mode: { kind: 'clock' } };
  const parish = world.parishes.find((p) => p.id === assignment.parishId);
  if (!parish) return { ...state, mode: { kind: 'clock' } };

  const year = calendarYearOf(state);
  const people = parish.staffIds.length ? [] : generateParishPeople(rng.derive(`people:${parish.id}`), parish, world.diocese.presetId, year);
  const npcs = { ...state.npcs };
  for (const n of people) npcs[n.id] = n;
  const staffIds = parish.staffIds.length ? parish.staffIds : people.filter((n) => n.tags.includes('staff')).map((n) => n.id);
  let groups = state.groups;
  let groupIds = parish.groupIds;
  if (groupIds.length === 0) {
    const made = generateGroups(rng.derive(`groups:${parish.id}`), { ...state, npcs }, parish, year);
    groups = { ...groups };
    for (const g of made.groups) groups[g.id] = g;
    for (const n of made.leaders) npcs[n.id] = n;
    groupIds = made.groups.map((g) => g.id);
  }
  const parishes = world.parishes.map((p) => (p.id === parish.id ? withLiturgy(rng.derive(`mass:${p.id}`), { ...p, staffIds, groupIds }) : p));

  const arcYears = assignment.role === 'pastor' ? 6 : rng.int(ARC.minYears, ARC.maxYears);
  const arcEndWeek = state.clock.week + arcYears * 52;
  const parishState: ParishState = {
    parishId: parish.id,
    role: assignment.role,
    arcStartWeek: state.clock.week,
    arcEndWeek,
    routine: state.parish?.routine ?? defaultRoutine(),
    playedWeeks: schedulePlayedWeeks(rng, state.clock.week),
    scheduleYear: 0,
    finance: {
      cash: parish.weeklyCollections * ARC.startingCashWeeks,
      debt: parish.debt,
      averageCollection: parish.weeklyCollections,
      weeksToAssessment: 13,
    },
    attendance: 0.45,
    staffIds,
    apNextWeek: 0,
    recycledHomilyStreak: 0,
    weeksServed: 0,
    work: null,
    snapshots: [],
  };
  const beats: Beat[] = [
    ...state.beats.filter((b) => b.kind !== 'assignment'),
    { kind: 'assignment' as const, week: arcEndWeek, label: 'The bishop is thinking about your next assignment' },
  ].sort((a, b) => a.week - b.week);
  const flags = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('parish:') || k.startsWith('role:') || k.startsWith('boss:') || k.startsWith('deanery:') || k.startsWith('seminarian:') || k === 'deacon:here') delete flags[k];
  flags[`role:${assignment.role}`] = true;
  flags[`parish:kind:${parish.kind}`] = true;
  if (parish.needsSpanish) flags['parish:needs_spanish'] = true;

  const started: GameState = {
    ...state,
    phase: assignment.role,
    npcs,
    groups,
    world: { ...world, parishes },
    parish: parishState,
    beats,
    flags,
    mode: { kind: 'clock' },
  };
  // An arc that belonged to the last parish ends there: he is not present to see how it comes out. §12.5
  const moved = arcsOnMove(started).state;
  const arrival = takeSnapshot(moved);
  const settled = arrival ? { ...moved, parish: { ...parishState, arrival } } : moved;
  // The town around the parish, rolled once and kept. DESIGN §8.9.
  return ensureTown(placeAmongPriests(settled, rng), rng.derive(`town:${parish.id}`));
}

export function isPlayedWeek(state: GameState): boolean {
  return !!state.parish && state.parish.playedWeeks.includes(state.clock.week);
}

/** Reschedule played weeks at each anniversary of the arc. */
function maybeReschedule(state: GameState, rng: Rng): GameState {
  const parish = state.parish!;
  const yearIndex = Math.floor((state.clock.week - parish.arcStartWeek) / 52);
  if (yearIndex <= parish.scheduleYear) return state;
  return { ...state, parish: { ...parish, scheduleYear: yearIndex, playedWeeks: schedulePlayedWeeks(rng, state.clock.week) } };
}

function ambientLine(state: GameState, rng: Rng): string {
  // One of the cast, some weeks; the pools the rest.
  const cast = castLine(state, rng.derive('cast'));
  if (cast) return cast;
  const town = townLine(state, rng.derive('town'));
  if (town) return town;
  const lines = ambient as Record<string, string[]>;
  const parish = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  const pools = [lines.any ?? []];
  const season = seasonOf(state.clock);
  if (lines[season]) pools.push(lines[season]!);
  if (parish && lines[parish.kind]) pools.push(lines[parish.kind]!);
  const presetId = state.world?.diocese.presetId;
  if (presetId && lines[presetId]) pools.push(lines[presetId]!, lines[presetId]!);
  const pool = rng.pick(pools);
  return rng.pick(pool.length ? pool : lines.any ?? ['A quiet week.']);
}

/** The parish side of a week: the routine resolves, finance ticks, the digest fills. */
export function parishWeek(state: GameState, rng: Rng): GameState {
  if (!state.parish || !state.assignment || !state.character) return state;
  let next = maybeReschedule(state, rng);
  const { state: resolved, ledger } = resolveWeek(next, rng);
  next = resolved;
  const usual = next.parish!.finance.averageCollection;
  const money = ledger.collection >= usual * 1.03 ? 'above' : ledger.collection <= usual * 0.97 ? 'below' : 'about';
  const pews = ledger.attendanceDelta >= 0.002 ? ', up' : ledger.attendanceDelta <= -0.002 ? ', down' : '';
  const lines = [
    ...ledger.lines,
    `Collections $${ledger.collection.toLocaleString()}, ${money} the usual $${usual.toLocaleString()}. Attendance ${Math.round(ledger.attendance * 100)}%${pews}.`,
    ambientLine(next, rng.derive(`ambient:${next.clock.week}`)),
  ];
  const last = next.digest[next.digest.length - 1];
  const digest = last && last.week === next.clock.week
    ? [...next.digest.slice(0, -1), { ...last, lines: [...last.lines, ...lines] }]
    : [...next.digest, { week: next.clock.week, lines }];
  return { ...next, digest };
}

/**
 * The year among the parish's people: a part left open last year is filled by
 * a new face, then the cast has its year (a death, a move, a wedding, a baby),
 * and what it empties is flagged for next year. The generation stays here so
 * systems/cast owes nothing to the generators.
 */
export function castYearStep(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (!state.parish || !state.assignment || !state.world) return { state, lines: [] };
  const parish = state.world.parishes.find((p) => p.id === state.assignment!.parishId);
  if (!parish) return { state, lines: [] };
  const year = calendarYearOf(state);
  const lines: string[] = [];
  let next = state;
  const flags = { ...next.flags };
  for (const role of openRoles(next)) {
    const key = `cast:open:${parish.id}:${role}`;
    const since = flags[key];
    if (typeof since !== 'number' || since >= next.clock.week) continue;
    if (!rng.derive(`refill:${role}`).chance(0.65)) continue;
    delete flags[key];
    const r = rng.derive(`arrive:${role}:${next.clock.week}`);
    const id = `${parish.id}_lay_${role}_${next.clock.week}`;
    const npc = generateParishioner(r, parish, state.world.diocese.presetId, year, { id, role });
    const before = Object.values(next.npcs).find((n) => n.tags.includes(`cast:${role}`) && n.tags.includes(`parish:${parish.id}`) && n.status !== 'active') ?? null;
    next = { ...next, npcs: { ...next.npcs, [id]: npc } };
    lines.push(arrivalLine(r, npc, role, year, before));
  }
  const moved = castYear({ ...next, flags }, rng.derive(`cast:${next.clock.week}`));
  next = moved.state;
  lines.push(...moved.lines);
  const after = { ...next.flags };
  for (const role of moved.vacated as CastRole[]) after[`cast:open:${parish.id}:${role}`] = next.clock.week;
  return { state: { ...next, flags: after }, lines };
}

export function setObligation(state: GameState, key: ObligationKey, quality: Quality): GameState {
  if (!state.parish) return state;
  return { ...state, parish: { ...state.parish, routine: { ...state.parish.routine, obligations: { ...state.parish.routine.obligations, [key]: quality } } } };
}

export function setDiscretionary(state: GameState, actionId: string, ap: number): GameState {
  if (!state.parish) return state;
  const discretionary = { ...state.parish.routine.discretionary, [actionId]: Math.max(0, ap) };
  if (discretionary[actionId] === 0) delete discretionary[actionId];
  return { ...state, parish: { ...state.parish, routine: { ...state.parish.routine, discretionary } } };
}

/**
 * The priests around him: the deanery forms from the map, the pastor a vicar
 * serves under shows his temperament, and a deacon on the staff is noted.
 */
function placeAmongPriests(state: GameState, rng: Rng): GameState {
  let next = formDeanery(state, rng.derive(`deanery:${state.assignment?.parishId}`));
  const pid = state.assignment?.parishId;
  if (state.assignment?.role === 'parochial_vicar' && pid) {
    const pastor = Object.values(next.npcs).find((n) => n.status === 'active' && n.tags.includes(`pastor:${pid}`));
    if (pastor) {
      const known = pastor.tags.find((t) => t.startsWith('temperament:'))?.slice('temperament:'.length);
      const temperament = known ?? rng.derive(`boss:${pid}`).weighted(['mentor', 'micromanager', 'absent'], (t) => ({ mentor: 3, micromanager: 3, absent: 2 })[t]!);
      next = {
        ...next,
        npcs: { ...next.npcs, [pastor.id]: { ...pastor, tags: known ? pastor.tags : [...pastor.tags, `temperament:${temperament}`] } },
        flags: { ...next.flags, [`boss:${temperament}`]: true },
      };
    }
  }
  if (pid && Object.values(next.npcs).some((n) => n.status === 'active' && n.tags.includes('deacon') && n.tags.includes(`parish:${pid}`))) {
    next = { ...next, flags: { ...next.flags, 'deacon:here': true } };
  }
  return next;
}
