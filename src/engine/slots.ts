import type { GameState, SaveFile } from '@/types';
import { deserialize, stableStringify } from './save';
import { fromDayNumber } from './calendar';

/**
 * Saved games kept in the browser, so closing the page does not end a run.
 * One autosave, written as the weeks pass, and a shelf of named slots the
 * player writes himself. The file export stays what it was: these are the
 * same JSON, under a key instead of in a download. Requested in playtesting.
 */
export const SLOTS = {
  /** Named slots at once. The autosave is not one of them. */
  max: 8,
  autoId: 'autosave',
  indexKey: 'vocation:saves',
  prefix: 'vocation:save:',
  /** At most one autosave this often while the clock runs. */
  autosaveMs: 5_000,
} as const;

export interface SlotMeta {
  id: string;
  /** What the player called it, or "Autosave". */
  name: string;
  /** ISO, for the list and for sorting. */
  savedAt: string;
  seed: string;
  week: number;
  /** Who and where, in one line. */
  line: string;
  /** Size of the stored JSON, for the shelf and for a quota message. */
  bytes: number;
  auto?: boolean;
}

export class SlotError extends Error {
  override name = 'SlotError';
}

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    // Touch it: a private window can have the property and refuse the call.
    s?.getItem(SLOTS.indexKey);
    return s ?? null;
  } catch {
    return null;
  }
}

/** Whether this browser will keep saves at all. */
export function slotsAvailable(): boolean {
  return storage() !== null;
}

const ROLE_WORD: Record<string, string> = { parochial_vicar: 'parochial vicar', administrator: 'administrator', pastor: 'pastor' };

/** Who the man is and where he stands, in one line for the shelf. */
export function describeSave(state: GameState): string {
  const year = fromDayNumber(state.clock.startDay + state.clock.week * 7).year;
  const c = state.character;
  if (!c) return `A man not yet made, ${year}`;
  const who = `Fr. ${c.name.last}`;
  if (state.mode.kind === 'ended') return `${who}, at the end of it, ${year}`;
  if (state.see) return `${who}, Bishop of ${state.see.see}, ${year}`;
  if (state.study) return `${who}, ${state.study.label.toLowerCase()}, ${year}`;
  if (state.phase === 'seminary') {
    const seminaryYear = state.seminary?.year ?? 1;
    return `${who}, year ${seminaryYear} of seminary, ${year}`;
  }
  const parish = state.parish ? state.world?.parishes.find((p) => p.id === state.parish!.parishId) : undefined;
  const role = ROLE_WORD[state.assignment?.role ?? ''] ?? 'priest';
  return parish ? `${who}, ${role} of ${parish.name}, ${parish.place}, ${year}` : `${who}, ${role}, ${year}`;
}

function readIndex(): SlotMeta[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(SLOTS.indexKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is SlotMeta => !!m && typeof (m as SlotMeta).id === 'string');
  } catch {
    return [];
  }
}

function writeIndex(metas: SlotMeta[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SLOTS.indexKey, JSON.stringify(metas));
  } catch {
    /* the quota message comes from the save itself, which is the big write */
  }
}

/** Every saved game, newest first, the autosave among them. */
export function listSlots(): SlotMeta[] {
  const s = storage();
  if (!s) return [];
  // An entry whose save is gone (cleared storage, another tab) is not listed.
  const kept = readIndex().filter((m) => s.getItem(SLOTS.prefix + m.id) !== null);
  return [...kept].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

export function slotMeta(id: string): SlotMeta | undefined {
  return listSlots().find((m) => m.id === id);
}

/** The JSON of one saved game, or null. */
export function readSlot(id: string): string | null {
  const s = storage();
  if (!s) return null;
  try {
    return s.getItem(SLOTS.prefix + id);
  } catch {
    return null;
  }
}

/** The saved game, parsed and validated. Throws SaveError on a save this build cannot read. */
export function loadSlot(id: string): SaveFile {
  const json = readSlot(id);
  if (json === null) throw new SlotError('that save is not in this browser any more');
  return deserialize(json);
}

export function nextSlotId(): string {
  const taken = new Set(readIndex().map((m) => m.id));
  for (let i = 1; i <= SLOTS.max; i++) if (!taken.has(`slot${i}`)) return `slot${i}`;
  throw new SlotError(`the shelf holds ${SLOTS.max} saves; delete one first`);
}

/**
 * Write one save. `id` overwrites that slot; without one a new slot is taken,
 * up to the shelf's size. Throws SlotError when the browser refuses.
 */
export function writeSlot(save: SaveFile, opts: { id?: string; name?: string; auto?: boolean } = {}): SlotMeta {
  const s = storage();
  if (!s) throw new SlotError('this browser will not keep saves; download the file instead');
  const id = opts.auto ? SLOTS.autoId : (opts.id ?? nextSlotId());
  // Compact: the shelf is not read by people, and the browser's room is small.
  const json = stableStringify(save, false);
  const meta: SlotMeta = {
    id,
    name: opts.name ?? (opts.auto ? 'Autosave' : describeSave(save.state)),
    savedAt: new Date().toISOString(),
    seed: save.state.seed,
    week: save.state.clock.week,
    line: describeSave(save.state),
    bytes: json.length,
    ...(opts.auto ? { auto: true } : {}),
  };
  try {
    s.setItem(SLOTS.prefix + id, json);
  } catch {
    throw new SlotError('the browser is out of room for saves: delete one, or download the file');
  }
  writeIndex([...readIndex().filter((m) => m.id !== id), meta]);
  return meta;
}

/**
 * A new man is begun, and the autosave is about to become his. If it holds a
 * different run and the shelf has room, that run is set aside as a named save
 * first, so beginning a new game never quietly ends an old one.
 */
export function preserveAutosave(seed: string): SlotMeta | null {
  const auto = listSlots().find((m) => m.id === SLOTS.autoId);
  if (!auto || auto.seed === seed) return null;
  const s = storage();
  const json = readSlot(SLOTS.autoId);
  if (!s || !json) return null;
  if (listSlots().filter((m) => !m.auto).length >= SLOTS.max) return null;
  // Already set aside, week for week: nothing to do.
  if (listSlots().some((m) => !m.auto && m.seed === auto.seed && m.week === auto.week)) return null;
  let id: string;
  try {
    id = nextSlotId();
  } catch {
    return null;
  }
  try {
    s.setItem(SLOTS.prefix + id, json);
  } catch {
    return null;
  }
  // A save of its own now, not an autosave: it is never written over again.
  const { auto: _auto, ...rest } = auto;
  const meta: SlotMeta = { ...rest, id, name: `Set aside: ${auto.line}` };
  writeIndex([...readIndex().filter((m) => m.id !== id), meta]);
  return meta;
}

export function deleteSlot(id: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SLOTS.prefix + id);
  } catch {
    /* nothing to do: the index drops it either way */
  }
  writeIndex(readIndex().filter((m) => m.id !== id));
}

/** Rename a slot without rewriting the save. */
export function renameSlot(id: string, name: string): void {
  writeIndex(readIndex().map((m) => (m.id === id ? { ...m, name } : m)));
}
