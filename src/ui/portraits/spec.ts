import type { Character, Npc } from '@/types';
import { namePools } from '@/content/names';

/**
 * A face is a handful of independent attributes. NPC faces derive from a
 * hash of the person (never stored, always the same); the player's is
 * chosen at creation and kept on the character as a string.
 */
export interface PortraitSpec {
  /** 0..5, light to dark. */
  skin: number;
  /** 0 black, 1 dark brown, 2 brown, 3 blond, 4 red, 5 grey. Age overrides to grey and white. */
  hairColor: number;
  /** 0..6 for men: short, parted, cropped, curly, waves, bald, receding. For women: bob, long, up, curly, waves, short, grey-up. */
  hairStyle: number;
  /** 0 none, 1 moustache, 2 beard, 3 stubble. Men only. */
  facial: number;
  /** 0 none, 1 round, 2 square. */
  glasses: number;
  /** 0 oval, 1 round, 2 long, 3 square. */
  face: number;
  /** 0..2 eye color: brown, blue, green. */
  eyes: number;
  /** 0 neutral, 1 slight smile, 2 set. */
  mouth: number;
  /** 0 straight, 1 arched, 2 heavy. */
  brows: number;
}

export type Dress = 'lay_m' | 'lay_f' | 'seminarian' | 'priest' | 'monsignor' | 'bishop';

export interface Portrait {
  spec: PortraitSpec;
  dress: Dress;
  age: number;
  female: boolean;
}

export const SPEC_RANGES: Record<keyof PortraitSpec, number> = { skin: 6, hairColor: 6, hairStyle: 7, facial: 4, glasses: 3, face: 4, eyes: 3, mouth: 3, brows: 3 };
const KEYS = Object.keys(SPEC_RANGES) as (keyof PortraitSpec)[];

/** FNV-1a, 32-bit. Deterministic and cheap; this is rendering, not game logic. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** One roll in 0..n from a seed, using the high bits so neighbouring seeds do not share parity. */
function roll(seed: string, n: number): number {
  return (hash(seed) >>> 11) % n;
}

/** A spec from a seed string: every attribute takes its own hash so none correlate. */
export function specFrom(seed: string): PortraitSpec {
  const out = {} as PortraitSpec;
  for (const k of KEYS) out[k] = roll(`${seed}/${k}`, SPEC_RANGES[k]);
  // Glasses and beards are less common than a uniform draw would make them.
  if (roll(`${seed}/wears-glasses`, 3) !== 0) out.glasses = 0;
  if (roll(`${seed}/has-beard`, 2) !== 0) out.facial = 0;
  return out;
}

export function serializeSpec(s: PortraitSpec): string {
  return `v1:${KEYS.map((k) => s[k]).join('.')}`;
}

export function parseSpec(text: string): PortraitSpec | null {
  if (!text.startsWith('v1:')) return null;
  const parts = text.slice(3).split('.').map(Number);
  if (parts.length !== KEYS.length || parts.some((n) => !Number.isInteger(n))) return null;
  const out = {} as PortraitSpec;
  KEYS.forEach((k, i) => { out[k] = ((parts[i]! % SPEC_RANGES[k]) + SPEC_RANGES[k]) % SPEC_RANGES[k]; });
  return out;
}

/** A page of faces to choose from at creation, deterministic in the run's seed. */
export function facesFor(seed: string, page: number, n = 8): PortraitSpec[] {
  return Array.from({ length: n }, (_, i) => specFrom(`${seed}:face:${page}:${i}`));
}

const WOMEN = new Set(Object.values(namePools).flatMap((p) => p.women));

export function isFemaleName(first: string): boolean {
  return WOMEN.has(first);
}

function dressFor(npc: Npc, inSeminary: boolean): Dress {
  if (npc.role === 'bishop' || npc.tags.includes('bishop')) return 'bishop';
  if (npc.title === 'Msgr.') return 'monsignor';
  if (npc.role === 'classmate') return inSeminary ? 'seminarian' : 'priest';
  if (npc.title === 'Fr.' || npc.title === 'Bishop' || npc.title === 'Archbishop' || npc.title === 'Rev.') return 'priest';
  if (['priest', 'formator', 'pastor', 'chancery', 'vicar'].includes(npc.role)) return 'priest';
  return isFemaleName(npc.name.first) ? 'lay_f' : 'lay_m';
}

/** The face of an NPC in a given calendar year. */
export function portraitForNpc(npc: Npc, year: number, inSeminary = false): Portrait {
  const dress = dressFor(npc, inSeminary);
  const female = dress === 'lay_f';
  const spec = specFrom(`${npc.id}:${npc.name.first}:${npc.name.last}`);
  if (female) spec.facial = 0;
  return { spec, dress, age: Math.max(16, year - npc.birthYear), female };
}

/** The player's face: the chosen spec, or one from his name if the save predates faces. */
export function portraitForCharacter(c: Character, year: number, phase: string, title = ''): Portrait {
  const spec = parseSpec(c.portrait) ?? specFrom(`player:${c.name.first}:${c.name.last}`);
  const dress: Dress = phase === 'bishop' ? 'bishop' : title === 'Msgr.' ? 'monsignor' : phase === 'seminary' ? 'seminarian' : 'priest';
  return { spec, dress, age: Math.max(16, year - (c.entryYear - c.background.entryAge)), female: false };
}

/** A face from the parts the diocese preview may see: id, name, age. Seeds the same way as portraitForNpc. */
export function portraitFromParts(id: string, first: string, last: string, age: number, dress: Dress): Portrait {
  const female = dress === 'lay_f';
  const spec = specFrom(`${id}:${first}:${last}`);
  if (female) spec.facial = 0;
  return { spec, dress, age, female };
}

/** The player's calendar year, from the clock. */
export function yearOf(startDay: number, week: number): number {
  return new Date((startDay + week * 7) * 86_400_000).getUTCFullYear();
}
