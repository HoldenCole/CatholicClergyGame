import type { GameState, StatKey, StudyActivityDef, StudyState } from '@/types';
import type { Rng } from '@/engine/rng';
import { studyActivities, studyActivity, studyProgram } from '@/content/study';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { resolveSelector } from '@/engine/selectors';
import { renderText } from '@/engine/text';
import { applyStat } from './stats';
import { applyReputation } from './reputation';
import { applySeeHours } from '@/engine/see';
import { describeUnmet } from './doors';
import { freeHourShift } from './workweek';
import { strainAfterWeek, strainOf, WEEK } from './week';

/** Free hours a week away: lectures, the chapel, and the house rule take the rest. */
export function studyBudget(state: GameState): number {
  const base = studyProgram(state.study?.program ?? '')?.hours ?? 6;
  const sick = strainOf(state) >= WEEK.strainSick ? 1 : 0;
  return Math.max(1, base + freeHourShift(state) - sick);
}

export function studyHours(study: StudyState): number {
  return Object.values(study.routine).reduce((a, b) => a + b, 0);
}

export interface StudyActivityAvailability {
  def: StudyActivityDef;
  available: boolean;
  /** What is in the way, in words. */
  why: string | null;
}

/** Every activity of the city, and whether the man may take it. */
export function studyActivitiesFor(state: GameState): StudyActivityAvailability[] {
  const city = state.study?.city;
  return studyActivities
    .filter((a) => !a.city || (Array.isArray(a.city) ? a.city.includes(city!) : a.city === city))
    .map((def) => {
      if (!def.requires || evaluateAll(def.requires, state)) return { def, available: true, why: null };
      const why = def.requires.map((c) => describeUnmet(c, state)).find((w): w is string => !!w) ?? 'not yet';
      return { def, available: false, why };
    });
}

/** Give an activity so many hours a week; clamped to its maximum, to what is left, and to what he qualifies for. */
export function setStudyActivity(state: GameState, id: string, ap: number): GameState {
  const study = state.study;
  const def = studyActivity(id);
  if (!study || !def) throw new Error(`no such activity ${id}`);
  const availability = studyActivitiesFor(state).find((a) => a.def.id === id);
  if (availability && !availability.available && ap > (study.routine[id] ?? 0)) throw new Error(availability.why ?? 'not yet');
  const routine = { ...study.routine };
  const others = studyHours(study) - (routine[id] ?? 0);
  const next = Math.max(0, Math.min(def.maxAp, Math.floor(ap), studyBudget(state) - others));
  if (next === 0) delete routine[id];
  else routine[id] = next;
  return { ...state, study: { ...study, routine } };
}

/** One week away: the hours build what they build, and the digest says what he did. */
export function studyWeek(state: GameState, rng: Rng): { state: GameState; line: string } {
  const study = state.study;
  const c = state.character;
  if (!study || !c) return { state, line: '' };
  let stats = c.stats;
  let reputation = c.reputation;
  let credentials = c.credentials;
  const hoursLogged = { ...study.hoursLogged };
  const taken = [...study.taken];
  const npcs = { ...state.npcs };
  const flags = { ...state.flags };
  const phrases: string[] = [];
  const earned: string[] = [];
  let next: GameState = state;
  let see = state.see ?? null;
  const bindings: Record<string, string> = {};
  for (const def of studyActivities) {
    const hours = study.routine[def.id] ?? 0;
    if (hours <= 0) continue;
    if (def.see && see) see = applySeeHours(see, def.see, hours);
    for (const [k, rate] of Object.entries(def.stats) as [StatKey, number][]) stats = applyStat(stats, k, rate * hours);
    for (const r of def.reputation ?? []) reputation = applyReputation(reputation, r.key, r.delta * hours);
    for (const r of def.relationships ?? []) {
      const npc = resolveSelector({ ...state, npcs }, r.selector, rng.derive(`${def.id}:${state.clock.week}`));
      if (!npc) continue;
      npcs[npc.id] = { ...npc, relationship: Math.max(-100, Math.min(100, npc.relationship + r.delta * hours)) };
      bindings[r.selector] = npc.id;
    }
    hoursLogged[def.id] = (hoursLogged[def.id] ?? 0) + hours;
    if (def.credentialAfter) {
      const before = hoursLogged[def.id]! - hours;
      const need = def.credentialAfter.hours;
      if (before < need && hoursLogged[def.id]! >= need && !credentials.includes(def.credentialAfter.credential)) {
        credentials = [...credentials, def.credentialAfter.credential];
        if (def.credentialAfter.flag) flags[def.credentialAfter.flag] = true;
        earned.push(def.credentialAfter.line);
      }
    }
    if (def.onFirst && !taken.includes(def.id)) {
      taken.push(def.id);
      next = applyEffects(next, def.onFirst);
    } else if (!taken.includes(def.id)) taken.push(def.id);
    const phrase = def.digest[(state.clock.week + def.digest.length) % def.digest.length]!;
    phrases.push(hours > 1 ? `${phrase} (${hours} hours)` : phrase);
  }
  // onFirst effects are flags and traits (never stats or reputation), so the tallies above can go on top of them.
  const strain = strainAfterWeek(state, 0, Math.max(0, freeHourShift(state)));
  if (strain >= WEEK.strainWorn) stats = applyStat(stats, 'piety', -WEEK.strainPietyDrain);
  const character = { ...next.character!, stats, reputation, credentials };
  const result: GameState = { ...next, ...(see ? { see } : {}), strain, npcs: { ...next.npcs, ...npcs }, flags: { ...next.flags, ...flags }, character, study: { ...study, hoursLogged, taken } };
  const head = studyProgram(study.program)?.classes ?? 'Lectures';
  const body = phrases.length ? `${head}; ${phrases.join(', ')}.` : `${head}, and the free hours went to the city.`;
  return { state: result, line: renderText([body, ...earned].join(' '), result, bindings) };
}

/** What an activity builds, in words. */
const STAT_WORD: Record<StatKey, string> = { piety: 'piety', theology: 'theology', knowledge: 'learning', charisma: 'presence', administration: 'order' };
const REP_WORD: Record<string, string> = { parishioners: 'the people', chancery: 'the chancery', brother_priests: 'brother priests', public: 'the town', rome: 'Rome' };
export function studyActivityBuilds(def: StudyActivityDef): string {
  const words = (Object.keys(def.stats) as StatKey[]).sort((a, b) => (def.stats[b] ?? 0) - (def.stats[a] ?? 0)).map((k) => STAT_WORD[k]);
  for (const r of def.reputation ?? []) words.push(REP_WORD[r.key] ?? r.key);
  return words.join(', ');
}

