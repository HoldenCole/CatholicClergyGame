import type { GameState, Npc, Tenure } from '@/types';
import { allTenures } from './tenures';
import { publicRecord, type PublicRecord } from './record';
import { classmateLines, relationshipWord, type ClassmateLine } from './classmates';
import { yearOf } from '@/ui/portraits/spec';

/**
 * A life, read back at the end: the posts, the bishops, the stands, the
 * people, the letters. DESIGN §15: a summary that reads like a life rather
 * than a score. Everything here comes from records the game already keeps.
 */
export interface LifeBishop {
  npc: Npc;
  /** "the first", "the second" */
  ordinal: string;
  /** How he read you, from the succession record; the first bishop from the relationship alone. */
  reading: string;
  regard: string;
}

export interface LifePerson {
  npc: Npc;
  who: string;
  regard: string;
}

export interface Life {
  years: number;
  age: number;
  posts: (Tenure & { years: string })[];
  bishops: LifeBishop[];
  record: PublicRecord;
  friends: LifePerson[];
  enemies: LifePerson[];
  classmates: ClassmateLine[];
  letters: { week: number; title: string; line: string }[];
  founded: string[];
  decisions: number;
  /** Notes from the file worth reading back. */
  file: string[];
}

function yearsWord(weeks: number): string {
  const y = weeks / 52;
  if (y < 1) return `${Math.max(1, Math.round(weeks / 4))} months`;
  const r = Math.round(y);
  return `${r} year${r === 1 ? '' : 's'}`;
}

function whoWord(state: GameState, npc: Npc): string {
  if (npc.role === 'classmate') return 'classmate';
  if (npc.role === 'family') return npc.tags.find((t) => ['mother', 'father', 'sibling'].includes(t)) ?? 'family';
  if (npc.role === 'bishop') return 'bishop';
  if (npc.role === 'formator') return npc.tags.find((t) => ['rector', 'spiritual_director', 'formation_advisor', 'vocation_director'].includes(t))?.replace(/_/g, ' ') ?? 'formator';
  if (npc.role === 'official') return npc.tags.find((t) => ['vicar_general', 'chancellor', 'vicar_for_clergy'].includes(t))?.replace(/_/g, ' ') ?? 'chancery';
  if (npc.role === 'priest') return npc.tags.some((t) => t.startsWith('pastor:')) ? 'pastor' : 'brother priest';
  const staff = npc.tags.find((t) => ['secretary', 'dre', 'music_director', 'maintenance'].includes(t));
  if (staff) return staff.replace(/_/g, ' ');
  const led = Object.values(state.groups).find((g) => g.leaderId === npc.id);
  if (led) return 'group leader';
  return 'parishioner';
}

export function lifeOf(state: GameState): Life {
  const c = state.character!;
  const week = state.clock.week;
  const year = yearOf(state.clock.startDay, week);
  const age = year - (c.entryYear - c.background.entryAge);
  const ordained = typeof state.flags.ordination_week === 'number' ? state.flags.ordination_week : null;
  const years = ordained === null ? 0 : Math.floor((week - ordained) / 52);

  const posts = allTenures(state).map((t) => ({ ...t, years: yearsWord(t.endWeek - t.startWeek) }));

  const successions = state.career.filter((e) => e.kind === 'succession');
  const ids = state.world?.bishopHistory ?? [];
  const bishops: LifeBishop[] = ids.map((id) => state.npcs[id]).filter((n): n is Npc => !!n).map((npc, i) => {
    const entry = successions.find((e) => e.text.includes(`named ${npc.title} ${npc.name.first} ${npc.name.last}`));
    const reading = entry ? (entry.text.split('. ').slice(1).join('. ') || entry.text) : i === 0 ? 'The bishop who ordained you.' : 'He came; the record does not say what he made of you.';
    return { npc, ordinal: ['the first', 'the second', 'the third', 'the fourth', 'the fifth', 'the sixth', 'the seventh', 'the eighth'][i] ?? `the ${i + 1}th`, reading, regard: relationshipWord(npc.relationship) };
  });

  const people = Object.values(state.npcs).filter((n) => n.id !== 'player' && n.role !== 'bishop');
  const friends = people.filter((n) => n.relationship >= 40).sort((a, b) => b.relationship - a.relationship).slice(0, 8).map((npc) => ({ npc, who: whoWord(state, npc), regard: relationshipWord(npc.relationship) }));
  const enemies = people.filter((n) => n.relationship <= -30).sort((a, b) => a.relationship - b.relationship).slice(0, 5).map((npc) => ({ npc, who: whoWord(state, npc), regard: relationshipWord(npc.relationship) }));

  const letters = (state.letters ?? []).map((l) => ({ week: l.week, title: l.title, line: l.body[l.body.length - 1] ?? '' }));
  const founded = Object.values(state.groups).filter((g) => g.foundedByPlayer).map((g) => g.type.replace(/_/g, ' '));
  const file = state.career.filter((e) => e.kind !== 'note').map((e) => e.text).slice(-10);

  return { years, age, posts, bishops, record: publicRecord(state), friends, enemies, classmates: classmateLines(state), letters, founded, decisions: state.history.length, file };
}
