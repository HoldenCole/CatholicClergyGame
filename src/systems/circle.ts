import type { GameState, Npc } from '@/types';
import { whoWord } from './life';
import { bondsPhrase } from './bonds';
import { lastMark, regardLine, REGARD } from './regard';
import { yearOf } from '@/ui/portraits/spec';

/**
 * The circle: everyone who matters to the man, across the whole life, in
 * the groups the shelf uses at the end. A view over records the game
 * already keeps; nothing here is stored.
 */
export type CircleGroup = 'family' | 'class' | 'brothers' | 'chancery' | 'bishops' | 'parish' | 'former' | 'others';

export const CIRCLE_LABEL: Record<CircleGroup, string> = {
  family: 'The family',
  class: 'The class',
  brothers: 'Brother priests',
  chancery: 'The chancery',
  bishops: 'The bishops',
  parish: 'The people of the parish',
  former: 'The people of the parishes before',
  others: 'Others',
};

export const CIRCLE_ORDER: readonly CircleGroup[] = ['family', 'class', 'brothers', 'chancery', 'bishops', 'parish', 'former', 'others'];

export interface CircleRow {
  npc: Npc;
  group: CircleGroup;
  who: string;
  /** "a friend, since 2019, kept" */
  regard: string;
  /** The last mark, the bonds, or nothing. */
  history: string;
  /** "this year", "a long time ago", or nothing known. */
  seen: string;
  /** "dead", "retired", "left": empty while active. */
  status: string;
}

/** Who counts: anyone with regard past the line, a bond, a mark, or a chair he sat under. */
export function inCircle(npc: Npc): boolean {
  return Math.abs(npc.relationship) >= 15 || (npc.bonds?.length ?? 0) > 0 || (npc.marks?.length ?? 0) > 0 || npc.role === 'bishop' || npc.role === 'family';
}

function groupOf(state: GameState, npc: Npc): CircleGroup {
  const pid = state.assignment?.parishId;
  if (npc.role === 'family') return 'family';
  if (npc.role === 'classmate') return 'class';
  if (npc.role === 'bishop' || npc.tags.includes('bishop_emeritus')) return 'bishops';
  if (npc.role === 'official' || npc.tags.includes('chancery')) return 'chancery';
  if (npc.role === 'priest' || npc.role === 'formator') return 'brothers';
  if (npc.role === 'lay') {
    const parish = npc.tags.find((t) => t.startsWith('parish:'))?.slice(7);
    return parish && parish === pid ? 'parish' : 'former';
  }
  return 'others';
}

function seenWord(state: GameState, npc: Npc): string {
  const kept = state.flags[`kept:${npc.id}`];
  const last = Math.max(npc.contactWeek ?? -1, typeof kept === 'number' ? kept : -1);
  if (last < 0) return '';
  const weeks = state.clock.week - last;
  return weeks <= REGARD.contactWeeks ? 'in touch' : weeks <= 52 ? 'this year' : weeks <= 156 ? 'a year or two ago' : 'a long time ago';
}

function historyOf(state: GameState, npc: Npc): string {
  const m = lastMark(npc);
  const year = (w: number) => yearOf(state.clock.startDay, w);
  if (m) return `${m.why} (${year(m.week)}, ${m.delta > 0 ? 'warmer' : 'colder'})`;
  const bonds = bondsPhrase(npc);
  return bonds ? bonds.charAt(0).toUpperCase() + bonds.slice(1) : '';
}

/** The circle, grouped and ordered: the living first, the warm before the cold. */
export function circleOf(state: GameState): CircleRow[] {
  const year = (w: number) => yearOf(state.clock.startDay, w);
  return Object.values(state.npcs)
    .filter((n) => n.id !== 'player' && inCircle(n) && n.status !== 'dismissed')
    .map((npc) => ({
      npc,
      group: groupOf(state, npc),
      who: whoWord(state, npc),
      regard: regardLine(state, npc, year),
      history: historyOf(state, npc),
      seen: npc.status === 'active' ? seenWord(state, npc) : '',
      status: npc.status === 'active' ? '' : npc.status,
    }))
    .sort((a, b) => CIRCLE_ORDER.indexOf(a.group) - CIRCLE_ORDER.indexOf(b.group) || (a.status ? 1 : 0) - (b.status ? 1 : 0) || b.npc.relationship - a.npc.relationship || a.npc.id.localeCompare(b.npc.id));
}
