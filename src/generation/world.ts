import type { Diocese, DioceseTie, GameState, Npc, Parish, RevealedField, World } from '@/types';
import type { Rng } from '@/engine/rng';
import { diocesePresets } from '@/content/dioceses';
import { OFFICE_LABEL } from './chancery';
import { generateDiocese, type GeneratedDiocese } from './diocese';

export interface Candidate extends GeneratedDiocese {
  presetId: string;
}

/** Every diocese rolls before the player sees anything. DESIGN.md §3.1a */
export function generateCandidates(rng: Rng, year: number): Candidate[] {
  return diocesePresets.map((preset) => ({
    presetId: preset.id,
    ...generateDiocese(rng.derive(`diocese:${preset.id}`), preset, year),
  }));
}

/** Install a candidate as the run's world and merge its people into the state. */
export function installWorld(state: GameState, candidate: Candidate, year: number): GameState {
  const npcs: Record<string, Npc> = { ...state.npcs };
  // Choosing again during creation: the people of the diocese chosen before go with it.
  const previous = state.candidates?.find((c) => c.presetId === state.world?.diocese.presetId);
  for (const n of previous?.npcs ?? []) delete npcs[n.id];
  for (const n of candidate.npcs) npcs[n.id] = n;
  const world: World = {
    diocese: candidate.diocese,
    parishes: candidate.parishes,
    generatedYear: year,
    bishopHistory: [candidate.diocese.hidden.bishop.npcId],
  };
  // The rolled dioceses stay until the run begins, so the choice can be changed.
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('diocese:')) delete flags[k];
  flags[`diocese:${candidate.presetId}`] = true;
  return { ...state, world, npcs, flags, candidates: state.candidates };
}

const TRAIT_TEXT: Record<string, string> = {
  loyalty: 'loyalty',
  competence: 'competence',
  visibility: 'a man who is seen',
  discretion: 'discretion',
  orthodoxy: 'orthodoxy',
  pastoral_warmth: 'pastoral warmth',
  initiative: 'initiative',
  deference: 'deference',
  disloyalty: 'disloyalty',
  sloppiness: 'sloppiness',
  showboating: 'a man who performs',
  secretiveness: 'being kept in the dark',
  heterodoxy: 'anything that smells of heterodoxy',
  coldness: 'coldness with people',
  freelancing: 'a man who acts without asking',
  timidity: 'timidity',
};

/**
 * DESIGN.md §3.2a: a son of the diocese knows more, so his tie reveals one
 * hidden field before the run begins. Returns prose; the preview shows it as
 * "what you have heard".
 */
export function revealFor(candidate: Pick<Candidate, 'diocese' | 'npcs'>, field: RevealedField, rng: Rng): string {
  const h = candidate.diocese.hidden;
  switch (field) {
    case 'bishop_temperament': {
      const b = h.bishop;
      const lean = b.alignment <= -25 ? 'more traditional than he lets on' : b.alignment >= 25 ? 'more progressive than he lets on' : 'harder to place than people think';
      const ambition = b.ambition >= 70 ? 'He wants a bigger see and everyone in the chancery knows it.' : b.ambition <= 30 ? 'He intends to die here, and says so.' : 'He is content enough, for now.';
      return `You have heard from priests who know him: he is ${lean}. He rewards ${TRAIT_TEXT[b.rewards]} and cannot abide ${TRAIT_TEXT[b.cannotTolerate]}. ${ambition}`;
    }
    case 'chancery_figure': {
      const id = rng.pick(h.chanceryIds);
      const npc = candidate.npcs.find((n) => n.id === id);
      if (!npc) return 'You have heard nothing useful about the chancery.';
      const office = OFFICE_LABEL[(npc.tags[0] ?? 'chancellor') as keyof typeof OFFICE_LABEL] ?? 'an official';
      const lean = npc.alignment <= -25 ? 'firmly traditional' : npc.alignment >= 25 ? 'firmly progressive' : 'careful about where he stands';
      const amb = npc.ambition >= 70 ? 'and openly ambitious' : 'and in no hurry';
      return `You know the ${office}, ${npc.title} ${npc.name.last}, by reputation: ${lean}, ${amb}. He writes the memos.`;
    }
    case 'complication':
      return `Something you heard at a kitchen table: ${h.hiddenComplication}`;
  }
}

export function revealFieldForTie(tie: DioceseTie): RevealedField | null {
  return tie === 'son' ? 'bishop_temperament' : null;
}

export function parishById(world: World, id: string): Parish | undefined {
  return world.parishes.find((p) => p.id === id);
}

export function dioceseShortName(d: Diocese): string {
  return d.visible.see;
}
