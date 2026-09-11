import type { GameState, Pillar, SeminaryState, StatKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { seminaryActivities, seminaryActivity } from '@/content/seminary';
import { resolveSelector } from '@/engine/selectors';
import { applyStat } from './stats';
import { applyReputation } from './reputation';
import { renderText } from '@/engine/text';

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
  return year === 1 ? SEMINARY_WEEK.propaedeuticHours : year >= 7 ? SEMINARY_WEEK.deaconHours : SEMINARY_WEEK.freeHours;
}

export function routineOf(sem: SeminaryState): Record<string, number> {
  return sem.routine ?? {};
}

export function routineHours(sem: SeminaryState): number {
  return Object.values(routineOf(sem)).reduce((a, b) => a + b, 0);
}

/** Give an activity so many hours a week; clamped to its maximum and to what is left of the week. */
export function setSeminaryActivity(state: GameState, id: string, ap: number): GameState {
  const sem = state.seminary;
  const def = seminaryActivity(id);
  if (!sem || !def) throw new Error(`no such activity ${id}`);
  const routine = { ...routineOf(sem) };
  const others = routineHours(sem) - (routine[id] ?? 0);
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
  const npcs = { ...state.npcs };
  const flags = { ...state.flags };
  const phrases: string[] = [];
  const earned: string[] = [];
  const bindings: Record<string, string> = {};
  for (const def of seminaryActivities) {
    const hours = routine[def.id] ?? 0;
    if (hours <= 0) continue;
    for (const [p, rate] of Object.entries(def.pillars) as [Pillar, number][]) pillarScores[p] += rate * hours;
    for (const [k, rate] of Object.entries(def.stats) as [StatKey, number][]) stats = applyStat(stats, k, rate * hours);
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
  const next: GameState = {
    ...state,
    npcs,
    flags,
    character: { ...c, stats, reputation, credentials },
    seminary: { ...sem, pillarScores, hoursLogged },
  };
  const head = CLASSES[sem.year] ?? 'Classes';
  const body = phrases.length ? `${head}; ${phrases.join(', ')}.` : `${head}, and the free hours went nowhere in particular.`;
  const line = renderText([body, ...earned].join(' '), next, bindings);
  return { state: next, line };
}
