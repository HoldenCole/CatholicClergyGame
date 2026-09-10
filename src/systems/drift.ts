import type { GameState, Npc, World } from '@/types';
import type { Rng } from '@/engine/rng';
import { generateBishop, temperamentLine } from '@/generation/bishop';
import { clergyNeedOf } from '@/generation/diocese';
import { presetById } from '@/content/dioceses';

/** Tunables. Invented to match DESIGN.md §3.1a: modest drift, one run in four sees a new bishop during seminary. */
export const DRIFT = {
  dispositionStep: 6,
  shortageStepChance: 0.3,
  financialStepChance: 0.15,
  /** Base chance per year; with retirements past 75 the six-year total lands near 0.25. */
  bishopChangePerYear: 0.02,
  /** A bishop past this age is at least as likely to go as any other cause. */
  retirementAge: 75,
} as const;

export interface DriftResult {
  state: GameState;
  newBishop: Npc | null;
}

/** Refresh the visible bishop line from the hidden profile and the calendar. */
export function refreshVisible(world: World, npcs: Record<string, Npc>, year: number): World {
  const bishop = npcs[world.diocese.hidden.bishop.npcId];
  if (!bishop) return world;
  return {
    ...world,
    diocese: {
      ...world.diocese,
      visible: {
        ...world.diocese.visible,
        clergyNeed: clergyNeedOf(world.diocese.hidden.shortage),
        bishop: {
          ...world.diocese.visible.bishop,
          age: year - bishop.birthYear,
          yearsInOffice: year - world.diocese.hidden.bishop.installedYear,
        },
      },
    },
  };
}

/**
 * One year of drift between the preview and ordination (and after). The
 * player cannot pick his superior, only his gamble.
 */
export function driftYear(state: GameState, rng: Rng, year: number): DriftResult {
  const world = state.world;
  if (!world) return { state, newBishop: null };
  const preset = presetById(world.diocese.presetId);
  const hidden = { ...world.diocese.hidden };
  const visible = { ...world.diocese.visible };

  visible.disposition = Math.max(-100, Math.min(100, visible.disposition + rng.int(-DRIFT.dispositionStep, DRIFT.dispositionStep)));
  if (rng.chance(DRIFT.shortageStepChance)) hidden.shortage = Math.max(1, Math.min(5, hidden.shortage + (rng.chance(0.6) ? 1 : -1)));
  if (rng.chance(DRIFT.financialStepChance)) {
    const order = ['healthy', 'strained', 'crisis'] as const;
    const i = order.indexOf(hidden.financial);
    hidden.financial = order[Math.max(0, Math.min(2, i + (rng.chance(0.5) ? 1 : -1)))]!;
  }

  let npcs = state.npcs;
  let newBishop: Npc | null = null;
  const current = npcs[hidden.bishop.npcId];
  const aged = current ? year - current.birthYear >= DRIFT.retirementAge : false;
  if (preset && current && (rng.chance(DRIFT.bishopChangePerYear) || (aged && rng.chance(0.3)))) {
    const successor = generateBishop(rng.derive(`bishop:${year}`), preset, year, `bishop_${year}`);
    successor.profile.installedYear = year;
    npcs = {
      ...npcs,
      [current.id]: { ...current, status: 'retired', tags: current.tags.filter((t) => t !== 'bishop').concat('bishop_emeritus') },
      [successor.npc.id]: successor.npc,
    };
    hidden.bishop = successor.profile;
    visible.bishop = {
      npcId: successor.npc.id,
      name: `${successor.npc.title} ${successor.npc.name.first} ${successor.npc.name.last}`,
      age: year - successor.npc.birthYear,
      yearsInOffice: 0,
      temperamentLine: temperamentLine(rng, successor.profile),
      priorities: successor.profile.priorities,
    };
    newBishop = successor.npc;
  }

  const nextWorld = refreshVisible(
    { ...world, diocese: { ...world.diocese, visible, hidden }, bishopHistory: newBishop ? [...world.bishopHistory, newBishop.id] : world.bishopHistory },
    npcs,
    year,
  );
  return { state: { ...state, world: nextWorld, npcs }, newBishop };
}
