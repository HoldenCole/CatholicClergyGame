import type { GameState, Letter, Npc, Parish } from '@/types';
import { createRng } from '@/engine/rng';
import { visitPools } from '@/content/see';
import { shortName } from './directions';

/**
 * E4 R1.3 — visits: the canonical visitation of the see's parishes (can.
 * 396, to verify: the whole diocese in five years). The bishop chooses a
 * parish, spends the weekend there, meets its pastor, and finds what the
 * file did not say: the parish's own state read from its record, and, when
 * the visit finds it, the man's private struggle and the trait he hides.
 * The people and the presbyterate move parish by parish; the year reads
 * the cycle back. Rates and dials are invented and flagged.
 */
export const VISITS = {
  /** A visit a fortnight: a weekend away from the cathedral. */
  everyWeeks: 2,
  /** The cycle the canon asks: every parish within five years. */
  cycleWeeks: 260,
  /** The chance a visit finds the man's struggle, and the trait he hides. */
  findStruggle: 0.6,
  findTrait: 0.4,
  /** The dials for a visit, and the pastor's regard for a bishop who came. */
  people: 2,
  presbyterate: 1,
  regard: 6,
  /** The year: half the diocese unvisited in five years costs the people; a cycle completed is noticed by Rome and the people. */
  neglect: { share: 0.5, people: -3 },
  cycle: { people: 5, rome: 2 },
} as const;

function clamp(v: number): number {
  return Math.max(-100, Math.min(100, Math.round(v)));
}

export function pastorOf(state: GameState, parish: Parish): Npc | undefined {
  const n = state.npcs[parish.pastorId];
  return n && n.status === 'active' && n.tags.includes(`pastor:${parish.id}`) ? n : undefined;
}

/** The parishes of the see, the longest unvisited first. */
export function parishesToVisit(state: GameState): { parish: Parish; lastWeek: number | null; due: boolean }[] {
  const see = state.see;
  const world = state.world;
  if (!see || !world || world.diocese.presetId !== see.dioceseId) return [];
  const visits = see.visits ?? {};
  return world.parishes
    .map((parish) => {
      const lastWeek = visits[parish.id] ?? null;
      return { parish, lastWeek, due: lastWeek === null || state.clock.week - lastWeek >= VISITS.cycleWeeks };
    })
    .sort((a, b) => (a.lastWeek ?? -1e9) - (b.lastWeek ?? -1e9) || a.parish.name.localeCompare(b.parish.name));
}

/** The cycle: parishes visited within five years, of all. */
export function cycleProgress(state: GameState): { visited: number; total: number } {
  const list = parishesToVisit(state);
  return { visited: list.filter((x) => !x.due).length, total: list.length };
}

export function visitAvailable(state: GameState, parishId: string): { ok: boolean; why: string | null } {
  const see = state.see;
  if (!see || !state.world?.parishes.some((p) => p.id === parishId)) return { ok: false, why: 'Not a parish of the see.' };
  if (state.mode.kind !== 'clock') return { ok: false, why: 'Not now.' };
  if (see.lastVisitWeek !== undefined && state.clock.week - see.lastVisitWeek < VISITS.everyWeeks) return { ok: false, why: 'A visit a fortnight.' };
  const last = see.visits?.[parishId];
  if (last !== undefined && state.clock.week - last < 52) return { ok: false, why: 'Visited this year.' };
  return { ok: true, why: null };
}

function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(parish|pastor|town)\}/g, (_, k: string) => tokens[k] ?? `{${k}}`);
}

/** The visit: the weekend, what it finds, the dials, the pastor's regard, the record, and the letter. */
export function visitParish(state: GameState, parishId: string): { state: GameState; letter: Letter } | null {
  const see = state.see;
  const parish = state.world?.parishes.find((p) => p.id === parishId);
  if (!see || !parish || !visitAvailable(state, parishId).ok) return null;
  const week = state.clock.week;
  const rng = createRng(`${state.seed}:visit:${parishId}:${week}`);
  const pastor = pastorOf(state, parish);
  const tokens: Record<string, string> = { parish: parish.name, town: parish.place, ...(pastor ? { pastor: shortName(pastor) } : { pastor: 'the administrator' }) };
  const pick = (pool: string[] | undefined): string | null => (pool && pool.length ? fill(rng.pick(pool), tokens) : null);
  const body: string[] = [];
  const again = see.visits?.[parishId] !== undefined;
  body.push(pick(visitPools.kind[parish.kind]) ?? `${parish.name}, ${parish.place}.`);
  const school = pick(visitPools.school[parish.school]);
  if (school) body.push(school);
  const debt = parish.debt <= 0 ? 'none' : parish.debt < 500_000 ? 'some' : 'heavy';
  body.push(pick(visitPools.debt[debt])!);
  const gen = pick(visitPools.generational[parish.generational]);
  if (gen) body.push(gen);
  let npcs = state.npcs;
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('visit:')) delete flags[k];
  flags['visit:parish'] = parishId;
  flags[`visit:kind:${parish.kind}`] = true;
  if (parish.school === 'at_risk' || parish.school === 'closing') flags['visit:school'] = true;
  if (debt === 'heavy') flags['visit:debt'] = true;
  if (parish.households < 250) flags['visit:mission'] = true;
  let presbyterate = VISITS.presbyterate;
  if (pastor) {
    flags['visit:pastor'] = pastor.id;
    let man = { ...pastor, relationship: clamp(pastor.relationship + VISITS.regard) };
    if (pastor.struggle !== 'none' && !state.flags[`known:${pastor.id}`] && rng.chance(VISITS.findStruggle)) {
      const line = pick(visitPools.struggle[pastor.struggle]);
      if (line) body.push(line);
      flags[`known:${pastor.id}`] = true;
      flags['visit:found_struggle'] = true;
      presbyterate -= 1;
    } else if (state.flags[`known:${pastor.id}`] && pastor.struggle !== 'none') {
      flags['visit:found_struggle'] = true;
    }
    if (!pastor.traitKnown && rng.chance(VISITS.findTrait)) {
      const line = pick(visitPools.trait[pastor.hiddenTrait]);
      if (line) body.push(line);
      man = { ...man, traitKnown: true };
    }
    npcs = { ...npcs, [pastor.id]: man };
  } else {
    body.push(pick(visitPools.vacant)!);
    flags['visit:vacant'] = true;
  }
  if (again) body.push(pick(visitPools.again)!);
  const nextSee = {
    ...see,
    people: clamp(see.people + VISITS.people),
    presbyterate: clamp(see.presbyterate + presbyterate),
    visits: { ...(see.visits ?? {}), [parishId]: week },
    lastVisitWeek: week,
  };
  const next: GameState = {
    ...state,
    npcs,
    flags,
    see: nextSee,
    career: [...state.career, { week, kind: 'note', text: `Visited ${parish.name}, ${parish.place}${flags['visit:found_struggle'] && pastor && !state.flags[`known:${pastor.id}`] ? `; learned what the file did not say about ${shortName(pastor)}` : ''}.` }],
  };
  return { state: next, letter: { sort: 'bishop', title: `The visitation of ${parish.name}`, body, week } };
}

/** The year: the cycle read back; neglect costs the people; a cycle completed is noticed. */
export function visitationYear(state: GameState): { state: GameState; line: string | null } {
  const see = state.see;
  const world = state.world;
  if (!see || !world || world.diocese.presetId !== see.dioceseId || !world.parishes.length) return { state, line: null };
  const { visited, total } = cycleProgress(state);
  let next = see;
  let line: string | null = null;
  if (visited === total && see.visits && Object.keys(see.visits).length > 0) {
    // Every parish within the cycle: counted once for this set of visits; the next cycle begins when the oldest visit is made again.
    const oldest = Math.min(...Object.values(see.visits));
    if (!state.flags[`bp_cycle_at:${oldest}`]) {
      const done = (see.cyclesDone ?? 0) + 1;
      next = { ...next, people: clamp(next.people + VISITS.cycle.people), rome: clamp(next.rome + VISITS.cycle.rome), cyclesDone: done };
      line = 'Every parish of the diocese has seen its bishop within the five years the canon asks. The nuncio\'s office notices such things.';
      return { state: { ...state, see: next, flags: { ...state.flags, [`bp_cycle_at:${oldest}`]: true } }, line };
    }
  }
  const years = Math.round((state.clock.week - see.installedWeek) / 52);
  if (years >= 5 && total - visited > total * VISITS.neglect.share) {
    next = { ...next, people: clamp(next.people + VISITS.neglect.people) };
    line = `${total - visited} of ${total} parishes have not seen their bishop in five years, and say so.`;
  }
  return { state: { ...state, see: next }, line };
}

/** {visit_parish}, {visit_pastor}: the parish of the last visit and its pastor. */
export function visitTokens(state: GameState): Record<string, string> {
  const pid = state.flags['visit:parish'];
  const parish = typeof pid === 'string' ? state.world?.parishes.find((p) => p.id === pid) : undefined;
  if (!parish) return {};
  const pastor = pastorOf(state, parish);
  return { visit_parish: parish.name, visit_town: parish.place, visit_pastor: pastor ? shortName(pastor) : 'the administrator' };
}
