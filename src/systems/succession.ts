import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { generateBishop, temperamentLine } from '@/generation/bishop';
import { presetById } from '@/content/dioceses';
import { clampSigned } from './reputation';

/** Invented. DESIGN 5.3 and 9.3. */
export const SUCCESSION = {
  retirementAge: 75,
  /** Chance per year past 75 that Rome accepts the letter. */
  acceptancePerYear: 0.35,
  deathPerYearOver70: 0.025,
  /** Rome's temperament drifts a little each year and swings with a conclave now and then. */
  romeDriftStep: 5,
  conclavePerYear: 0.07,
  /** How much of chancery standing survives a succession before revaluation. */
  chanceryCarry: 0.5,
} as const;

export interface SuccessionResult {
  state: GameState;
  newBishop: Npc | null;
  /** Prose for the digest and the career record. */
  lines: string[];
}

function calendarYear(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/** Rome's temperament: a drifting number the successor rolls around. */
export function driftRome(state: GameState, rng: Rng): GameState {
  let t = state.romeTemperament + rng.int(-SUCCESSION.romeDriftStep, SUCCESSION.romeDriftStep);
  if (rng.chance(SUCCESSION.conclavePerYear)) t = Math.round(rng.gaussian() * 40);
  return { ...state, romeTemperament: clampSigned(t) };
}

/**
 * Every chancery relationship is revalued and every public statement
 * re-read against a new standard. The loud man who was the last bishop's
 * favorite becomes the new bishop's problem; the exile is called back.
 */
export function revalue(state: GameState, successor: Npc): { state: GameState; verdict: string } {
  const c = state.character;
  if (!c) return { state, verdict: '' };
  const publicPositions = c.positions.filter((p) => p.volume === 'public' || p.volume === 'semi_public');
  const gap = Math.abs(successor.alignment - c.alignment);
  const affinity = (30 - gap) / 2; // −35 .. +15
  let reread = 0;
  for (const p of publicPositions) {
    const agrees = Math.sign(p.value) === Math.sign(successor.alignment) || successor.alignment === 0;
    reread += (agrees ? 1 : -1) * (p.volume === 'public' ? 2 : 1);
  }
  const swing = (affinity + reread) * (1 + c.outspokenness / 100);
  const chancery = clampSigned(c.reputation.chancery * SUCCESSION.chanceryCarry + swing);
  const relationship = Math.round(clampSigned(swing));
  const verdict =
    swing >= 15 ? 'The new bishop has heard of you, and approves.' :
    swing <= -15 ? 'The new bishop has heard of you. That is the problem.' :
    c.outspokenness >= 40 ? 'The new bishop has read your file and formed no opinion yet, which for a man on the record is a mercy.' :
    'The new bishop does not know you, which is neither good nor bad.';
  return {
    state: {
      ...state,
      character: { ...c, reputation: { ...c.reputation, chancery } },
      npcs: { ...state.npcs, [successor.id]: { ...successor, relationship } },
    },
    verdict,
  };
}

/** Roll whether the see changes hands this year, and if so install the successor and revalue. */
export function successionYear(state: GameState, rng: Rng): SuccessionResult {
  const world = state.world;
  if (!world) return { state, newBishop: null, lines: [] };
  const year = calendarYear(state);
  const current = state.npcs[world.diocese.hidden.bishop.npcId];
  if (!current) return { state, newBishop: null, lines: [] };
  const age = year - current.birthYear;
  let why: 'retired' | 'died' | 'promoted' | null = null;
  if (age >= SUCCESSION.retirementAge && rng.chance(SUCCESSION.acceptancePerYear)) why = 'retired';
  else if (age >= 70 && rng.chance(SUCCESSION.deathPerYearOver70)) why = 'died';
  else if (world.diocese.hidden.bishop.ambition >= 70 && age < 68 && rng.chance(0.04)) why = 'promoted';
  if (!why) return { state, newBishop: null, lines: [] };

  const preset = presetById(world.diocese.presetId);
  if (!preset) return { state, newBishop: null, lines: [] };
  const seeded = generateBishop(rng.derive(`successor:${year}`), { ...preset, dispositionBias: state.romeTemperament * 0.6 + (world.diocese.hidden.financial === 'crisis' ? 0 : preset.dispositionBias * 0.3) }, year, `bishop_${year}`);
  successor: {
    // A diocese in crisis gets a fixer; a scandal gets an outsider. DESIGN 9.3
    if (world.diocese.hidden.financial === 'crisis') seeded.npc.stats.administration = Math.min(100, seeded.npc.stats.administration + 15);
    if (world.diocese.hidden.scandal.latent >= 60) seeded.npc.origin = 'suburban';
    break successor;
  }
  seeded.profile.installedYear = year;
  const npcs = {
    ...state.npcs,
    [current.id]: { ...current, status: why === 'died' ? ('dead' as const) : ('retired' as const), tags: current.tags.filter((t) => t !== 'bishop').concat(why === 'promoted' ? 'archbishop_elsewhere' : 'bishop_emeritus') },
    [seeded.npc.id]: seeded.npc,
  };
  const diocese = {
    ...world.diocese,
    hidden: { ...world.diocese.hidden, bishop: seeded.profile },
    visible: {
      ...world.diocese.visible,
      bishop: {
        npcId: seeded.npc.id,
        name: `${seeded.npc.title} ${seeded.npc.name.first} ${seeded.npc.name.last}`,
        age: year - seeded.npc.birthYear,
        yearsInOffice: 0,
        temperamentLine: temperamentLine(rng, seeded.profile),
        priorities: seeded.profile.priorities,
      },
    },
  };
  const withNew: GameState = { ...state, npcs, world: { ...world, diocese, bishopHistory: [...world.bishopHistory, seeded.npc.id] } };
  const { state: revalued, verdict } = revalue(withNew, seeded.npc);
  const lines = [
    `${current.title} ${current.name.last} has ${why === 'promoted' ? 'been named to a larger see' : why}. Rome has named ${seeded.npc.title} ${seeded.npc.name.first} ${seeded.npc.name.last} to ${world.diocese.visible.see}.`,
    verdict,
  ];
  return { state: { ...revalued, flags: { ...revalued.flags, successions: Number(revalued.flags.successions ?? 0) + 1, [`succession:${year}`]: true } }, newBishop: seeded.npc, lines };
}
