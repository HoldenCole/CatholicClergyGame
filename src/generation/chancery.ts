import type { ChanceryOffice, DiocesePreset, Npc } from '@/types';
import { CHANCERY_OFFICES } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

const OFFICE_STATS: Record<ChanceryOffice, Partial<Record<'administration' | 'charisma' | 'theology' | 'knowledge' | 'piety', number>>> = {
  vicar_general: { administration: 25, charisma: 10 },
  chancellor: { administration: 20, knowledge: 15 },
  vicar_for_clergy: { charisma: 10, administration: 10, piety: 5 },
  judicial_vicar: { knowledge: 25, theology: 10 },
  finance_officer: { administration: 30 },
  vocations_director: { charisma: 20 },
  superintendent_of_schools: { administration: 15, knowledge: 10 },
  communications_director: { charisma: 15, knowledge: 15 },
  bishop_secretary: { administration: 10, piety: 5 },
};

const OFFICE_TITLE: Record<ChanceryOffice, string> = {
  vicar_general: 'Msgr.',
  chancellor: 'Msgr.',
  vicar_for_clergy: 'Fr.',
  judicial_vicar: 'Fr.',
  finance_officer: 'Mr.',
  vocations_director: 'Fr.',
  superintendent_of_schools: 'Dr.',
  communications_director: 'Ms.',
  bishop_secretary: 'Fr.',
};

/** Which offices are usually held by laypeople. */
const LAY: ChanceryOffice[] = ['finance_officer', 'superintendent_of_schools', 'communications_director'];

/**
 * Six to eight named officials with alignments and ambitions. DESIGN.md §9.1.
 * The chancery's own alignment mix is rolled around the bishop's, so a
 * chancery can be more or less his than the diocese.
 */
export function generateChancery(rng: Rng, preset: DiocesePreset, year: number, bishopAlignment: number): Npc[] {
  const count = rng.int(6, 8);
  const offices = ['vicar_general', 'chancellor', 'vicar_for_clergy', ...rng.shuffle(CHANCERY_OFFICES.filter((o) => !['vicar_general', 'chancellor', 'vicar_for_clergy'].includes(o)))].slice(0, count) as ChanceryOffice[];
  return offices.map((office) => {
    const lay = LAY.includes(office);
    const age = lay ? rng.int(35, 64) : rng.int(38, 70);
    const birthYear = year - age;
    const heritage = rollHeritage(rng, { ...CLERGY_HERITAGE, ...preset.heritage });
    const title = OFFICE_TITLE[office];
    const name = rollMaleName(rng, heritage, eraForBirthYear(birthYear));
    return finishNpc(rng, {
      id: `chancery_${office}`,
      name,
      role: 'official',
      title: title === 'Ms.' ? (rng.chance(0.5) ? 'Ms.' : 'Mr.') : title,
      birthYear,
      origin: rng.pick(['urban_ethnic', 'rural', 'suburban', 'latino_immigrant', 'convert', 'lapsed'] as const),
      stats: addStats(rollBaseStats(rng, 30, 55), OFFICE_STATS[office]),
      tags: [office, 'chancery', ...(office === 'vocations_director' ? ['vocation_director'] : [])],
      alignment: rollAlignment(rng, bishopAlignment * 0.4, 30),
      ambition: rng.int(20, 95),
      relationship: 0,
    });
  });
}

export const OFFICE_LABEL: Record<ChanceryOffice, string> = {
  vicar_general: 'Vicar General',
  chancellor: 'Chancellor',
  vicar_for_clergy: 'Vicar for Clergy',
  judicial_vicar: 'Judicial Vicar',
  finance_officer: 'Chief Financial Officer',
  vocations_director: 'Director of Vocations',
  superintendent_of_schools: 'Superintendent of Schools',
  communications_director: 'Director of Communications',
  bishop_secretary: "Bishop's Secretary",
};
