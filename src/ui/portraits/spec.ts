import type { Character, Npc } from '@/types';
import { namePools, type Heritage } from '@/content/names';

/**
 * A face is a handful of independent attributes. NPC faces derive from a
 * hash of the person (never stored, always the same); the player's is
 * chosen and adjusted at creation and kept on the character as a string.
 */
export interface PortraitSpec {
  /** 0..7, light to dark. */
  skin: number;
  /** 0 black, 1 dark brown, 2 brown, 3 light brown, 4 blond, 5 red, 6 auburn, 7 grey. Age overrides toward grey and white. */
  hairColor: number;
  /** 0..11. Men: short, parted, cropped, curly, waves, bald, receding, swept back, fringe, buzz, tight curls, long. Women: bob, long, up, curly, waves, short, bun, ponytail, braids, pixie, bangs, natural. */
  hairStyle: number;
  /** 0 none, 1 moustache, 2 full beard, 3 stubble, 4 goatee, 5 short beard. Men only. */
  facial: number;
  /** 0 none, 1 round, 2 square, 3 rimless, 4 thick. */
  glasses: number;
  /** 0 oval, 1 round, 2 long, 3 square, 4 heart, 5 wide. */
  face: number;
  /** 0 brown, 1 blue, 2 green, 3 hazel, 4 dark. */
  eyes: number;
  /** 0 neutral, 1 slight smile, 2 set, 3 downturned. */
  mouth: number;
  /** 0 straight, 1 arched, 2 heavy, 3 thin. */
  brows: number;
  /** 0 medium, 1 long, 2 broad. */
  nose: number;
  /** 0 none, 1 mole, 2 freckles, 3 scar. */
  mark: number;
}

export type Dress = 'lay_m' | 'lay_f' | 'seminarian' | 'priest' | 'monsignor' | 'bishop';

export interface Portrait {
  spec: PortraitSpec;
  dress: Dress;
  age: number;
  female: boolean;
}

export const SPEC_RANGES: Record<keyof PortraitSpec, number> = { skin: 8, hairColor: 8, hairStyle: 12, facial: 6, glasses: 5, face: 6, eyes: 5, mouth: 4, brows: 4, nose: 3, mark: 4 };
export const SPEC_KEYS = Object.keys(SPEC_RANGES) as (keyof PortraitSpec)[];

/** What each value is called, for the adjusting hand at creation. */
export const SPEC_LABELS: Record<keyof PortraitSpec, { label: string; values: string[] }> = {
  skin: { label: 'Complexion', values: ['fair', 'light', 'olive', 'tan', 'warm brown', 'brown', 'dark brown', 'deep'] },
  hairColor: { label: 'Hair', values: ['black', 'dark brown', 'brown', 'light brown', 'blond', 'red', 'auburn', 'grey'] },
  hairStyle: { label: 'Cut', values: ['short', 'parted', 'cropped', 'curly', 'waves', 'bald', 'receding', 'swept back', 'fringe', 'buzz', 'tight curls', 'long'] },
  facial: { label: 'Beard', values: ['clean-shaven', 'moustache', 'full beard', 'stubble', 'goatee', 'short beard'] },
  glasses: { label: 'Glasses', values: ['none', 'round', 'square', 'rimless', 'thick'] },
  face: { label: 'Face', values: ['oval', 'round', 'long', 'square', 'heart', 'wide'] },
  eyes: { label: 'Eyes', values: ['brown', 'blue', 'green', 'hazel', 'dark'] },
  mouth: { label: 'Mouth', values: ['even', 'a slight smile', 'set', 'downturned'] },
  brows: { label: 'Brows', values: ['straight', 'arched', 'heavy', 'thin'] },
  nose: { label: 'Nose', values: ['medium', 'long', 'broad'] },
  mark: { label: 'Mark', values: ['none', 'a mole', 'freckles', 'a scar'] },
};

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

/**
 * What a background makes likely: complexions, hair colours, eyes, and the
 * cuts that suit the hair, as weights the roll draws from. Everything stays
 * possible; nothing is a stereotype so much as a prior. A face is still a
 * handful of independent rolls (CLAUDE.md rule 4).
 */
export interface HeritageLook {
  skin: number[];
  hairColor: number[];
  eyes: number[];
  hairStyle?: number[];
}

const EURO_N: HeritageLook = { skin: [0, 1, 1, 2], hairColor: [0, 1, 2, 3, 4, 5, 6], eyes: [0, 1, 2, 3] };
const EURO_S: HeritageLook = { skin: [1, 2, 2, 3], hairColor: [0, 0, 1, 1, 2], eyes: [0, 0, 3, 4] };
const LATINO: HeritageLook = { skin: [2, 3, 3, 4, 4, 5], hairColor: [0, 0, 0, 1, 1], eyes: [0, 0, 4] };
const EAST_ASIAN: HeritageLook = { skin: [1, 2, 2, 3], hairColor: [0, 0, 0, 1], eyes: [4, 4, 0], hairStyle: [0, 1, 2, 4, 7, 8, 9] };
const SOUTH_ASIAN: HeritageLook = { skin: [3, 4, 4, 5, 6], hairColor: [0, 0, 1], eyes: [4, 0, 0] };
const AFRICAN: HeritageLook = { skin: [4, 5, 6, 6, 7, 7], hairColor: [0, 0, 0, 1], eyes: [4, 0, 0], hairStyle: [0, 2, 5, 6, 9, 9, 10, 10, 10] };
const AFRICAN_AMERICAN: HeritageLook = { skin: [3, 4, 5, 5, 6, 6, 7], hairColor: [0, 0, 0, 1], eyes: [4, 0, 0, 3], hairStyle: [0, 2, 5, 6, 9, 9, 10, 10, 10] };
const LEVANT: HeritageLook = { skin: [1, 2, 2, 3, 4], hairColor: [0, 0, 1, 1], eyes: [0, 0, 4, 3] };

export const HERITAGE_LOOKS: Record<Heritage, HeritageLook> = {
  irish: { skin: [0, 0, 1, 1], hairColor: [0, 1, 2, 3, 4, 5, 5, 6], eyes: [1, 1, 2, 0, 3] },
  italian: EURO_S,
  polish: EURO_N,
  german: EURO_N,
  anglo: EURO_N,
  mexican: LATINO,
  central_american: LATINO,
  caribbean: { skin: [2, 3, 4, 5, 6], hairColor: [0, 0, 0, 1], eyes: [0, 0, 4], hairStyle: [0, 1, 2, 3, 9, 10] },
  filipino: { skin: [2, 3, 3, 4], hairColor: [0, 0, 0, 1], eyes: [4, 0, 0], hairStyle: [0, 1, 2, 4, 7, 8, 9] },
  vietnamese: EAST_ASIAN,
  korean: EAST_ASIAN,
  african_american: AFRICAN_AMERICAN,
  nigerian: AFRICAN,
  indian: SOUTH_ASIAN,
  lebanese: LEVANT,
};

export const HERITAGE_LABEL: Record<Heritage, string> = {
  irish: 'Irish', italian: 'Italian', polish: 'Polish', german: 'German', anglo: 'Anglo-American', mexican: 'Mexican', central_american: 'Central American',
  caribbean: 'Caribbean', filipino: 'Filipino', vietnamese: 'Vietnamese', korean: 'Korean', african_american: 'African American', nigerian: 'Nigerian', indian: 'Indian', lebanese: 'Lebanese',
};

const SURNAME_HERITAGE = new Map<string, Heritage>();
for (const [h, pool] of Object.entries(namePools) as [Heritage, { last: string[] }][]) for (const last of pool.last) if (!SURNAME_HERITAGE.has(last)) SURNAME_HERITAGE.set(last, h);

/** The people a surname comes from, when the name pools know it. */
export function heritageOfName(last: string): Heritage | null {
  return SURNAME_HERITAGE.get(last) ?? null;
}

/** A spec from a seed string: every attribute takes its own hash so none correlate; a background weights the draw. */
export function specFrom(seed: string, heritage: Heritage | null = null): PortraitSpec {
  const out = {} as PortraitSpec;
  for (const k of SPEC_KEYS) out[k] = roll(`${seed}/${k}`, SPEC_RANGES[k]);
  const look = heritage ? HERITAGE_LOOKS[heritage] : null;
  if (look) {
    out.skin = look.skin[roll(`${seed}/skin-of`, look.skin.length)]!;
    out.hairColor = look.hairColor[roll(`${seed}/hair-of`, look.hairColor.length)]!;
    out.eyes = look.eyes[roll(`${seed}/eyes-of`, look.eyes.length)]!;
    if (look.hairStyle && roll(`${seed}/cut-of-them`, 4) !== 0) out.hairStyle = look.hairStyle[roll(`${seed}/cut-of`, look.hairStyle.length)]!;
  }
  // Glasses, beards, and marks are less common than a uniform draw would make them.
  if (roll(`${seed}/wears-glasses`, 3) !== 0) out.glasses = 0;
  if (roll(`${seed}/has-beard`, 2) !== 0) out.facial = 0;
  if (roll(`${seed}/marked`, 3) !== 0) out.mark = 0;
  return out;
}

export function serializeSpec(s: PortraitSpec): string {
  return `v2:${SPEC_KEYS.map((k) => s[k]).join('.')}`;
}

/** Reads v1 (nine attributes) and v2 (eleven); anything else is not a face. */
export function parseSpec(text: string): PortraitSpec | null {
  const m = /^v([12]):(.+)$/.exec(text);
  if (!m) return null;
  const parts = m[2]!.split('.').map(Number);
  const expected = m[1] === '1' ? 9 : SPEC_KEYS.length;
  if (parts.length !== expected || parts.some((n) => !Number.isInteger(n))) return null;
  const out = {} as PortraitSpec;
  SPEC_KEYS.forEach((k, i) => {
    const n = parts[i] ?? 0;
    out[k] = ((n % SPEC_RANGES[k]) + SPEC_RANGES[k]) % SPEC_RANGES[k];
  });
  return out;
}

/** Step one attribute forward or back, wrapping. */
export function adjustSpec(s: PortraitSpec, key: keyof PortraitSpec, dir: 1 | -1): PortraitSpec {
  const n = SPEC_RANGES[key];
  return { ...s, [key]: (s[key] + dir + n) % n };
}

/** A page of faces to choose from at creation, deterministic in the run's seed, drawn for a background when one is chosen. */
export function facesFor(seed: string, page: number, n = 8, heritage: Heritage | null = null): PortraitSpec[] {
  return Array.from({ length: n }, (_, i) => specFrom(`${seed}:face:${page}:${i}${heritage ? `:${heritage}` : ''}`, heritage));
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
  const spec = specFrom(`${npc.id}:${npc.name.first}:${npc.name.last}`, heritageOfName(npc.name.last));
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
  const spec = specFrom(`${id}:${first}:${last}`, heritageOfName(last));
  if (female) spec.facial = 0;
  return { spec, dress, age, female };
}

/** The player's calendar year, from the clock. */
export function yearOf(startDay: number, week: number): number {
  return new Date((startDay + week * 7) * 86_400_000).getUTCFullYear();
}
