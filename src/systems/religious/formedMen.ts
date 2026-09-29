import type { FormedMan, GameState, Npc, OrderOfficeDef } from '@/types';
import { religiousOrder } from '@/content/religious';
import { currentHouse, membersOf } from './house';

/**
 * The novice master's men (friar round D8). E3 §6.3: the men a novice
 * master clothed and the students a master of students taught are his for
 * life. While he holds an office that forms (OrderOfficeDef.forms, data on
 * the order), the men of that stage in his house become his: warmer to him
 * at once, a bond written that the years keep, a tag the electorate reads.
 * Each year the record follows them: simple vows, solemn vows, ordination,
 * leaving, death. Tunables invented.
 */
export const FORMED = {
  /** Regard when a man becomes his, and the bond the years keep. */
  warmth: 8,
  /** What a man he formed adds to his regard in a chapter's electorate. */
  voteWarmth: 10,
  /** The tag the electorate and the selectors read. */
  tag: 'formed_by:player',
} as const;

/** The office he holds that forms men, if any. */
export function formingOffice(state: GameState): OrderOfficeDef | undefined {
  const r = state.religious;
  if (!r?.appointment) return undefined;
  const def = religiousOrder(r.order).offices.find((o) => o.id === r.appointment!.id);
  return def?.forms ? def : undefined;
}

function stageOf(n: Npc): FormedMan['stage'] {
  if (n.status === 'left' || n.status === 'dismissed') return 'left';
  if (n.status === 'dead') return 'dead';
  if (n.tags.includes('vows:novice')) return 'novice';
  if (n.tags.includes('vows:simple')) return 'simple';
  if (n.title === 'Fr.') return 'priest';
  return 'solemn';
}

const STAGE_WORD: Record<FormedMan['stage'], string> = { novice: 'a novice still', simple: 'in simple vows', solemn: 'solemnly professed', priest: 'a priest', left: 'left the order', dead: 'dead' };

export function stageWord(stage: FormedMan['stage']): string {
  return STAGE_WORD[stage];
}

export function formedMenOf(state: GameState): (FormedMan & { npc: Npc })[] {
  return (state.religious?.formed ?? []).map((f) => ({ ...f, npc: state.npcs[f.npcId]! })).filter((f) => !!f.npc);
}

function name(n: Npc): string {
  return `${n.title} ${n.name.first} ${n.name.last}`;
}

/**
 * The year: the men of the stage his office forms become his, and the
 * record follows every man he has formed to his next milestone.
 */
export function formedMenYear(state: GameState): GameState {
  const r = state.religious;
  if (!r || !state.flags.ordained) return state;
  const week = state.clock.week;
  let formed = [...(r.formed ?? [])];
  const npcs = { ...state.npcs };
  const notes: string[] = [];
  const def = formingOffice(state);
  const house = currentHouse(state);
  if (def && house && !state.study) {
    const tag = def.forms === 'novices' ? 'vows:novice' : 'vows:simple';
    const mine = membersOf(state, house).filter((m) => m.tags.includes(tag) && !formed.some((f) => f.npcId === m.id));
    for (const m of mine) {
      const as = def.forms === 'novices' ? 'novice' : 'student';
      formed.push({ npcId: m.id, week, as, houseId: house.id, stage: stageOf(m) });
      npcs[m.id] = { ...m, relationship: Math.min(100, m.relationship + FORMED.warmth), tags: [...m.tags, FORMED.tag], bonds: [...(m.bonds ?? []), { kind: 'helped', week, who: as === 'novice' ? 'him, clothed by you' : 'him, taught by you' }] };
    }
    if (mine.length) notes.push(`${def.forms === 'novices' ? 'Clothed' : 'Taught'} this year: ${mine.map((m) => `${m.name.first} ${m.name.last}`).join(', ')}. ${mine.length === 1 ? 'He is yours' : 'They are yours'} for life.`);
  }
  // The record follows them.
  formed = formed.map((f) => {
    const n = npcs[f.npcId];
    if (!n) return f;
    const stage = stageOf(n);
    if (stage === f.stage) return f;
    const verb = f.as === 'novice' ? 'whom you clothed' : 'whom you taught';
    const what = stage === 'simple' ? 'made simple profession' : stage === 'solemn' ? 'made solemn profession' : stage === 'priest' ? 'was ordained a priest' : stage === 'left' ? 'left the order' : stage === 'dead' ? 'died' : 'is a novice again';
    notes.push(`${name(n)}, ${verb}, ${what}.`);
    return { ...f, stage };
  });
  if (!notes.length && formed.length === (r.formed?.length ?? 0)) return state;
  const flags = { ...state.flags, ...(formed.length ? { 'formed:any': true } : {}) };
  return { ...state, npcs, flags, religious: { ...r, formed }, career: [...state.career, ...notes.map((text) => ({ week, kind: 'note' as const, text }))] };
}
