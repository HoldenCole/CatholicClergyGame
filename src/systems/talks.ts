import type { GameState, Npc, TalkBand, TalkDef, TalkWho, TalksState } from '@/types';
import type { Rng } from '@/engine/rng';
import { talkDefs } from '@/content/parish';
import { applyEffects } from '@/engine/effects';
import { renderText, textExtras } from '@/engine/text';
import { parishGroups } from './groups';

/** Requested in playtesting; numbers invented. */
export const TALKS = {
  /** Weeks before the same person will sit down again. */
  cooldownWeeks: 8,
  /** Blocks it takes from the coming week. */
  blocks: 1,
  /** The warm band starts here, the cold band ends here. */
  warmAt: 30,
  coldAt: -15,
} as const;

export function talksOf(state: GameState): TalksState {
  return state.talks ?? { last: {}, log: [] };
}

export function bandOf(npc: Npc): TalkBand {
  return npc.relationship > TALKS.warmAt ? 'warm' : npc.relationship < TALKS.coldAt ? 'cold' : 'neutral';
}

/** Which kind of exchange a person gets, or null when there is nothing written for them. */
export function whoIs(state: GameState, npc: Npc): TalkWho | null {
  const pid = state.assignment?.parishId;
  if (state.world && npc.id === state.world.diocese.hidden.bishop.npcId) return 'bishop';
  if (pid && npc.tags.includes(`pastor:${pid}`) && npc.id !== 'player') return 'pastor';
  for (const tag of ['secretary', 'dre', 'music_director', 'maintenance'] as const) if (npc.tags.includes(tag)) return tag;
  const led = parishGroups(state).find((g) => g.leaderId === npc.id);
  if (led) return `leader_${led.agenda}`;
  if (npc.role === 'classmate') return 'classmate';
  if (npc.role === 'priest') return 'brother_priest';
  return null;
}

export interface TalkAvailability {
  ok: boolean;
  why: string | null;
  who: TalkWho | null;
}

export function mayTalk(state: GameState, npcId: string): TalkAvailability {
  const npc = state.npcs[npcId];
  if (!npc || npc.status !== 'active') return { ok: false, why: 'Not here.', who: null };
  const who = whoIs(state, npc);
  if (!who) return { ok: false, why: 'Nothing to say yet.', who: null };
  if (!state.parish || state.mode.kind !== 'clock') return { ok: false, why: 'Not now.', who };
  const last = talksOf(state).last[npcId];
  if (last !== undefined && state.clock.week - last < TALKS.cooldownWeeks) {
    const weeks = TALKS.cooldownWeeks - (state.clock.week - last);
    return { ok: false, why: `You spoke ${state.clock.week - last === 0 ? 'this week' : `${state.clock.week - last} week${state.clock.week - last === 1 ? '' : 's'} ago`}; another word in ${weeks} week${weeks === 1 ? '' : 's'} would be noticed.`, who };
  }
  const spoken = Object.values(talksOf(state).last).filter((w) => w === state.clock.week).length;
  if (spoken >= 2) return { ok: false, why: 'Two conversations is a week; a third would be a campaign.', who };
  return { ok: true, why: null, who };
}

function defsFor(who: TalkWho, band: TalkBand): TalkDef[] {
  const exact = talkDefs.filter((d) => d.who === who && d.band === band);
  return exact.length ? exact : talkDefs.filter((d) => d.who === who);
}

function addDigestLine(state: GameState, line: string): GameState {
  const last = state.digest[state.digest.length - 1];
  if (!last || last.week !== state.clock.week) return { ...state, digest: [...state.digest, { week: state.clock.week, lines: [line] }] };
  return { ...state, digest: [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, line] }] };
}

/**
 * An hour with one person: the authored exchange for who they are and how
 * things stand, its small effects, a block off the coming week, and the
 * words in the record. DESIGN §5.4: the game remembers who you talked to.
 */
export function haveAWord(state: GameState, npcId: string, rng: Rng): { state: GameState; text: string } {
  const may = mayTalk(state, npcId);
  if (!may.ok || !may.who) throw new Error(may.why ?? 'Not now.');
  const npc = state.npcs[npcId]!;
  const defs = defsFor(may.who, bandOf(npc));
  if (defs.length === 0) throw new Error('Nothing to say yet.');
  const def = rng.pick(defs);
  const index = rng.int(0, def.text.length - 1);
  const variant = def.text[index]!;
  const bindings = { '@who': npcId };
  const text = renderText(variant, state, bindings, textExtras(state));
  let next = applyEffects(state, [...def.effects, ...(def.variantEffects?.[index] ?? [])], bindings, `talking with ${npc.name.first} ${npc.name.last}`);
  const talks = talksOf(next);
  next = {
    ...next,
    parish: next.parish ? { ...next.parish, apNextWeek: next.parish.apNextWeek - TALKS.blocks } : next.parish,
    talks: { last: { ...talks.last, [npcId]: state.clock.week }, log: [...talks.log.slice(-39), { week: state.clock.week, npcId, text }] },
  };
  const name = `${npc.title ? `${npc.title} ` : ''}${npc.name.first} ${npc.name.last}`;
  next = addDigestLine(next, `A word with ${name}.`);
  return { state: next, text };
}
