import type { GameState, MetropoliaSee, Npc, World } from '@/types';
import type { Rng } from '@/engine/rng';
import { createRng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { generateMetropolia, generateSeeBishop } from '@/generation/metropolia';
import { SUCCESSION } from './succession';
import { sedeVacante } from './rome/papacy';

/**
 * The province as bishops, ticking. E2 §2.1. Each year every see of the
 * province but the man's own rolls what the home see rolls (retirement at
 * seventy-five, death past seventy, a promotion for an ambitious man under
 * sixty-eight); a see that falls vacant waits for the nuncio's terna
 * (systems/rome/nuncio.ts opens one for a vacant see of the province
 * first) and, when Rome is slow, is filled from Rome's temper after a
 * year. Nothing here touches the home diocese. Tunables invented.
 */
export const METROPOLIA_YEAR = {
  /** Weeks a see waits vacant before Rome names a man without a terna the game watched. */
  romeFillsAfter: 52,
  /** The promotion roll, as the home see's. */
  promotedChance: 0.04,
} as const;

/** The province of the current world, rolled on first sight so older saves and worlds made elsewhere have one. */
export function ensureMetropolia(state: GameState): GameState {
  const world = state.world;
  if (!world || world.metropolia) return state;
  const year = world.generatedYear;
  const rng = createRng(`${state.seed}:metropolia:${world.diocese.presetId}`);
  const { metropolia, npcs } = generateMetropolia(rng, world.diocese, year);
  const added = { ...state.npcs };
  for (const n of npcs) if (!added[n.id]) added[n.id] = n;
  return { ...state, npcs: added, world: { ...world, metropolia } };
}

export function metropoliaSees(state: GameState): MetropoliaSee[] {
  return state.world?.metropolia?.sees ?? [];
}

export function metropoliaSeeById(state: GameState, id: string): MetropoliaSee | undefined {
  return metropoliaSees(state).find((s) => s.id === id);
}

/** The province's vacant sees, the ones a world can be rolled for first. */
export function vacantMetropoliaSees(state: GameState): MetropoliaSee[] {
  return metropoliaSees(state).filter((s) => !s.bishopId && s.vacantSince !== undefined);
}

/** The archbishop of the province, when the man's own see is not the metropolitan one. */
export function metropolitanOf(state: GameState): Npc | undefined {
  const see = metropoliaSees(state).find((s) => s.rank === 'metropolitan');
  return see?.bishopId && see.bishopId !== 'player' ? state.npcs[see.bishopId] : undefined;
}

function setSee(world: World, see: MetropoliaSee): World {
  return { ...world, metropolia: { ...world.metropolia!, sees: world.metropolia!.sees.map((s) => (s.id === see.id ? see : s)) } };
}

/** A see of the province gets its bishop: the man named ('player'), an NPC of the game, or a new man rolled from Rome's temper. */
export function fillMetropoliaSee(state: GameState, seeId: string, who: 'player' | 'new' | string, rng: Rng, name?: { first: string; last: string }): { state: GameState; bishop?: Npc } {
  const world = state.world;
  const see = metropoliaSeeById(state, seeId);
  if (!world || !see) return { state };
  const year = dateOf(state.clock).year;
  const { vacantSince: _v, vacantWhy: _w, ...seated } = see;
  void _v; void _w;
  if (who === 'player') return { state: { ...state, world: setSee(world, { ...seated, bishopId: 'player', installedYear: year }) } };
  let npcs = state.npcs;
  let bishop: Npc;
  if (who === 'new') {
    const gen = generateSeeBishop(rng, see, year, `${see.id}:bishop_${year}`, state.romeTemperament);
    bishop = { ...gen, ...(name ? { name } : {}), birthYear: Math.max(gen.birthYear, year - 68) };
    npcs = { ...npcs, [bishop.id]: bishop };
  } else {
    const n = state.npcs[who];
    if (!n) return { state };
    bishop = { ...n, title: see.rank === 'metropolitan' ? 'Archbishop' : 'Bishop', tags: [...n.tags.filter((t) => !t.startsWith('see:')), 'province_bishop', `see:${see.id}`] };
    npcs = { ...npcs, [bishop.id]: bishop };
  }
  return { state: { ...state, npcs, world: setSee(world, { ...seated, bishopId: bishop.id, installedYear: year }) }, bishop };
}

function bishopName(n: Npc): string {
  return `${n.title} ${n.name.first} ${n.name.last}`;
}

/** The year: the province's bishops age, leave, and are replaced. */
export function metropoliaYear(state0: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const state = ensureMetropolia(state0);
  const world = state.world;
  if (!world?.metropolia) return { state, lines: [] };
  const year = dateOf(state.clock).year;
  const week = state.clock.week;
  const lines: string[] = [];
  let next = state;
  for (const see of world.metropolia.sees) {
    const r = rng.derive(`see:${see.id}`);
    if (!see.bishopId) {
      // Vacant: the nuncio's terna, when the game opened one, fills it; otherwise Rome does after a year.
      const terna = (next.rome?.ternas ?? []).find((t) => t.seeId === see.id && !t.done);
      if (!terna && see.vacantSince !== undefined && week - see.vacantSince >= METROPOLIA_YEAR.romeFillsAfter && !sedeVacante(next)) {
        const filled = fillMetropoliaSee(next, see.id, 'new', r.derive('fill'));
        next = filled.state;
        if (filled.bishop) lines.push(`Rome names ${bishopName(filled.bishop)} to ${see.see}, vacant since ${see.vacantWhy === 'died' ? 'its bishop died' : see.vacantWhy === 'transferred' ? 'its bishop was moved' : 'its bishop retired'}.`);
      }
      continue;
    }
    if (see.bishopId === 'player') continue;
    const bishop = next.npcs[see.bishopId];
    if (!bishop || bishop.status !== 'active') continue;
    const age = year - bishop.birthYear;
    let why: MetropoliaSee['vacantWhy'] | null = null;
    if (age >= SUCCESSION.retirementAge && r.derive('retire').chance(SUCCESSION.acceptancePerYear)) why = 'retired';
    else if (age >= 70 && r.derive('die').chance(SUCCESSION.deathPerYearOver70)) why = 'died';
    else if ((bishop.ambition ?? 0) >= 70 && age < 68 && r.derive('promote').chance(METROPOLIA_YEAR.promotedChance)) why = 'transferred';
    if (!why) continue;
    const gone: Npc = { ...bishop, status: why === 'died' ? 'dead' : 'retired', tags: bishop.tags.filter((t) => t !== 'province_bishop' && !t.startsWith('see:')).concat(why === 'transferred' ? 'archbishop_elsewhere' : 'bishop_emeritus') };
    const { bishopId: _b, ...emptied } = see;
    void _b;
    next = { ...next, npcs: { ...next.npcs, [gone.id]: gone }, world: setSee(next.world!, { ...emptied, vacantSince: week, vacantWhy: why }) };
    lines.push(`${bishopName(bishop)} of ${see.see} has ${why === 'died' ? 'died' : why === 'transferred' ? 'been moved to another see' : 'retired'}, and the see is vacant.`);
  }
  return { state: next, lines };
}

/** A line for the card and the sheets: where the diocese sits. */
export function metropoliaLine(m: { name: string; rank: 'metropolitan' | 'suffragan'; metropolitanSee: string; sees: number }): string {
  return m.rank === 'metropolitan' ? `The metropolitan see of the ${m.name}, ${m.sees - 1} suffragan ${m.sees - 1 === 1 ? 'diocese' : 'dioceses'} under it.` : `A suffragan see of the ${m.name}; the archbishop sits at ${m.metropolitanSee}.`;
}
