import type { Beat, GameState, ParishState, Quality, ObligationKey } from '@/types';
import type { Rng } from './rng';
import { generateParishPeople } from '@/generation/parishPeople';
import { generateGroups } from '@/systems/groups';
import { resolveWeek } from '@/systems/week';
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
  const parishes = world.parishes.map((p) => (p.id === parish.id ? { ...p, staffIds, groupIds } : p));

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
  };
  const beats: Beat[] = [
    ...state.beats.filter((b) => b.kind !== 'assignment'),
    { kind: 'assignment' as const, week: arcEndWeek, label: 'The bishop is thinking about your next assignment' },
  ].sort((a, b) => a.week - b.week);
  const flags = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('parish:') || k.startsWith('role:')) delete flags[k];
  flags[`role:${assignment.role}`] = true;
  flags[`parish:kind:${parish.kind}`] = true;
  if (parish.needsSpanish) flags['parish:needs_spanish'] = true;

  return {
    ...state,
    npcs,
    groups,
    world: { ...world, parishes },
    parish: parishState,
    beats,
    flags,
    mode: { kind: 'clock' },
  };
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
  const lines = ambient as Record<string, string[]>;
  const parish = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  const pools = [lines.any ?? []];
  const season = seasonOf(state.clock);
  if (lines[season]) pools.push(lines[season]!);
  if (parish && lines[parish.kind]) pools.push(lines[parish.kind]!);
  const pool = rng.pick(pools);
  return rng.pick(pool.length ? pool : lines.any ?? ['A quiet week.']);
}

/** The parish side of a week: the routine resolves, finance ticks, the digest fills. */
export function parishWeek(state: GameState, rng: Rng): GameState {
  if (!state.parish || !state.assignment || !state.character) return state;
  let next = maybeReschedule(state, rng);
  const { state: resolved, ledger } = resolveWeek(next, rng);
  next = resolved;
  const money = ledger.collection >= next.parish!.finance.averageCollection ? 'a little above' : 'a little below';
  const lines = [
    ...ledger.lines,
    `Collections $${ledger.collection.toLocaleString()}, ${money} the usual.`,
    ambientLine(next, rng.derive(`ambient:${next.clock.week}`)),
  ];
  const last = next.digest[next.digest.length - 1];
  const digest = last && last.week === next.clock.week
    ? [...next.digest.slice(0, -1), { ...last, lines: [...last.lines, ...lines] }]
    : [...next.digest, { week: next.clock.week, lines }];
  return { ...next, digest };
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
