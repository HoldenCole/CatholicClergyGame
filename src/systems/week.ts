import type { Effect, GameState, ObligationKey, Quality, Role, Season, WeekLedger, Stats, StatKey } from '@/types';
import { OBLIGATION_KEYS } from '@/types';
import { actionDefs, obligationDefs, sacrificeDefs, SEASONAL_LOAD } from '@/content/parish';
import { takeSnapshot, TRAJECTORY } from './trajectory';
import { extraBlocks, parishBlocks, wearOf } from './workweek';
import { clubHours, staminaOf } from './clubs';
import { bondsWeek } from './bonds';
import { liturgyWeek } from './liturgy';
import { fundBonuses } from './spending';
import { noteMover, trimMovers } from './movers';
import { homilyWeek } from './homily';
import { coverRelief } from './deanery';
import { helpRelief } from './formed';
import { FEAST_LABEL, feastsOfWeek } from '@/engine/feasts';
import { noticeQuarter } from './notice';
import { applyEffects } from '@/engine/effects';
import { noteStatChange } from './movers';
import { evaluateAll } from '@/engine/conditions';
import { commitmentAp } from '@/engine/offers';
import { seasonOf } from '@/engine/time';
import { decayWeek } from './stats';
import { applyReputation, fadeReputation } from './reputation';
import { terrainOf } from './assignment';
import { averageVitality, groupRelief, groupsWeek, finishFounding } from './groups';
import type { Rng } from '@/engine/rng';

/** Tunables for the weekly loop. DESIGN 2.6 and 8.1; numbers not in the design are invented. */
export const WEEK = {
  /** Lay support drifts a little each week toward or away from a man from that kind of place. Invented. */
  terrainMatchPerWeek: 0.06,
  terrainMismatchPerWeek: -0.04,
  /**
   * DESIGN §2.6 gives 10 AP; playtesting asked for a week that reads like a working week, so the base is
   * 12 blocks of four hours: about 48 hours after the daily Mass, the Office, and meals.
   */
  baseAp: { parochial_vicar: 12, administrator: 12, pastor: 12 } as Record<Role, number>,
  /** Extra administrative floor by role, reducible by Administration. */
  /** DESIGN §8.1 puts the pastor at ~6 mandatory; the obligation table alone sums to 7 at standard, so the floor stays at one. */
  adminFloor: { parochial_vicar: 0, administrator: 1, pastor: 1 } as Record<Role, number>,
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
  /** Hours a week of presence (visits, confessions, the groups, a real homily) that count as full care. Invented. */
  careFullHours: 6,
  /** How fast the rolling care score follows the week. */
  careFollow: 0.15,
  /** Attendance added at full care, and at thriving groups across the board. Invented. */
  careAttendance: 0.12,
  groupsAttendance: 0.08,
  /** How fast attendance follows its target. */
  attendanceFollow: 0.2,
  /** A vicar's people hours count for this much more, and his desk hours this much less. */
  vicarCare: 1.3,
  vicarAdmin: 0.6,
  /** At full care, finance, admin, and group fires draw this much less often. */
  careProblemRelief: 0.4,
  /** Strain recovered a week with nothing sacrificed. */
  strainRecovery: 1.5,
  /** Strain a week per block worked past a standard week, before the wear dial. */
  strainPerExtraBlock: 1,
  /** Past this, the body takes an hour back: the budget drops by one. */
  strainSick: 80,
  /** Past this, piety drains a little extra each week: tired in a way sleep does not fix. */
  strainWorn: 50,
  strainPietyDrain: 0.08,
} as const;

/** One block of the week is four working hours; the sheets speak in hours. */
export const HOURS_PER_AP = 4;
/** Hours, to the half hour: a block is four, and the obligations are costed in fractions of one. */
export function hoursOf(ap: number): number {
  return Math.round(ap * HOURS_PER_AP * 2) / 2;
}

/**
 * What a man's stats save him on each obligation, in blocks: a homily comes
 * faster to a theologian, a meeting runs short under an organized man, the
 * couples and the families do what a persuasive priest asks the first time.
 * Requested in playtesting; numbers invented.
 */
export const EFFICIENCY: { key: ObligationKey; stat: StatKey; at: number; saves: number; word: string }[] = [
  { key: 'sunday_masses', stat: 'theology', at: 50, saves: 0.25, word: 'your theology writes the homily faster' },
  { key: 'sunday_masses', stat: 'theology', at: 75, saves: 0.25, word: 'the homily comes to you almost whole' },
  { key: 'sunday_masses', stat: 'knowledge', at: 70, saves: 0.25, word: 'you have read what the homily needs' },
  { key: 'meetings', stat: 'administration', at: 50, saves: 0.25, word: 'your meetings run short' },
  { key: 'meetings', stat: 'administration', at: 75, saves: 0.25, word: 'the staff come with the work done' },
  { key: 'sacramental_prep', stat: 'knowledge', at: 60, saves: 0.25, word: 'you know the material cold' },
  { key: 'sacramental_prep', stat: 'charisma', at: 60, saves: 0.25, word: 'the couples and the families do what you ask the first time' },
];

/** The least an obligation can take, in blocks: an hour. */
const OBLIGATION_FLOOR = 0.25;

/** Blocks a man's stats save on an obligation at any quality above the minimum. */
export function efficiencyOf(key: ObligationKey, stats: Stats | undefined): number {
  if (!stats) return 0;
  return EFFICIENCY.filter((e) => e.key === key && stats[e.stat] >= e.at).reduce((n, e) => n + e.saves, 0);
}

/** The savings in words, for the week sheet. */
export function efficiencyWords(stats: Stats | undefined): string[] {
  if (!stats) return [];
  return EFFICIENCY.filter((e) => stats[e.stat] >= e.at).map((e) => e.word);
}

const NEXT_DOWN: Record<Quality, Quality | null> = { invested: 'standard', standard: 'min', min: null };

export function obligationAp(key: ObligationKey, quality: Quality, relief = 0, stats?: Stats): number {
  const def = obligationDefs.find((o) => o.key === key)!;
  const ap = def.ap[quality] ?? def.ap.standard;
  // The minimum is already the minimum; skill saves time on the work done properly.
  const saved = quality === 'min' ? 0 : efficiencyOf(key, stats);
  return Math.max(OBLIGATION_FLOOR, ap - relief - saved);
}

export function adminFloorFor(state: GameState): number {
  const role = state.assignment?.role ?? 'parochial_vicar';
  const admin = state.character?.stats.administration ?? 0;
  // A micromanaging pastor wants his reports.
  const boss = role === 'parochial_vicar' && state.flags['boss:micromanager'] ? 1 : 0;
  return Math.max(0, WEEK.adminFloor[role] - Math.floor(admin / WEEK.adminPerFloorAp)) + boss;
}

/** An absent pastor's Masses fall to his vicar. */
export function bossLoad(state: GameState): number {
  return state.assignment?.role === 'parochial_vicar' && state.flags['boss:absent'] ? 1 : 0;
}

export function seasonalLoad(state: GameState): number {
  return SEASONAL_LOAD[seasonOf(state.clock)];
}

/** What he has cut out of his own week, and the hours it buys. */
export function sacrificesOf(state: GameState): typeof sacrificeDefs {
  const ids = new Set(state.parish?.routine.sacrifices ?? []);
  return sacrificeDefs.filter((d) => ids.has(d.id));
}

export function sacrificeAp(state: GameState): number {
  return sacrificesOf(state).reduce((n, d) => n + d.ap, 0);
}

export function strainOf(state: GameState): number {
  return state.strain ?? 0;
}

/**
 * One week of wear, any phase: what he cut from his own life and the blocks
 * past a standard week add strain at the wear rate; a plain week rests him.
 */
export function strainAfterWeek(state: GameState, sacrificed: number, extra: number): number {
  const gained = Math.max(0, (sacrificed + extra * WEEK.strainPerExtraBlock) * wearOf(state) - staminaOf(state));
  const before = strainOf(state);
  return Math.max(0, Math.min(100, before + (gained > 0 ? gained : -(WEEK.strainRecovery + staminaOf(state)))));
}

export function strainWord(strain: number): string {
  return strain >= WEEK.strainSick ? 'burning out' : strain >= WEEK.strainWorn ? 'worn thin' : strain >= 25 ? 'tired' : 'rested';
}

/** Total AP the week has to give: the base, what an event took or gave, what he has cut from his own life, less what the body takes back. */
export function weekBudget(state: GameState): number {
  const role = state.assignment?.role ?? 'parochial_vicar';
  const sick = strainOf(state) >= WEEK.strainSick ? 1 : 0;
  const base = parishBlocks(state) + (WEEK.baseAp[role] - WEEK.baseAp.parochial_vicar);
  return Math.max(1, base + (state.parish?.apNextWeek ?? 0) + sacrificeAp(state) - sick);
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
  // The men around him give blocks back below the floor: a neighbor's cover, a seminarian, a deacon, the vicar he formed.
  const fixed = Math.max(0, seasonalLoad(state) + adminFloorFor(state) + commitmentAp(state) + (state.founding?.apPerWeek ?? 0) + (state.parish?.work?.apPerWeek ?? 0) + clubHours(state) + bossLoad(state) - fundBonuses(state).relief) - coverRelief(state) - helpRelief(state);
  const relief = groupRelief(state);
  const obligations = { ...parish.routine.obligations };
  const stats = state.character?.stats;
  const mandatoryOf = () => Math.max(0, fixed + OBLIGATION_KEYS.reduce((n, k) => n + obligationAp(k, obligations[k], (relief as Record<string, number>)[k] ?? 0, stats), 0));

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

/** Presence hours in the week as a 0..1 share of full care. */
export function careOfPlan(plan: Plan, role: string = 'pastor'): number {
  const d = plan.discretionary;
  const homily = plan.obligations.sunday_masses === 'invested' ? 2 : plan.obligations.sunday_masses === 'min' ? -1 : 0;
  // A vicar's hours are the people's: the same visit counts for more.
  const people = role === 'parochial_vicar' ? WEEK.vicarCare : 1;
  const hours = people * ((d.visits ?? 0) + 0.6 * (d.extra_confessions ?? 0) + 0.6 * (d.groups ?? 0)) + homily;
  return Math.max(0, Math.min(1, hours / WEEK.careFullHours));
}

/** The rolling care score, 0..1; older saves start at nothing. */
export function careOf(state: GameState): number {
  return state.parish?.care ?? 0;
}

/** Where attendance is heading under the current routine and standing. */
export function attendanceTarget(state: GameState, care: number, extra = 0): number {
  const c = state.character!;
  const groups = (averageVitality(state) - 50) / 50;
  const raw = 0.4 + c.reputation.parishioners / 400 + c.stats.charisma / 600 + WEEK.careAttendance * care + WEEK.groupsAttendance * groups + extra;
  return Math.min(0.9, Math.max(0.15, raw));
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
    next = applyEffects(next, def.effects[quality], {}, quality === 'standard' ? def.label : `${def.label}, ${quality === 'min' ? 'at the minimum' : 'invested'}`);
    if (quality === 'min' && key === 'sunday_masses') lines.push('The homily was from the file.');
  }
  const streak = plan.obligations.sunday_masses === 'min' ? parish.recycledHomilyStreak + 1 : 0;
  if (streak > 1) {
    next = applyEffects(next, [{ target: 'reputation', key: 'parishioners', delta: -WEEK.recycledStreakPenalty * streak }], {}, 'the homily from the file, again');
  }
  if (plan.neglected) {
    next = applyEffects(next, [
      { target: 'reputation', key: 'parishioners', delta: -2 },
      { target: 'stat', key: 'piety', delta: -0.5 },
    ], {}, 'not enough of you to go round');
    lines.push('There was not enough of you to go round this week, and people noticed.');
  } else if (plan.obligations.sunday_masses !== parish.routine.obligations.sunday_masses || plan.obligations.sacramental_prep !== parish.routine.obligations.sacramental_prep) {
    lines.push('The week ran over; something was done less well than you meant to.');
  }

  // Discretionary actions.
  let adminAp = adminFloorFor(next) + obligationAp('meetings', plan.obligations.meetings, 0, state.character?.stats);
  let theologyUsed = plan.obligations.sunday_masses === 'invested';
  let knowledgeUsed = false;
  // In content order, not the routine's key order, so a saved week resolves in the same order as an unsaved one.
  for (const def of actionDefs) {
    const id = def.id;
    const ap = plan.discretionary[id] ?? 0;
    if (ap <= 0) continue;
    if (def.requires && !evaluateAll(def.requires, next)) continue;
    const effective = Math.min(ap, def.maxAp);
    // A vicar's role is the people: his visits and confessions pay more, his desk work less.
    const vicar = state.assignment?.role === 'parochial_vicar';
    // A mentor makes the people's work pay a little more; an absent pastor leaves the desk to his vicar, and it counts.
    const factor = vicar && ['visits', 'extra_confessions', 'groups'].includes(id) ? WEEK.vicarCare + (state.flags['boss:mentor'] ? 0.1 : 0) : vicar && id === 'admin' ? (state.flags['boss:absent'] ? 1 : WEEK.vicarAdmin) : 1;
    next = applyEffects(next, scaled(def.effectsPerAp, effective * factor), {}, def.label);
    if (def.adminLoad) adminAp += effective;
    if (def.usesTheology) theologyUsed = true;
    if (def.usesKnowledge) knowledgeUsed = true;
  }
  if (plan.slack > 0) next = applyEffects(next, [{ target: 'stat', key: 'piety', delta: WEEK.restPietyPerAp * plan.slack }], {}, 'hours left to rest');

  // What he cut from his own week costs him, and wears him. DESIGN §2.6 extension.
  const sacrificed = sacrificesOf(state);
  for (const d of sacrificed) next = applyEffects(next, d.effectsPerWeek, {}, `${d.label} cut from the week`);
  const strainBefore = strainOf(state);
  const strain = strainAfterWeek(state, sacrificed.reduce((n, d) => n + d.strain, 0), extraBlocks(state));
  if (strain >= WEEK.strainWorn) next = applyEffects(next, [{ target: 'stat', key: 'piety', delta: -WEEK.strainPietyDrain }], {}, 'worn out');
  if (strainBefore < WEEK.strainWorn && strain >= WEEK.strainWorn) lines.push('You are tired in a way sleep does not fix.');
  if (strainBefore < WEEK.strainSick && strain >= WEEK.strainSick) lines.push('You were sick for two days and said Mass anyway. Something has to give.');
  if (strainBefore >= WEEK.strainWorn && strain < WEEK.strainWorn) lines.push('You slept, and it showed.');

  // Groups: the sustaining AP goes to them; founding projects resolve.
  const groupResult = groupsWeek(next, plan.discretionary.groups ?? 0, rng);
  next = groupResult.state;
  lines.push(...groupResult.lines);
  // The people: at sacramental care, something happens to someone you know, and the parish keeps it.
  const bonded = bondsWeek(next, plan.obligations.sacramental_prep ?? 'standard', rng.derive(`bonds:${state.clock.week}`));
  next = bonded.state;
  if (bonded.line) lines.push(bonded.line);
  const day = new Date((next.clock.startDay + next.clock.week * 7) * 86_400_000);
  const founded = finishFounding(next, rng, day.getUTCFullYear());
  next = founded.state;
  if (founded.line) lines.push(founded.line);
  // A well-run parish draws families from outside it, once a quarter.
  const noticed = noticeQuarter(next, rng.derive(`notice:${state.clock.week}`));
  next = noticed.state;
  if (noticed.line) lines.push(noticed.line);

  // Decay.
  const c = next.character!;
  const decayed = decayWeek(c.stats, { adminAp, theologyUsed, knowledgeUsed });
  next = noteStatChange(next, c.stats, decayed, 'unused, and fading');
  next = { ...next, character: fadeReputation({ ...c, stats: decayed }) };
  // DESIGN §3.2: home terrain is a standing pull on lay support, for or against.
  const terrain = terrainOf(next);
  const here = next.world!.parishes.find((p) => p.id === parish.parishId)!;
  if (terrain && terrain !== 'none') {
    const pull = terrain === here.terrain ? WEEK.terrainMatchPerWeek : WEEK.terrainMismatchPerWeek;
    next = noteMover({ ...next, character: { ...next.character!, reputation: applyReputation(next.character!.reputation, 'parishioners', pull) } }, 'parishioners', pull, terrain === here.terrain ? 'a parish like the one you came from' : 'a parish unlike the one you came from');
  }

  // Presence and attendance. Hours with the people show up in the pews, slowly.
  const care = careOf(state) + (careOfPlan(plan, state.assignment?.role) - careOf(state)) * WEEK.careFollow;
  // The Mass as set, and the standing programs, pull on the pews.
  const mass = liturgyWeek(next);
  next = mass.state;
  if (mass.line) lines.push(mass.line);
  const preached = homilyWeek(next);
  next = preached.state;
  const bonuses = fundBonuses(next);
  bonuses.collections += preached.collections;
  const target = attendanceTarget(next, care, mass.pull + bonuses.pull);
  const attendance = parish.attendance + (target - parish.attendance) * WEEK.attendanceFollow;

  // Finance.
  const world = next.world!;
  const record = world.parishes.find((p) => p.id === parish.parishId)!;
  const season = seasonOf(next.clock);
  const seasonal = WEEK.collectionSeason[season] * (season === 'ordinary' && isSummer(next) ? WEEK.summerCollection : 1);
  const collection = Math.round(record.weeklyCollections * (attendance / 0.45) * seasonal * (1 + bonuses.collections) * rng.float(0.92, 1.08));
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

  // The feasts of the week go into the digest.
  for (const key of feastsOfWeek(next.clock, record)) lines.push(`${key === 'patronal' && record.patronal ? record.patronal.label : FEAST_LABEL[key]} this week.`);
  next = trimMovers(next);

  // A quarterly reading, so he can tell whether the place is turning.
  const dueSnapshot = (parish.weeksServed + 1) % TRAJECTORY.everyWeeks === 0;

  const ledger: WeekLedger = {
    week: next.clock.week,
    apTotal: weekBudget(state),
    apMandatory: plan.mandatory,
    apDiscretionary: plan.discretionary,
    obligations: plan.obligations,
    collection,
    attendance,
    attendanceDelta: attendance - parish.attendance,
    debtService,
    lines,
  };
  const result: { state: GameState; ledger: WeekLedger } = {
    state: {
      ...next,
      strain,
      world: { ...world, parishes },
      parish: {
        ...parish,
        attendance,
        care,
        recycledHomilyStreak: streak,
        apNextWeek: 0,
        weeksServed: parish.weeksServed + 1,
        finance: { ...parish.finance, cash, averageCollection, weeksToAssessment },
      },
    },
    ledger,
  };
  if (dueSnapshot) {
    const snap = takeSnapshot(result.state);
    if (snap) result.state = { ...result.state, parish: { ...result.state.parish!, snapshots: [...(parish.snapshots ?? []), snap].slice(-TRAJECTORY.keep) } };
  }
  return result;
}
