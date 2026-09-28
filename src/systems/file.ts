import type { FileEntry, GameState, Npc } from '@/types';
import { inDiocese } from '@/engine/selectors';

/**
 * The chancery's file. What a priest's reputation with the chancery actually
 * is: dated notes written by officials and bishops, the board's decisions,
 * the rector's evaluations, the complaints, the talk that reached the
 * bishop, kept across successions. A new bishop reads the file, not the
 * man; the man sees only what was said to his face, and can learn the rest
 * through a friend at the chancery. Numbers invented.
 */
export const FILE = {
  /** An official this cold writes a note each year; this warm, a good word. */
  noteAt: -30,
  praiseAt: 40,
  /** What each unit of weight moves a new bishop's opening view, and the most the file can move it. */
  readPerWeight: 2.5,
  readCap: 20,
  /** Notes a friend at the chancery reads out per favour. */
  revealPerFavour: 3,
  keep: 80,
} as const;

const OFFICIAL_LINES = {
  cold: [
    'Difficult to place. Does not take direction well.',
    'Has made himself hard to help.',
    'Not a team man. The deanery says the same.',
  ],
  warm: [
    'Reliable; does what he says.',
    'A man the chancery can send anywhere.',
    'Takes the hard ones and does not complain.',
  ],
} as const;

export function fileOf(state: GameState): FileEntry[] {
  return state.file ?? [];
}

/** Put a note in the file, dated this week. */
export function writeFile(state: GameState, entry: Omit<FileEntry, 'week'> & { week?: number }): GameState {
  const e: FileEntry = { ...entry, week: entry.week ?? state.clock.week };
  return { ...state, file: [...(state.file ?? []), e].slice(-FILE.keep) };
}

/** Who an official is, for the byline. */
export function officialLabel(npc: Npc): string {
  const office = npc.tags.includes('vicar_general') ? 'vicar general' : npc.tags.includes('vicar_for_clergy') ? 'vicar for clergy' : npc.tags.includes('chancellor') ? 'chancellor' : npc.tags.includes('vocations_director') ? 'vocations director' : 'of the chancery';
  return `${npc.title ? `${npc.title} ` : ''}${npc.name.last}, ${office}`;
}

/**
 * A new bishop reads the file: each note weighs by its weight, for him or
 * against him by its lean against his own side; stands taken aloud are read
 * elsewhere (succession.ts) and skipped here.
 */
export function readFile(state: GameState, bishop: Pick<Npc, 'alignment'>): { swing: number; forHim: number; againstHim: number; count: number } {
  let raw = 0;
  let forHim = 0;
  let againstHim = 0;
  const entries = fileOf(state).filter((e) => e.kind !== 'position');
  for (const e of entries) {
    const side = e.lean && bishop.alignment !== 0 ? (Math.sign(e.lean) === Math.sign(bishop.alignment) ? 1 : -1) : 1;
    const v = e.weight * side;
    raw += v;
    if (v > 0) forHim += 1; else if (v < 0) againstHim += 1;
  }
  const swing = Math.max(-FILE.readCap, Math.min(FILE.readCap, raw * FILE.readPerWeight));
  return { swing, forHim, againstHim, count: entries.length };
}

/** A friend at the chancery tells him what the last notes say. */
export function revealFile(state: GameState, n: number): { state: GameState; revealed: FileEntry[] } {
  const file = fileOf(state);
  const hidden = file.filter((e) => !e.seen).slice(-n);
  if (!hidden.length) return { state, revealed: [] };
  const set = new Set(hidden);
  return { state: { ...state, file: file.map((e) => (set.has(e) ? { ...e, seen: true } : e)) }, revealed: hidden };
}

/** The officials of the diocese he is in. */
export function officialsOf(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'official' && n.tags.includes('chancery') && inDiocese(state, n));
}

/** Once a year: an official who has a view of him writes it down. Officials outlive bishops, and so do their notes. */
export function officialsWrite(state: GameState): GameState {
  if (!state.character || !state.flags.ordained) return state;
  let next = state;
  const year = Math.floor(state.clock.week / 52);
  for (const o of officialsOf(state)) {
    if (o.relationship <= FILE.noteAt) next = writeFile(next, { by: o.id, byLabel: officialLabel(o), kind: 'note', text: OFFICIAL_LINES.cold[year % OFFICIAL_LINES.cold.length]!, weight: -1, lean: 0, seen: false });
    else if (o.relationship >= FILE.praiseAt) next = writeFile(next, { by: o.id, byLabel: officialLabel(o), kind: 'note', text: OFFICIAL_LINES.warm[year % OFFICIAL_LINES.warm.length]!, weight: 1, lean: 0, seen: false });
  }
  return next;
}

/** What the man can see of his own file, and how much he cannot. */
export function fileLines(state: GameState): { seen: FileEntry[]; hidden: number } {
  const file = fileOf(state);
  return { seen: file.filter((e) => e.seen), hidden: file.filter((e) => !e.seen).length };
}
