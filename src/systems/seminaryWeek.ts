import type { Mover } from './movers';
import type { GameState, Pillar, SeminaryState, StatKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { seminaryActivities, seminaryActivity } from '@/content/seminary';
import { resolveSelector } from '@/engine/selectors';
import { applyStat } from './stats';
import { applyReputation } from './reputation';
import { renderText } from '@/engine/text';
import { freeHourShift } from './workweek';
import { clubHours } from './clubs';
import { strainAfterWeek, strainOf, WEEK } from './week';

/** DESIGN §6: the weekly loop at low stakes, with fewer hours than a parish. Invented. */
export const SEMINARY_WEEK = {
  /** Free hours a week after the horarium and classes. */
  freeHours: 5,
  /** The propaedeutic year has more silence and less choice. */
  propaedeuticHours: 4,
  /** The deacon's year runs at near-parish complexity. DESIGN §6.3 */
  deaconHours: 6,
} as const;

export function seminaryBudget(state: GameState): number {
  const year = state.seminary?.year ?? 2;
  const base = year === 1 ? SEMINARY_WEEK.propaedeuticHours : year >= 7 ? SEMINARY_WEEK.deaconHours : SEMINARY_WEEK.freeHours;
  const sick = strainOf(state) >= WEEK.strainSick ? 1 : 0;
  return Math.max(1, base + freeHourShift(state) - sick);
}

export function routineOf(sem: SeminaryState): Record<string, number> {
  return sem.routine ?? {};
}

export function routineHours(sem: SeminaryState): number {
  return Object.values(routineOf(sem)).reduce((a, b) => a + b, 0);
}

const STAT_WORD: Record<StatKey, string> = { piety: 'piety', theology: 'theology', knowledge: 'learning', charisma: 'presence', administration: 'order' };

/** What an activity builds, in words: the sheet shows no numbers in seminary. */
export function activityBuilds(id: string): string {
  const def = seminaryActivity(id);
  if (!def) return '';
  const keys = (Object.keys(def.stats) as StatKey[]).sort((a, b) => (def.stats[b] ?? 0) - (def.stats[a] ?? 0));
  return keys.map((k) => STAT_WORD[k]).join(', ');
}

/** A sentence for the evaluation about what the year's free hours did, or null if they did nothing. */
export function hoursGainsSentence(sem: SeminaryState): string | null {
  const gains = Object.entries(sem.hoursGains ?? {}).filter(([, v]) => (v ?? 0) >= 1) as [StatKey, number][];
  if (!gains.length) return null;
  gains.sort((a, b) => b[1] - a[1]);
  const word = (v: number) => (v >= 8 ? 'a great deal of' : v >= 4 ? 'a good deal of' : 'some');
  const parts = gains.map(([k, v]) => `${word(v)} ${STAT_WORD[k]}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]!;
  return `Your own hours this year built ${list}.`;
}

/** Give an activity so many hours a week; clamped to its maximum and to what is left of the week. */
export function setSeminaryActivity(state: GameState, id: string, ap: number): GameState {
  const sem = state.seminary;
  const def = seminaryActivity(id);
  if (!sem || !def) throw new Error(`no such activity ${id}`);
  const routine = { ...routineOf(sem) };
  const others = routineHours(sem) - (routine[id] ?? 0) + clubHours(state);
  const next = Math.max(0, Math.min(def.maxAp, Math.floor(ap), seminaryBudget(state) - others));
  if (next === 0) delete routine[id];
  else routine[id] = next;
  return { ...state, seminary: { ...sem, routine } };
}

const CLASSES: Record<number, string> = {
  1: 'The propaedeutic silence',
  2: 'Philosophy',
  3: 'Philosophy',
  4: 'Theology',
  5: 'Theology',
  6: 'Theology and the diaconate',
  7: 'The parish and the pulpit',
};

export interface SeminaryWeekResult {
  state: GameState;
  /** The digest line for the week. */
  line: string;
}

/**
 * One week of what the man chose to do with his free hours: pillars and
 * stats move a little, the people he spent them with warm a little, and
 * hours toward a language add up until they become a credential.
 */
export function seminaryWeek(state: GameState, rng: Rng): SeminaryWeekResult {
  const sem = state.seminary;
  const c = state.character;
  if (!sem || !c) return { state, line: '' };
  const routine = routineOf(sem);
  let stats = c.stats;
  let reputation = c.reputation;
  let credentials = c.credentials;
  const pillarScores = { ...sem.pillarScores };
  const hoursLogged = { ...(sem.hoursLogged ?? {}) };
  const hoursGains: Partial<Record<StatKey, number>> = { ...(sem.hoursGains ?? {}) };
  const npcs = { ...state.npcs };
  const flags = { ...state.flags };
  const phrases: string[] = [];
  const earned: string[] = [];
  const bindings: Record<string, string> = {};
  const moves: Mover[] = [];
  for (const def of seminaryActivities) {
    const hours = routine[def.id] ?? 0;
    if (hours <= 0) continue;
    for (const [p, rate] of Object.entries(def.pillars) as [Pillar, number][]) pillarScores[p] += rate * hours;
    for (const [k, rate] of Object.entries(def.stats) as [StatKey, number][]) {
      const before = stats[k];
      stats = applyStat(stats, k, rate * hours);
      hoursGains[k] = (hoursGains[k] ?? 0) + (stats[k] - before);
      moves.push({ week: state.clock.week, key: k, delta: stats[k] - before, why: def.label });
    }
    if (def.reputation) reputation = applyReputation(reputation, def.reputation.key, def.reputation.delta * hours);
    for (const r of def.relationships ?? []) {
      const npc = resolveSelector({ ...state, npcs }, r.selector, rng.derive(`${def.id}:${state.clock.week}`));
      if (!npc) continue;
      npcs[npc.id] = { ...npc, relationship: Math.max(-100, Math.min(100, npc.relationship + r.delta * hours)) };
      bindings[r.selector] = npc.id;
    }
    if (def.credentialAfter) {
      const before = hoursLogged[def.id] ?? 0;
      hoursLogged[def.id] = before + hours;
      const need = def.credentialAfter.hours;
      if (before < need && hoursLogged[def.id]! >= need && !credentials.includes(def.credentialAfter.credential)) {
        credentials = [...credentials, def.credentialAfter.credential];
        if (def.credentialAfter.flag) flags[def.credentialAfter.flag] = true;
        earned.push(def.credentialAfter.line);
      }
    }
    const phrase = def.digest[(state.clock.week + def.digest.length) % def.digest.length]!;
    phrases.push(hours > 1 ? `${phrase} (${hours} hours)` : phrase);
  }
  // A longer week than the house keeps wears on a seminarian too.
  const strain = strainAfterWeek(state, 0, Math.max(0, freeHourShift(state)));
  if (strain >= WEEK.strainWorn) {
    stats = applyStat(stats, 'piety', -WEEK.strainPietyDrain);
    moves.push({ week: state.clock.week, key: 'piety', delta: -WEEK.strainPietyDrain, why: 'worn out' });
  }
  const next: GameState = {
    ...state,
    npcs,
    flags,
    strain,
    movers: [...(state.movers ?? []), ...moves.filter((m) => m.delta !== 0)],
    character: { ...c, stats, reputation, credentials },
    seminary: { ...sem, pillarScores, hoursLogged, hoursGains },
  };
  const head = CLASSES[sem.year] ?? 'Classes';
  const body = phrases.length ? `${head}; ${phrases.join(', ')}.` : `${head}, and the free hours went nowhere in particular.`;
  const line = renderText([body, ...earned].join(' '), next, bindings);
  return { state: next, line };
}
