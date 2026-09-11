import type { Npc, Parish } from '@/types';
import type { Rng } from '@/engine/rng';
import { presetById } from '@/content/dioceses';
import { CLERGY_HERITAGE, eraForBirthYear, rollFemaleName, rollHeritage, rollMaleName } from './names';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

const STAFF: { tag: string; title: string; ages: [number, number]; women: number; when: (p: Parish) => boolean }[] = [
  { tag: 'secretary', title: '', ages: [30, 68], women: 0.85, when: () => true },
  { tag: 'dre', title: '', ages: [28, 62], women: 0.8, when: (p) => p.households >= 500 || p.school !== 'none' },
  { tag: 'music_director', title: '', ages: [24, 70], women: 0.5, when: (p) => p.households >= 400 },
  { tag: 'maintenance', title: '', ages: [35, 70], women: 0.05, when: (p) => p.households >= 300 },
];

function heritageFor(rng: Rng, parish: Parish, presetId: string): Parameters<typeof rollMaleName>[1] {
  const preset = presetById(presetId);
  const weights: Record<string, number> = {};
  for (const [k, share] of Object.entries(parish.ethnic)) {
    if (k === 'latino') {
      weights.mexican = (weights.mexican ?? 0) + share * 3;
      weights.central_american = (weights.central_american ?? 0) + share;
      weights.caribbean = (weights.caribbean ?? 0) + share * (presetId === 'new_york' ? 2 : 0.3);
    } else weights[k] = (weights[k] ?? 0) + share * 4;
  }
  for (const [k, v] of Object.entries(preset?.heritage ?? CLERGY_HERITAGE)) weights[k] = (weights[k] ?? 0) + v * 0.2;
  return rollHeritage(rng, weights);
}

/** Staff and a handful of named parishioners for the player's parish. DESIGN 8.2 */
export function generateParishPeople(rng: Rng, parish: Parish, presetId: string, year: number): Npc[] {
  const out: Npc[] = [];
  for (const spec of STAFF) {
    if (!spec.when(parish)) continue;
    const age = rng.int(spec.ages[0], spec.ages[1]);
    const birthYear = year - age;
    const heritage = heritageFor(rng, parish, presetId);
    const woman = rng.chance(spec.women);
    out.push(
      finishNpc(rng, {
        id: `${parish.id}_${spec.tag}`,
        name: woman ? rollFemaleName(rng, heritage) : rollMaleName(rng, heritage, eraForBirthYear(birthYear)),
        role: 'lay',
        title: '',
        birthYear,
        origin: parish.terrain === 'latino' ? 'latino_immigrant' : parish.terrain === 'rural' ? 'rural' : parish.terrain === 'suburban' ? 'suburban' : 'urban_ethnic',
        stats: addStats(rollBaseStats(rng, 20, 55), spec.tag === 'maintenance' ? { administration: 10 } : spec.tag === 'music_director' ? { charisma: 10 } : {}),
        tags: [spec.tag, `parish:${parish.id}`, 'staff'],
        alignment: rollAlignment(rng, parish.alignment * 0.5, 30),
        relationship: Math.round(rng.gaussian() * 6),
      }),
    );
  }
  const count = rng.int(6, 9);
  // Two of them are family: a parish remembers by surname.
  const kin: string[] = [];
  for (let i = 0; i < count; i++) {
    const age = rng.int(19, 88);
    const birthYear = year - age;
    const heritage = heritageFor(rng, parish, presetId);
    const woman = rng.chance(0.55);
    const rolled = woman ? rollFemaleName(rng, heritage) : rollMaleName(rng, heritage, eraForBirthYear(birthYear));
    const name = i > 0 && i <= 2 && kin[0] ? { ...rolled, last: kin[0] } : rolled;
    if (i === 0) kin.push(rolled.last);
    out.push(
      finishNpc(rng, {
        id: `${parish.id}_lay_${i + 1}`,
        name,
        role: 'lay',
        title: '',
        birthYear,
        origin: parish.terrain === 'latino' ? 'latino_immigrant' : parish.terrain === 'rural' ? 'rural' : parish.terrain === 'suburban' ? 'suburban' : 'urban_ethnic',
        stats: rollBaseStats(rng, 15, 55),
        tags: [`parish:${parish.id}`, 'parishioner'],
        alignment: rollAlignment(rng, parish.alignment * 0.6, 30),
        relationship: Math.round(rng.gaussian() * 5),
      }),
    );
  }
  return out;
}
