import { beginReligious } from '@/systems/religious/newGame';
import type { CreationAnswers, ReligiousAnswers, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { creationContent } from '@/content/creation';
import { applyCreation } from '@/systems/creation';
import { SEMINARY_NAMES, startSeminary } from '@/engine/seminary';
import { generateClass } from './classmates';
import { generateFamily } from './family';
import { generateFormators } from './formators';
import { makeFormatorsReligious } from './institutes';
import { presetById } from '@/content/dioceses';

/**
 * Turn creation answers into a run: the character, the family, the seminary
 * faculty, and the class, then the first year's emphasis choice. Each
 * generator draws from its own derived stream so a change to one cannot
 * reshuffle the others.
 */
export function generateRun(state: GameState, answers: CreationAnswers, rng: Rng, religious?: ReligiousAnswers): GameState {
  let created = applyCreation(state, answers, creationContent);
  // A friar: the chosen province is installed now, and formation begins in its first house. E3 §4.
  if (religious && state.campaign === 'religious') {
    const candidate = state.provinceCandidates?.find((c) => c.id === religious.provinceId);
    if (!candidate) throw new Error(`no province ${religious.provinceId} rolled`);
    created = beginReligious({ ...created, provinceCandidates: null }, { ...candidate.gen, visible: candidate.visible }, religious, answers.entryYear);
  }
  const character = created.character!;
  const familyOpt = creationContent.families.find((f) => f.id === answers.family)!;
  const originOpt = creationContent.origins.find((o) => o.id === answers.origin)!;
  const npcs: Npc[] = [
    ...generateFamily(rng.derive('family'), character, familyOpt, originOpt),
    ...makeFormatorsReligious(
      rng.derive('faculty'),
      generateFormators(rng.derive('formators'), answers.entryYear, { includeBishop: !created.world }),
      created.world?.institutes ?? [],
    ),
    ...generateClass(rng.derive('classmates'), answers.entryYear),
  ];
  // Merge: the world's bishop, chancery, and pastors are already in the state.
  const map = { ...created.npcs, ...Object.fromEntries(npcs.map((n) => [n.id, n])) };
  const classmateIds = npcs.filter((n) => n.role === 'classmate').map((n) => n.id);
  const hooks = character.hooks.map((h) => {
    const npc = npcs.find((n) => n.tags.includes(h.id));
    return npc ? { ...h, npcId: npc.id } : h;
  });
  const preset = created.world ? presetById(created.world.diocese.presetId) : undefined;
  const seminaryName = created.religious ? (created.orderHouses?.[created.religious.houseId]?.name ?? 'the novitiate') : preset?.seminaryName ?? rng.derive('seminary').pick(SEMINARY_NAMES);
  return startSeminary({ ...created, character: { ...created.character!, hooks }, npcs: map }, classmateIds, seminaryName);
}
