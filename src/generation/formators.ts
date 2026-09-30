import type { Npc, Origin } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

const CLERGY_ORIGINS: Origin[] = ['urban_ethnic', 'rural', 'suburban', 'latino_immigrant', 'convert', 'lapsed'];

interface FormatorSpec {
  id: string;
  tag: string;
  role: Npc['role'];
  ageRange: [number, number];
  title: (rng: Rng) => string;
  alignment: (rng: Rng) => number;
  stats: Partial<Record<keyof Npc['stats'], number>>;
  relationship?: [number, number];
}

const SPECS: FormatorSpec[] = [
  {
    id: 'rector',
    tag: 'rector',
    role: 'formator',
    ageRange: [52, 66],
    title: (rng) => (rng.chance(0.6) ? 'Msgr.' : 'Fr.'),
    alignment: (rng) => rollAlignment(rng, 0, 30),
    stats: { administration: 25, theology: 15, charisma: 10 },
  },
  {
    id: 'vice_rector',
    tag: 'vice_rector',
    role: 'formator',
    ageRange: [38, 56],
    title: () => 'Fr.',
    alignment: (rng) => rollAlignment(rng, 0, 30),
    stats: { administration: 22, piety: 10, charisma: 6 },
  },
  {
    id: 'spiritual_director',
    tag: 'spiritual_director',
    role: 'formator',
    ageRange: [48, 74],
    title: () => 'Fr.',
    alignment: (rng) => rollAlignment(rng, 0, 30),
    stats: { piety: 30, charisma: 8, theology: 8 },
    relationship: [5, 20],
  },
  {
    id: 'formation_advisor',
    tag: 'formation_advisor',
    role: 'formator',
    ageRange: [38, 58],
    title: () => 'Fr.',
    alignment: (rng) => rollAlignment(rng, 0, 30),
    stats: { theology: 12, administration: 10, piety: 8 },
  },
  {
    id: 'vocation_director',
    tag: 'vocation_director',
    role: 'official',
    ageRange: [36, 52],
    title: () => 'Fr.',
    alignment: (rng) => rollAlignment(rng, 0, 30),
    stats: { charisma: 20, administration: 10 },
    relationship: [5, 25],
  },
  {
    id: 'professor_trad',
    tag: 'professor_trad',
    role: 'formator',
    ageRange: [40, 68],
    title: (rng) => (rng.chance(0.7) ? 'Fr.' : 'Dr.'),
    alignment: (rng) => -rng.int(40, 85),
    stats: { theology: 30, knowledge: 20 },
  },
  {
    id: 'professor_prog',
    tag: 'professor_prog',
    role: 'formator',
    ageRange: [40, 68],
    title: (rng) => (rng.chance(0.7) ? 'Fr.' : 'Dr.'),
    alignment: (rng) => rng.int(40, 85),
    stats: { theology: 25, knowledge: 25 },
  },
  {
    id: 'bishop',
    tag: 'bishop',
    role: 'bishop',
    ageRange: [55, 72],
    title: () => 'Bishop',
    alignment: (rng) => rollAlignment(rng, 0, 35),
    stats: { administration: 25, charisma: 15, theology: 10 },
  },
];

/**
 * How a rector runs his house, and what his vice-rector is for. Rolled apart
 * from everything else about the man: a warm rector may be a disciplinarian,
 * a cold one pastoral. The seminary writes these as flags (rector:<style>,
 * vice_rector:<temper>) for the house scenes to read.
 */
export const RECTOR_STYLES = ['pastoral', 'academic', 'disciplinarian'] as const;
export const VICE_RECTOR_TEMPERS = ['enforcer', 'confidant'] as const;
export type RectorStyle = (typeof RECTOR_STYLES)[number];
export type ViceRectorTemper = (typeof VICE_RECTOR_TEMPERS)[number];

/**
 * The seminary faculty and the diocese's nearest officials. The bishop made
 * here is a placeholder that Phase 2's diocese generator replaces.
 */
export function generateFormators(rng: Rng, entryYear: number, options: { includeBishop?: boolean } = {}): Npc[] {
  const specs = options.includeBishop === false ? SPECS.filter((s) => s.id !== 'bishop') : SPECS;
  const house = rng.derive('house');
  const style: RectorStyle = house.pick([...RECTOR_STYLES]);
  const temper: ViceRectorTemper = house.pick([...VICE_RECTOR_TEMPERS]);
  const styleTag = (id: string): string[] => (id === 'rector' ? [`rector:${style}`] : id === 'vice_rector' ? [`vice_rector:${temper}`] : []);
  return specs.map((spec) => {
    const age = rng.int(spec.ageRange[0], spec.ageRange[1]);
    const birthYear = entryYear - age;
    const heritage = rollHeritage(rng, CLERGY_HERITAGE);
    const stats = addStats(rollBaseStats(rng, 30, 55), spec.stats);
    return finishNpc(rng, {
      id: spec.id,
      name: rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
      role: spec.role,
      title: spec.title(rng),
      birthYear,
      origin: rng.pick(CLERGY_ORIGINS),
      stats,
      tags: [spec.tag, ...styleTag(spec.id)],
      alignment: spec.alignment(rng),
      relationship: spec.relationship ? rng.int(spec.relationship[0], spec.relationship[1]) : Math.round(rng.gaussian() * 5),
    });
  });
}
