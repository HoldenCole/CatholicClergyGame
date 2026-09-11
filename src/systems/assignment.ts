import type { Assignment, GameState, Parish, World } from '@/types';
import type { Rng } from '@/engine/rng';
import { PROBLEM_LABEL } from '@/generation/parishes';

/** Weights for the first assignment. Invented, following DESIGN.md §7.1 and §7.4. */
export const ASSIGNMENT = {
  needProblem: 30,
  needPerShortage: 5,
  terrainMatch: 20,
  terrainMismatch: -10,
  spanishNeeded: 25,
  spanishMissing: -20,
  fixer: 15,
  alignmentPerPoint: -0.2,
  preference: 15,
  trustPerChancery: 0.2,
  noise: 10,
} as const;

const NEEDY_PROBLEMS = new Set(['too_many_masses', 'no_priest_nearby', 'sacramental_backlog', 'mission_churches']);

export interface ParishScore {
  parish: Parish;
  score: number;
  reasons: string[];
}

export function terrainOf(state: GameState): string | null {
  for (const key of Object.keys(state.flags)) if (key.startsWith('home_terrain:') && state.flags[key]) return key.slice('home_terrain:'.length);
  return null;
}

/** Score one parish for the newly ordained man. Fit is amplified by outspokenness (DESIGN §7.1). */
export function scoreParish(state: GameState, world: World, parish: Parish): ParishScore {
  const c = state.character!;
  const reasons: string[] = [];
  let need = 0;
  let fit = 0;
  let trust = 0;

  if (NEEDY_PROBLEMS.has(parish.problem)) {
    need += ASSIGNMENT.needProblem;
    reasons.push(`${parish.name} needed a body: ${PROBLEM_LABEL[parish.problem] ?? parish.problem}`);
  }
  need += world.diocese.hidden.shortage * ASSIGNMENT.needPerShortage * (parish.households / 3000);

  const terrain = terrainOf(state);
  if (terrain && terrain !== 'none') {
    if (terrain === parish.terrain) {
      fit += ASSIGNMENT.terrainMatch;
      reasons.push('It is the kind of place you grew up in');
    } else fit += ASSIGNMENT.terrainMismatch;
  }
  if (parish.needsSpanish) {
    if (state.flags.speaks_spanish) {
      fit += ASSIGNMENT.spanishNeeded;
      reasons.push('Your Spanish');
    } else fit += ASSIGNMENT.spanishMissing;
  }
  if (parish.debt >= 1_000_000 && (c.stats.administration >= 55 || c.credentials.includes('partial_cpa') || c.credentials.includes('partial_jcl'))) {
    fit += ASSIGNMENT.fixer;
    reasons.push('A parish in the red, and a man who can read a ledger');
  }
  fit += Math.abs(parish.alignment - c.alignment) * ASSIGNMENT.alignmentPerPoint;
  if (Math.abs(parish.alignment - c.alignment) <= 20 && c.outspokenness >= 30) reasons.push('Your public positions fit the parish');

  const prefs: [string, boolean][] = [
    ['pref_urban', parish.terrain === 'urban'],
    ['pref_rural', parish.terrain === 'rural'],
    ['pref_latino', parish.terrain === 'latino'],
    ['pref_academic', parish.kind === 'flagship_suburban'],
  ];
  for (const [flag, matches] of prefs) {
    if (state.flags[flag] && matches) {
      fit += ASSIGNMENT.preference;
      reasons.push('You asked for something like it');
    }
  }
  if (state.flags.pref_wherever) trust += 5;
  trust += c.reputation.chancery * ASSIGNMENT.trustPerChancery;

  const fitEffective = fit * (1 + c.outspokenness / 100);
  return { parish, score: need + fitEffective + trust, reasons };
}

/** The bishop decides. DESIGN.md §7.4: mismatch is content, not failure. */
export function assignFirstParish(state: GameState, rng: Rng): Assignment {
  const world = state.world!;
  const scored = world.parishes.map((p) => {
    const s = scoreParish(state, world, p);
    return { ...s, score: s.score + rng.float(-ASSIGNMENT.noise, ASSIGNMENT.noise) };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const pastor = state.npcs[best.parish.pastorId];
  const bishop = state.npcs[world.diocese.hidden.bishop.npcId];
  const c = state.character!;
  const letter =
    `Dear Father ${c.name.last},\n\n` +
    `Having consulted the Personnel Board, I hereby appoint you Parochial Vicar of ${best.parish.name} Parish, ${best.parish.place}, ` +
    `effective the first of the month, under the pastorship of ${pastor ? `${pastor.title} ${pastor.name.first} ${pastor.name.last}` : 'the pastor'}. ` +
    `I am confident that you will bring to this assignment the zeal and generosity you have shown in formation.\n\n` +
    `Assuring you of my prayers, I remain,\n\nSincerely yours in Christ,\n${bishop ? `${bishop.title} ${bishop.name.first} ${bishop.name.last}` : 'The Bishop'}`;
  return {
    parishId: best.parish.id,
    role: 'parochial_vicar',
    startWeek: state.clock.week,
    letter,
    reasons: best.reasons.length ? best.reasons : ['Someone had to go there, and the list was short'],
  };
}

/** The five things a man can ask the chancery for. DESIGN §7.4: he submits preferences; the bishop decides. */
export type Preference = 'urban' | 'rural' | 'latino' | 'academic' | 'wherever';
export const PREFERENCES: readonly Preference[] = ['urban', 'rural', 'latino', 'academic', 'wherever'] as const;
export const PREFERENCE_LABEL: Record<Preference, { label: string; blurb: string }> = {
  urban: { label: 'A city parish', blurb: 'Old stone, old families, the neighborhood that was a nation once.' },
  rural: { label: 'A country parish', blurb: 'Two churches forty miles apart and a truck.' },
  latino: { label: 'A Spanish-speaking parish', blurb: 'Where the diocese is growing and the pews are full at noon.' },
  academic: { label: 'Somewhere with a school and a library', blurb: 'The flagship, the university parish, the place with a lecture series.' },
  wherever: { label: 'Wherever the bishop needs me', blurb: 'The answer they hope for. It is remembered, and it is used.' },
};

export function currentPreference(state: GameState): Preference | null {
  for (const p of PREFERENCES) if (state.flags[`pref_${p}`]) return p;
  return null;
}

/** Set one preference and clear the others; a man asks for one thing. */
export function setPreference(state: GameState, pref: Preference): GameState {
  const flags = { ...state.flags };
  for (const p of PREFERENCES) delete flags[`pref_${p}`];
  flags[`pref_${pref}`] = true;
  return { ...state, flags, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Told the chancery: ${PREFERENCE_LABEL[pref].label.toLowerCase()}.` }] };
}
