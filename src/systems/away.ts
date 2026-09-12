import type { AwayPlaceDef, GameEvent, GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { awayPlace, awayPlaces } from '@/content/parish';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { describeUnmet } from './doors';
import { controlsMoney } from './finance';
import { strainOf } from './week';

/** Requested in playtesting; canon 276 obliges the retreat. Numbers invented. */
export const AWAY = {
  /** Vacation weeks a calendar year. */
  vacationWeeks: 2,
  /** What skipping the retreat costs when the year ends. */
  overdueChancery: -4,
  overduePiety: -1,
} as const;

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

export interface AwayAvailability {
  def: AwayPlaceDef;
  available: boolean;
  why: string | null;
}

/** Whether the retreat is still owed this year. */
export function retreatDue(state: GameState): boolean {
  return !!state.parish && state.parish.retreatYear !== calendarYear(state);
}

export function vacationLeft(state: GameState): number {
  const v = state.parish?.vacation;
  const year = calendarYear(state);
  return AWAY.vacationWeeks - (v && v.year === year ? v.weeks : 0);
}

export function awayAvailability(state: GameState): AwayAvailability[] {
  return awayPlaces.map((def) => {
    if (!state.parish) return { def, available: false, why: 'Not from here' };
    if (state.away) return { def, available: false, why: 'You are away' };
    if (state.mode.kind !== 'clock' || state.pending.length > 0) return { def, available: false, why: 'Not this week' };
    if (def.kind === 'retreat' && !retreatDue(state)) return { def, available: false, why: 'Made this year' };
    if (def.kind === 'vacation' && vacationLeft(state) < def.weeks) return { def, available: false, why: vacationLeft(state) <= 0 ? 'No weeks left this year' : `Only ${vacationLeft(state)} week left this year` };
    if (def.requires && !evaluateAll(def.requires, state)) return { def, available: false, why: `needs ${def.requires.map((c) => describeUnmet(c, state)).find((w): w is string => !!w) ?? 'something else'}` };
    if (controlsMoney(state) && (state.parish.finance.cash < def.supply * def.weeks)) return { def, available: false, why: 'The parish cannot pay a supply priest' };
    return { def, available: true, why: null };
  });
}

/** Go. The week hook takes it from here. */
export function goAway(state: GameState, placeId: string): GameState {
  const a = awayAvailability(state).find((x) => x.def.id === placeId);
  if (!a?.available || !state.parish) throw new Error(a?.why ?? 'not now');
  const def = a.def;
  const year = calendarYear(state);
  const parish = {
    ...state.parish,
    ...(def.kind === 'retreat' ? { retreatYear: year } : {}),
    ...(def.kind === 'vacation' ? { vacation: { year, weeks: (state.parish.vacation?.year === year ? state.parish.vacation.weeks : 0) + def.weeks } } : {}),
  };
  return {
    ...state,
    parish,
    away: { placeId, kind: def.kind, weeksLeft: def.weeks, startWeek: state.clock.week },
    flags: { ...state.flags, [`away:${def.kind}`]: true, [`away:place:${def.id}`]: true, 'retreat:overdue': def.kind === 'retreat' ? false : (state.flags['retreat:overdue'] ?? false) },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `${def.kind === 'retreat' ? 'Made the retreat' : 'Took a vacation'}: ${def.label.toLowerCase()}.` }],
  };
}

/**
 * A week away: no routine, a supply priest paid for, strain repaired, the
 * place's effects, and a scene the first week. The last week clears the flags.
 */
export function awayWeek(state: GameState, rng: Rng, pool: GameEvent[]): { state: GameState; line: string; event: GameEvent | null } {
  const away = state.away!;
  const def = awayPlace(away.placeId)!;
  let next: GameState = state;
  const strain = Math.max(0, strainOf(state) - def.strain);
  next = { ...next, strain };
  next = applyEffects(next, def.weekly, {}, def.label);
  if (controlsMoney(next) && next.parish) next = { ...next, parish: { ...next.parish, finance: { ...next.parish.finance, cash: next.parish.finance.cash - def.supply } } };
  const first = away.weeksLeft === def.weeks;
  const candidates = first ? pool.filter((e) => e.beat === 'away' && evaluateAll(e.requires ?? [], next)) : [];
  const event = candidates.length ? rng.derive(`away:${state.clock.week}`).pick(candidates.sort((a, b) => (a.id < b.id ? -1 : 1))) : null;
  const weeksLeft = away.weeksLeft - 1;
  const line = weeksLeft > 0 ? `Away: ${def.label.toLowerCase()}. The supply priest has the Masses.` : `Back from ${def.kind === 'retreat' ? 'the retreat' : 'vacation'}: ${def.label.toLowerCase()}.`;
  if (weeksLeft > 0) next = { ...next, away: { ...away, weeksLeft } };
  else next = { ...next, away: null, flags: { ...next.flags, [`away:${def.kind}`]: false, [`away:place:${def.id}`]: false } };
  return { state: next, line, event };
}

/** The year turned without a retreat: the chancery notices, and he knows. */
export function retreatYearEnd(state: GameState): { state: GameState; line: string | null } {
  if (!state.parish || !retreatDue(state)) return { state, line: null };
  // The year that just ended is the one owed; mark the new year as still open.
  const lastYear = calendarYear(state) - 1;
  if (state.parish.retreatYear === lastYear) return { state, line: null };
  let next = applyEffects(state, [{ target: 'reputation', key: 'chancery', delta: AWAY.overdueChancery }, { target: 'stat', key: 'piety', delta: AWAY.overduePiety }], {}, 'a year without the retreat');
  next = { ...next, flags: { ...next.flags, 'retreat:overdue': true } };
  return { state: next, line: 'A year went by without a retreat. Canon 276 says otherwise, and so, in time, will the chancery.' };
}
