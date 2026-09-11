import type { GameState, PositionRecord } from '@/types';
import { TOPIC } from './choiceMeaning';
import { isFigure } from './reputation';

/**
 * The public record: every stand the man has taken, in words, and how the
 * bishop now in office reads each one. Numbers stay out; the sheet is what
 * the chancery could read back to him.
 */
export interface RecordRow {
  week: number;
  topic: string;
  side: string;
  volume: string;
  /** How the current bishop reads it: with him, against him, or unread. */
  reading: 'with' | 'against' | 'unread';
}

export interface PublicRecord {
  rows: RecordRow[];
  /** "a quiet man", "a man on the record", "a figure" */
  standing: string;
  /** One sentence on how the bishop reads the whole. */
  bishopLine: string;
}

export function volumeWord(v: PositionRecord['volume']): string {
  return v === 'public' ? 'in public' : v === 'semi_public' ? 'said aloud' : 'in private';
}

export function sideWord(p: PositionRecord): string {
  const t = TOPIC[p.topic];
  const side = p.value < 0 ? (t?.neg ?? 'the conservative side') : (t?.pos ?? 'the progressive side');
  return `${Math.abs(p.value) >= 45 ? 'hard for ' : 'for '}${side}`;
}

export function topicWord(topic: string): string {
  return TOPIC[topic]?.label ?? topic.replace(/_/g, ' ');
}

export function outspokennessWord(o: number): string {
  return o >= 60 ? 'a figure people quote' : o >= 40 ? 'a man on the record' : o >= 20 ? 'a man who has said things' : o >= 8 ? 'a man who chooses his moments' : 'a quiet man';
}

/** How a bishop of a given alignment reads one stand: private views are unread. */
export function readingOf(p: PositionRecord, bishopAlignment: number): RecordRow['reading'] {
  if (p.volume === 'private') return 'unread';
  if (bishopAlignment === 0) return 'unread';
  return Math.sign(p.value) === Math.sign(bishopAlignment) ? 'with' : 'against';
}

export function publicRecord(state: GameState): PublicRecord {
  const c = state.character;
  if (!c) return { rows: [], standing: '', bishopLine: '' };
  const bishopAlignment = state.world?.diocese.hidden.bishop.alignment ?? 0;
  const rows = [...c.positions].reverse().map((p) => ({ week: p.week, topic: topicWord(p.topic), side: sideWord(p), volume: volumeWord(p.volume), reading: readingOf(p, bishopAlignment) }));
  const figure = isFigure(c);
  const standing = figure ? 'a figure: the wing that agrees with you speaks for you, and the other keeps a file' : outspokennessWord(c.outspokenness);
  const aloud = rows.filter((r) => r.reading !== 'unread');
  const against = aloud.filter((r) => r.reading === 'against').length;
  const withHim = aloud.length - against;
  const bishopLine = !state.world ? '' :
    aloud.length === 0 ? 'The bishop has nothing of yours to read.' :
    against === 0 ? 'Everything of yours the bishop has read, he could have said himself.' :
    withHim === 0 ? 'Everything of yours the bishop has read runs against him. He has noticed.' :
    against > withHim ? 'More of what you have said runs against the bishop than with him.' :
    'Most of what you have said sits easily with the bishop; a line or two does not.';
  return { rows, standing, bishopLine };
}
