import type { Effect, GameState, ObligationKey, Quality, Role, Season, WeekLedger } from '@/types';
import { OBLIGATION_KEYS } from '@/types';
import { actionDefs, obligationDefs, SEASONAL_LOAD } from '@/content/parish';
import { applyEffects } from '@/engine/effects';
import { commitmentAp } from '@/engine/offers';
import { seasonOf } from '@/engine/time';
import { decayWeek } from './stats';
import { applyReputation, fadeReputation } from './reputation';
import { terrainOf } from './assignment';
import { groupRelief, groupsWeek, finishFounding } from './groups';
import type { Rng } from '@/engine/rng';

/** Tunables for the weekly loop. DESIGN 2.6 and 8.1; numbers not in the design are invented. */
export const WEEK = {
  /** Lay support drifts a little each week toward or away from a man from that kind of place. Invented. */
  terrainMatchPerWeek: 0.06,
  terrainMismatchPerWeek: -0.04,
  baseAp: { parochial_vicar: 10, administrator: 10, pastor: 10 } as Record<Role, number>,
  /** Extra administrative floor by role, reducible by Administration. */
  adminFloor: { parochial_vicar: 0, administrator: 1, pastor: 2 } as Record<Role, number>,
  /** One AP of floor forgiven per this much Administration. */
  adminPerFloorAp: 45,
  /** Order in which obligations are cut when the week does not fit. */
  cutOrder: ['meetings', 'weekday_masses', 'confessions', 'sacramental_prep', 'sunday_masses'] as ObligationKey[],
  /** Piety recovered per unspent AP. */
  restPietyPerAp: 0.02,
  /** Extra lay-support loss per week of a running recycled-homily streak. */
  recycledStreakPenalty: 0.08,
  /** Seasonal collection multipliers. */
  collectionSeason: { advent: 1.05, christmas: 1.6, ordinary: 1, lent: 1.05, holy_week: 1.2, easter: 1.35 } as Record<Season, number>,
  /** Summer Ordinary Time (weeks 26–35 of the calendar year) dips. */
  summerCollection: 0.85,
  runningCostShare: 0.82,
  debtRateAnnual: 0.05,
  buildingDecayPerWeek: 0.04,
} as const;

const NEXT_DOWN: Record<Quality, Quality | null> = { invested: 'standard', standard: 'min', min: null };

export function obligationAp(key: ObligationKey, quality: Quality, relief = 0): number {
  const def = obligationDefs.find((o) => o.key === key)!;
  const ap = def.ap[quality] ?? def.ap.standard;
  return Math.max(1, ap - relief);
}

export function adminFloorFor(state: GameState): number {
  const role = state.assignment?.role ?? 'parochial_vicar';
  const admin = state.character?.stats.administration ?? 0;
  return Math.max(0, WEEK.adminFloor[role] - Math.floor(admin / WEEK.adminPerFloorAp));
}

export function seasonalLoad(state: GameState): number {
  return SEASONAL_LOAD[seasonOf(state.clock)];
}

/** Total AP the week has to give. */
export function weekBudget(state: GameState): number {
  const role = state.assignment?.role ?? 'parochial_vicar';
  return WEEK.baseAp[role] + (state.parish?.apNextWeek ?? 0);
}

export interface Plan {
  obligations: Record<ObligationKey, Quality>;
  mandatory: number;
  discretionary: Record<string, number>;
  slack: number;
  /** True when even the minimum did not fit and something was neglected outright. */
  neglected: boolean;
}

/**
 * Fit the routine into this week's budget. Obligations are cut in a fixed
 * order until the mandatory floor fits; discretionary spending is scaled to
 * whatever is left. Pure, so the UI can preview the week.
 */
export function planWeek(state: GameState): Plan {
  const parish = state.parish!;
  const budget = weekBudget(state);
  const fixed = seasonalLoad(state) + adminFloorFor(state) + commitmentAp(state) + (state.founding?.apPerWeek ?? 0);
  const relief = groupRelief(state);
  const obligations = { ...parish.routine.obligations };
  const mandatoryOf = () => fixed + OBLIGATION_KEYS.reduce((n, k) => n + obligationAp(k, obligations[k], (relief as Record<string, number>)[k] ?? 0), 0);

  let neglected = false;
  let guard = 0;
  while (mandatoryOf() > budget && guard++ < 20) {
    let cut = false;
    for (const key of WEEK.cutOrder) {
      const down = NEXT_DOWN[obligations[key]];
      if (down) {
        obligations[key] = down;
        cut = true;
        break;
      }
    }
    if (!cut) {
      neglected = true;
      break;
    }
  }
  const mandatory = mandatoryOf();
  const available = Math.max(0, budget - mandatory);
  const requested = Object.entries(parish.routine.discretionary).filter(([, ap]) => ap > 0);
  const total = requested.reduce((n, [, ap]) => n + ap, 0);
  const scale = total > available ? available / total : 1;
  const discretionary: Record<string, number> = {};
  for (const [id, ap] of requested) discretionary[id] = Math.round(ap * scale * 4) / 4;
  const spent = Object.values(discretionary).reduce((n, ap) => n + ap, 0);
  return { obligations, mandatory, discretionary, slack: Math.max(0, available - spent), neglected };
}

function scaled(effects: Effect[], factor: number): Effect[] {
  return effects.map((e) => (e.delta !== undefined ? { ...e, delta: e.delta * factor } : e));
}

function isSummer(state: GameState): boolean {
  const day = new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000);
  const m = day.getUTCMonth();
  return m >= 5 && m <= 7;
}

/**
 * Resolve one parish week: obligations at their quality, discretionary
 * actions, decay, finance, and the ledger for the digest.
 */
export function resolveWeek(state: GameState, rng: Rng): { state: GameState; ledger: WeekLedger } {
  const parish = state.parish!;
  const plan = planWeek(state);
  const lines: string[] = [];
  let next: GameState = state;

  // Obligations.
  for (const key of OBLIGATION_KEYS) {
    const def = obligationDefs.find((o) => o.key === key)!;
    const quality = plan.obligations[key];
    next = applyEffects(next, def.effects[quality]);
    if (quality === 'min' && key === 'sunday_masses') lines.push('The homily was from the file.');
  }
  const streak = plan.obligations.sunday_masses === 'min' ? parish.recycledHomilyStreak + 1 : 0;
  if (streak > 1) {
    next = applyEffects(next, [{ target: 'reputation', key: 'parishioners', delta: -WEEK.recycledStreakPenalty * streak }]);
  }
  if (plan.neglected) {
    next = applyEffects(next, [
      { target: 'reputation', key: 'parishioners', delta: -2 },
      { target: 'stat', key: 'piety', delta: -0.5 },
    ]);
    lines.push('There was not enough of you to go round this week, and people noticed.');
  } else if (plan.obligations.sunday_masses !== parish.routine.obligations.sunday_masses || plan.obligations.sacramental_prep !== parish.routine.obligations.sacramental_prep) {
    lines.push('The week ran over; something was done less well than you meant to.');
  }

  // Discretionary actions.
  let adminAp = adminFloorFor(next) + obligationAp('meetings', plan.obligations.meetings);
  let theologyUsed = plan.obligations.sunday_masses === 'invested';
  let knowledgeUsed = false;
  for (const [id, ap] of Object.entries(plan.discretionary)) {
    const def = actionDefs.find((a) => a.id === id);
    if (!def || ap <= 0) continue;
    const effective = Math.min(ap, def.maxAp);
    next = applyEffects(next, scaled(def.effectsPerAp, effective));
    if (def.adminLoad) adminAp += effective;
    if (def.usesTheology) theologyUsed = true;
    if (def.usesKnowledge) knowledgeUsed = true;
  }
  if (plan.slack > 0) next = applyEffects(next, [{ target: 'stat', key: 'piety', delta: WEEK.restPietyPerAp * plan.slack }]);

  // Groups: the sustaining AP goes to them; founding projects resolve.
  const groupResult = groupsWeek(next, plan.discretionary.groups ?? 0, rng);
  next = groupResult.state;
  lines.push(...groupResult.lines);
  const day = new Date((next.clock.startDay + next.clock.week * 7) * 86_400_000);
  const founded = finishFounding(next, rng, day.getUTCFullYear());
  next = founded.state;
  if (founded.line) lines.push(founded.line);

  // Decay.
  const c = next.character!;
  next = { ...next, character: fadeReputation({ ...c, stats: decayWeek(c.stats, { adminAp, theologyUsed, knowledgeUsed }) }) };
  // DESIGN §3.2: home terrain is a standing pull on lay support, for or against.
  const terrain = terrainOf(next);
  const here = next.world!.parishes.find((p) => p.id === parish.parishId)!;
  if (terrain && terrain !== 'none') {
    const pull = terrain === here.terrain ? WEEK.terrainMatchPerWeek : WEEK.terrainMismatchPerWeek;
    next = { ...next, character: { ...next.character!, reputation: applyReputation(next.character!.reputation, 'parishioners', pull) } };
  }

  // Finance.
  const world = next.world!;
  const record = world.parishes.find((p) => p.id === parish.parishId)!;
  const support = next.character!.reputation.parishioners;
  const attendance = Math.min(0.9, Math.max(0.15, 0.4 + support / 400 + next.character!.stats.charisma / 600));
  const season = seasonOf(next.clock);
  const seasonal = WEEK.collectionSeason[season] * (season === 'ordinary' && isSummer(next) ? WEEK.summerCollection : 1);
  const collection = Math.round(record.weeklyCollections * (attendance / 0.45) * seasonal * rng.float(0.92, 1.08));
  const running = Math.round(record.weeklyCollections * WEEK.runningCostShare);
  const debtService = Math.round((parish.finance.debt * WEEK.debtRateAnnual) / 52);
  let cash = parish.finance.cash + collection - running - debtService;
  let weeksToAssessment = parish.finance.weeksToAssessment - 1;
  if (weeksToAssessment <= 0) {
    cash -= Math.round(record.assessment / 4);
    weeksToAssessment = 13;
    lines.push('The quarterly assessment went to the chancery.');
  }
  const averageCollection = Math.round(parish.finance.averageCollection * 0.9 + collection * 0.1);
  const buildings = { ...record.buildings };
  for (const k of ['church', 'rectory', 'hall'] as const) buildings[k] = Math.max(0, buildings[k] - WEEK.buildingDecayPerWeek);
  if (buildings.school !== null) buildings.school = Math.max(0, buildings.school - WEEK.buildingDecayPerWeek);
  const parishes = world.parishes.map((p) => (p.id === record.id ? { ...p, buildings } : p));

  const ledger: WeekLedger = {
    week: next.clock.week,
    apTotal: weekBudget(state),
    apMandatory: plan.mandatory,
    apDiscretionary: plan.discretionary,
    obligations: plan.obligations,
    collection,
    lines,
  };
  return {
    state: {
      ...next,
      world: { ...world, parishes },
      parish: {
        ...parish,
        attendance,
        recycledHomilyStreak: streak,
        apNextWeek: 0,
        weeksServed: parish.weeksServed + 1,
        finance: { ...parish.finance, cash, averageCollection, weeksToAssessment },
      },
    },
    ledger,
  };
}
