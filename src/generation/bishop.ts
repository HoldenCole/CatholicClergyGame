import type { BishopFault, BishopPriority, BishopProfile, BishopTrait, DiocesePreset, ManagementStyle, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

const PRIORITIES: BishopPriority[] = ['finances', 'vocations', 'education', 'social_outreach', 'liturgy', 'evangelization'];
const MANAGEMENT: ManagementStyle[] = ['delegator', 'micromanager', 'absentee', 'reformer'];
const TRAITS: BishopTrait[] = ['loyalty', 'competence', 'visibility', 'discretion', 'orthodoxy', 'pastoral_warmth', 'initiative', 'deference'];
const FAULTS: BishopFault[] = ['disloyalty', 'sloppiness', 'showboating', 'secretiveness', 'heterodoxy', 'coldness', 'freelancing', 'timidity'];

/**
 * Faults a given reward may not pair with: its own shadow (redundant) and
 * the fault that would contradict it (a man who rewards visibility does not
 * punish showboating; one who rewards initiative does not punish freelancing).
 */
const EXCLUDED_FAULTS: Record<BishopTrait, BishopFault[]> = {
  loyalty: ['disloyalty'],
  competence: ['sloppiness'],
  visibility: ['showboating', 'timidity'],
  discretion: ['secretiveness', 'showboating'],
  orthodoxy: ['heterodoxy'],
  pastoral_warmth: ['coldness'],
  initiative: ['freelancing', 'timidity'],
  deference: ['timidity', 'freelancing'],
};

export interface GeneratedBishop {
  npc: Npc;
  profile: BishopProfile;
}

/**
 * The diocesan bishop, rolled per run. DESIGN.md §9.1. `year` is the calendar
 * year of generation; `dispositionBias` tilts alignment toward the preset's
 * culture without fixing it.
 */
export function generateBishop(rng: Rng, preset: DiocesePreset, year: number, id = 'bishop'): GeneratedBishop {
  const age = rng.int(52, 74);
  const birthYear = year - age;
  const yearsInOffice = Math.min(age - 45, rng.int(1, 14));
  const heritage = rollHeritage(rng, { ...CLERGY_HERITAGE, ...scaleHeritage(preset.heritage, 0.5) });
  const alignment = rollAlignment(rng, preset.dispositionBias * 0.5, 35);
  const priorities = rng.shuffle(PRIORITIES).slice(0, 2) as [BishopPriority, BishopPriority];
  const rewards = rng.pick(TRAITS);
  const cannotTolerate = rng.pick(FAULTS.filter((f) => !EXCLUDED_FAULTS[rewards].includes(f)));
  const npc = finishNpc(rng, {
    id,
    name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
    role: 'bishop',
    title: 'Bishop',
    birthYear,
    origin: rng.pick(['urban_ethnic', 'rural', 'suburban', 'latino_immigrant', 'convert', 'lapsed'] as const),
    stats: addStats(rollBaseStats(rng, 35, 60), { administration: 20, charisma: 10, theology: 8 }),
    tags: ['bishop'],
    alignment,
    ambition: rng.int(5, 95),
    relationship: 0,
  });
  const profile: BishopProfile = {
    npcId: id,
    alignment,
    outspokenness: rng.int(5, 80),
    priorities,
    management: rng.pick(MANAGEMENT),
    rewards,
    cannotTolerate,
    ambition: npc.ambition,
    knowsYou: 'none',
    installedYear: year - yearsInOffice,
  };
  return { npc, profile };
}

function scaleHeritage(weights: Record<string, number>, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v * factor]));
}

const TEMPERAMENT_LINES: Record<ManagementStyle, string[]> = {
  delegator: [
    'Runs the diocese through his vicars and expects them to run it well.',
    'Gives a man a job and does not ask about it again until it goes wrong.',
  ],
  micromanager: [
    'Reads the parish bulletins. All of them.',
    'Signs everything himself and wants to know why the lights were left on.',
  ],
  absentee: [
    'Travels a great deal and is warm on the rare occasions he is home.',
    'A gentle man who is seldom in the building and seldom missed by those who prefer it that way.',
  ],
  reformer: [
    'Came with a plan and has not stopped talking about it.',
    'Restless, impatient with the way things have been done, and not yet unpopular for it.',
  ],
};

/** The one line the preview is allowed to say about him. Reveals management style, not temperament. */
export function temperamentLine(rng: Rng, profile: BishopProfile): string {
  return rng.pick(TEMPERAMENT_LINES[profile.management]);
}

export const PRIORITY_LABEL: Record<BishopPriority, string> = {
  finances: 'the finances',
  vocations: 'vocations',
  education: 'the schools',
  social_outreach: 'social outreach',
  liturgy: 'the liturgy',
  evangelization: 'evangelization',
};
