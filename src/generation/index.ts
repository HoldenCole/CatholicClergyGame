import type { CreationAnswers, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { creationContent } from '@/content/creation';
import { applyCreation } from '@/systems/creation';
import { startSeminary } from '@/engine/seminary';
import { generateClass } from './classmates';
import { generateFamily } from './family';
import { generateFormators } from './formators';

/**
 * Turn creation answers into a run: the character, the family, the seminary
 * faculty, and the class, then the first year's emphasis choice. Each
 * generator draws from its own derived stream so a change to one cannot
 * reshuffle the others.
 */
export function generateRun(state: GameState, answers: CreationAnswers, rng: Rng): GameState {
  const created = applyCreation(state, answers, creationContent);
  const character = created.character!;
  const familyOpt = creationContent.families.find((f) => f.id === answers.family)!;
  const originOpt = creationContent.origins.find((o) => o.id === answers.origin)!;
  const npcs: Npc[] = [
    ...generateFamily(rng.derive('family'), character, familyOpt, originOpt),
    ...generateFormators(rng.derive('formators'), answers.entryYear),
    ...generateClass(rng.derive('classmates'), answers.entryYear),
  ];
  const map = Object.fromEntries(npcs.map((n) => [n.id, n]));
  const classmateIds = npcs.filter((n) => n.role === 'classmate').map((n) => n.id);
  const hooks = character.hooks.map((h) => {
    const npc = npcs.find((n) => n.tags.includes(h.id));
    return npc ? { ...h, npcId: npc.id } : h;
  });
  return startSeminary({ ...created, character: { ...character, hooks }, npcs: map }, classmateIds);
}
