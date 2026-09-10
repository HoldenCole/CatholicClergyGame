import type { Character, FamilyOption, Npc, OriginOption } from '@/types';
import type { Rng } from '@/engine/rng';
import { eraForBirthYear, rollFemaleName, rollHeritage, rollMaleName, CLERGY_HERITAGE } from './names';
import { addStats, finishNpc, rollBaseStats } from './npc';

/** Family NPCs, the mentor priest, and the home pastor, per the creation answers. */
export function generateFamily(
  rng: Rng,
  character: Character,
  family: FamilyOption,
  origin: OriginOption,
): Npc[] {
  const out: Npc[] = [];
  const heritage = rollHeritage(rng, origin.heritage);
  const surname = character.name.last;
  const birthYear = character.entryYear - character.background.entryAge;
  const parentBirth = () => birthYear - rng.int(22, 36);
  const rel = (base: number) => Math.round(base + family.support * 30 + rng.gaussian() * 8);

  if (family.mother !== 'absent') {
    const dependent = family.dependent === 'mother';
    out.push(
      finishNpc(rng, {
        id: 'mother',
        name: rollFemaleName(rng, heritage, surname),
        role: 'family',
        title: '',
        birthYear: parentBirth(),
        origin: character.background.origin,
        stats: rollBaseStats(rng, 20, 50),
        tags: ['mother', ...(dependent ? ['dependent'] : [])],
        relationship: rel(25),
      }),
    );
    if (family.mother === 'dead') out[out.length - 1] = { ...out[out.length - 1]!, status: 'dead' };
  }
  if (family.father !== 'absent') {
    const dependent = family.dependent === 'father';
    out.push(
      finishNpc(rng, {
        id: 'father',
        name: { ...rollMaleName(rng, heritage, 'older'), last: surname },
        role: 'family',
        title: '',
        birthYear: parentBirth(),
        origin: character.background.origin,
        stats: rollBaseStats(rng, 20, 50),
        tags: ['father', ...(dependent ? ['dependent'] : [])],
        relationship: rel(family.support < 0 ? -10 : 15),
      }),
    );
    if (family.father === 'dead') out[out.length - 1] = { ...out[out.length - 1]!, status: 'dead' };
  }
  for (let i = 0; i < family.siblings; i++) {
    const sisters = rng.chance(0.5);
    const sibBirth = birthYear + rng.int(-8, 8);
    const dependent = family.dependent === 'sibling' && i === 0;
    out.push(
      finishNpc(rng, {
        id: `sibling_${i + 1}`,
        name: sisters
          ? rollFemaleName(rng, heritage, surname)
          : { ...rollMaleName(rng, heritage, eraForBirthYear(sibBirth)), last: surname },
        role: 'family',
        title: '',
        birthYear: sibBirth,
        origin: character.background.origin,
        stats: rollBaseStats(rng, 20, 50),
        tags: ['sibling', ...(dependent ? ['dependent'] : [])],
        relationship: rel(10),
      }),
    );
  }

  const wantsMentor = character.background.motive === 'priest';
  const wantsHomePastor = character.background.tie === 'son';
  if (wantsMentor || wantsHomePastor) {
    const sameMan = wantsMentor && wantsHomePastor && rng.chance(0.5);
    const priest = (id: string, tags: string[], relationship: number) => {
      const pb = character.entryYear - rng.int(50, 72);
      return finishNpc(rng, {
        id,
        name: rollMaleName(rng, rollHeritage(rng, CLERGY_HERITAGE), eraForBirthYear(pb)),
        role: 'priest',
        title: 'Fr.',
        birthYear: pb,
        origin: character.background.origin,
        stats: addStats(rollBaseStats(rng, 30, 55), { piety: 15, charisma: 10 }),
        tags,
        relationship,
      });
    };
    if (sameMan) out.push(priest('mentor_priest', ['mentor_priest', 'home_pastor'], rng.int(35, 55)));
    else {
      if (wantsMentor) out.push(priest('mentor_priest', ['mentor_priest'], rng.int(35, 55)));
      if (wantsHomePastor) out.push(priest('home_pastor', ['home_pastor'], rng.int(15, 35)));
    }
  }
  return out;
}
