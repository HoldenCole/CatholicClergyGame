import type { GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import castJson from '@/content/parish/cast.json';

/**
 * The living cast of a parish: the named parishioners who keep turning up,
 * each with a part (the sacristan, the flowers, an usher, the choir, the
 * counters, a young server, a widow, the one with opinions, the family).
 * The week names one of them now and then; the year moves them: a death, a
 * move away, a wedding, a baby, and someone new in the vacated part.
 * Requested in playtesting ("a living cast per parish"); numbers invented.
 */
export type CastRole = 'sacristan' | 'flowers' | 'usher' | 'choir' | 'counter' | 'youth' | 'widow' | 'arguer' | 'family';

export const CAST_ROLES: readonly CastRole[] = ['sacristan', 'flowers', 'usher', 'choir', 'counter', 'youth', 'widow', 'arguer', 'family'] as const;

export const CAST = {
  /** Share of weeks the parish's ambient line is about one of the cast. */
  lineChance: 0.4,
  /** A cast member's chance in a year of dying, by age. */
  death: { over80: 0.12, over70: 0.05, under: 0.006 },
  /** Of moving away, by age. */
  move: { young: 0.05, other: 0.02 },
  /** A young one's chance of marrying, and a married one's of a child, in a year. */
  marry: 0.08,
  birth: 0.07,
  /** A vacated part is filled by a new face the next year this often. */
  refill: 0.65,
} as const;

interface CastContent {
  roles: Record<CastRole, { label: string; lines: string[] }>;
  died: string[];
  moved: string[];
  married: string[];
  born: string[];
  arrived: string[];
  farewell: string[];
}
const content = castJson as unknown as CastContent;

export function castRoleOf(npc: Npc): CastRole | null {
  const tag = npc.tags.find((t) => t.startsWith('cast:'));
  const role = tag?.slice('cast:'.length);
  return role && (CAST_ROLES as readonly string[]).includes(role) ? (role as CastRole) : null;
}

export function castRoleLabel(role: CastRole): string {
  return content.roles[role].label;
}

export function isWoman(npc: Npc): boolean {
  return npc.tags.includes('woman');
}

/** Whether a person of this age and sex can hold a part. */
export function roleFits(role: CastRole, age: number, woman: boolean): boolean {
  switch (role) {
    case 'youth': return age < 26;
    case 'widow': return woman && age >= 66;
    case 'sacristan': return age >= 45;
    case 'flowers': return woman && age >= 40;
    case 'usher': return !woman && age >= 35;
    case 'counter': return age >= 35 && age < 78;
    case 'arguer': return age >= 30;
    case 'choir': return age >= 20;
    case 'family': return age >= 26 && age < 60;
  }
}

/** The part a newly rolled parishioner takes, the rarer fits first so the widow and the youth are not lost to the choir. */
export function castRoleFor(rng: Rng, age: number, woman: boolean, taken: readonly CastRole[]): CastRole | null {
  const order: CastRole[] = ['youth', 'widow', 'flowers', 'usher', 'sacristan', 'counter', 'arguer', 'choir', 'family'];
  const open = order.filter((r) => !taken.includes(r) && roleFits(r, age, woman));
  if (!open.length) return null;
  // Mostly the first fit, sometimes the next, so two runs do not hand out the same parts in the same order.
  return open.length > 1 && rng.chance(0.3) ? open[1]! : open[0]!;
}

/** How the parish says a name: a woman past forty-five is Mrs., a young one goes by the first name, the rest by both. */
export function castName(npc: Npc, year: number): string {
  const age = year - npc.birthYear;
  if (age < 26) return npc.name.first;
  if (isWoman(npc) && age >= 45) return `Mrs. ${npc.name.last}`;
  return `${npc.name.first} ${npc.name.last}`;
}

function fill(template: string, npc: Npc, year: number, extra: Record<string, string> = {}): string {
  const woman = isWoman(npc);
  const vars: Record<string, string> = {
    Name: castName(npc, year), first: npc.name.first, last: npc.name.last,
    he: woman ? 'she' : 'he', his: woman ? 'her' : 'his', him: woman ? 'her' : 'him', ...extra,
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

function yearOf(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/** The cast of the current parish, active, with a part. */
export function parishCast(state: GameState): Npc[] {
  const pid = state.assignment?.parishId;
  if (!pid) return [];
  return Object.values(state.npcs).filter((n) => n.role === 'lay' && n.status === 'active' && n.tags.includes(`parish:${pid}`) && castRoleOf(n) !== null);
}

/** The cast member with a part, for a feast line's placeholder; null when nobody holds it. */
export function castByRole(state: GameState, role: CastRole): Npc | null {
  return parishCast(state).find((n) => castRoleOf(n) === role) ?? null;
}

/** Fill {sacristan}, {usher}, {flowers}, {choir} in a template from the cast, or the plain word when nobody holds the part. */
export function fillCast(state: GameState, template: string): string {
  const year = yearOf(state);
  const plain: Record<string, string> = { sacristan: 'the sacristan', usher: 'an usher', flowers: 'the woman who does the flowers', choir: 'the choir', counter: 'the counters', widow: 'one of the widows', youth: 'one of the servers', arguer: 'a parishioner', family: 'one of the families' };
  return template.replace(/\{(sacristan|usher|flowers|choir|counter|widow|youth|arguer|family)\}/g, (_, role: CastRole) => {
    const npc = castByRole(state, role);
    return npc ? castName(npc, year) : plain[role]!;
  });
}

/** A week's line about one of the cast, or null when the ambient pools should speak instead. */
export function castLine(state: GameState, rng: Rng): string | null {
  const cast = parishCast(state);
  if (!cast.length || !rng.chance(CAST.lineChance)) return null;
  const npc = rng.pick(cast);
  const role = castRoleOf(npc)!;
  return fill(rng.pick(content.roles[role].lines), npc, yearOf(state));
}

const LINE_PATTERNS: RegExp[] = [
  ...Object.values(content.roles).flatMap((r) => r.lines),
  ...content.died, ...content.moved, ...content.married, ...content.born, ...content.arrived, ...content.farewell,
].map((t) => new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+?') + '$'));

/** Whether a digest line came from the cast, for the lane it sits in. */
export function isCastLine(line: string): boolean {
  return LINE_PATTERNS.some((p) => p.test(line));
}

/** The kind of year a cast member has. */
export type CastMove = { kind: 'died' | 'moved' | 'married' | 'born'; npc: Npc; line: string };

function rollMove(rng: Rng, npc: Npc, year: number, state: GameState): CastMove | null {
  const age = year - npc.birthYear;
  const death = age >= 80 ? CAST.death.over80 : age >= 70 ? CAST.death.over70 : CAST.death.under;
  if (rng.chance(death)) {
    const day = new Date((state.clock.startDay + state.clock.week * 7 + rng.int(0, 6)) * 86_400_000);
    return { kind: 'died', npc, line: fill(rng.pick(content.died), npc, year, { day: day.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) }) };
  }
  if (rng.chance(age < 32 ? CAST.move.young : CAST.move.other)) return { kind: 'moved', npc, line: fill(rng.pick(content.moved), npc, year) };
  const married = npc.tags.includes('married');
  if (!married && age >= 22 && age < 36 && rng.chance(CAST.marry)) return { kind: 'married', npc, line: fill(rng.pick(content.married), npc, year) };
  if (married && age >= 22 && age < 44 && rng.chance(CAST.birth)) {
    const girl = rng.chance(0.5);
    return { kind: 'born', npc, line: fill(rng.pick(content.born), npc, year, { child: girl ? 'girl' : 'boy', him2: girl ? 'her' : 'him' }) };
  }
  return null;
}

/**
 * The year among the people: at most two things happen, so the parish does
 * not empty in a season. A death or a move frees the part; `refillCast`
 * (called with a generator, so this file stays clear of generation) fills it.
 */
export function castYear(state: GameState, rng: Rng): { state: GameState; lines: string[]; vacated: CastRole[] } {
  const cast = parishCast(state);
  if (!cast.length) return { state, lines: [], vacated: [] };
  const year = yearOf(state);
  const moves: CastMove[] = [];
  for (const npc of rng.shuffle(cast)) {
    const m = rollMove(rng.derive(`cast:${npc.id}`), npc, year, state);
    if (m) moves.push(m);
    if (moves.length >= 2) break;
  }
  if (!moves.length) return { state, lines: [], vacated: [] };
  const npcs = { ...state.npcs };
  const vacated: CastRole[] = [];
  const week = state.clock.week;
  let career = state.career;
  for (const m of moves) {
    const npc = npcs[m.npc.id]!;
    if (m.kind === 'died') {
      npcs[npc.id] = { ...npc, status: 'dead', tags: [...npc.tags, `died:${week}`] };
      vacated.push(castRoleOf(npc)!);
      career = [...career, { week, kind: 'note', text: `Buried ${castName(npc, year)}, ${castRoleLabel(castRoleOf(npc)!)}.` }];
    } else if (m.kind === 'moved') {
      npcs[npc.id] = { ...npc, status: 'left', tags: [...npc.tags, `left:${week}`] };
      vacated.push(castRoleOf(npc)!);
    } else if (m.kind === 'married') {
      npcs[npc.id] = { ...npc, tags: [...npc.tags, 'married'], bonds: [...(npc.bonds ?? []), { kind: 'married', who: 'the two of them', week }], relationship: Math.min(100, npc.relationship + 6) };
    } else {
      npcs[npc.id] = { ...npc, bonds: [...(npc.bonds ?? []), { kind: 'baptized', who: `${isWoman(npc) ? 'her' : 'his'} child`, week }], relationship: Math.min(100, npc.relationship + 4) };
    }
  }
  return { state: { ...state, npcs, career }, lines: moves.map((m) => m.line), vacated };
}

/** The line for a new face in a vacated part, given the person the generator rolled. */
export function arrivalLine(rng: Rng, npc: Npc, role: CastRole, year: number, who: Npc | null): string {
  return fill(rng.pick(content.arrived), npc, year, { role: castRoleLabel(role), who: who ? castName(who, year) : 'the last one' });
}

/** The parts nobody holds, in the current parish. */
export function openRoles(state: GameState): CastRole[] {
  const held = parishCast(state).map((n) => castRoleOf(n)!);
  return CAST_ROLES.filter((r) => !held.includes(r));
}

/** The last Sunday: the cast at the door. Null when there is no cast to speak of. */
export function farewellLine(state: GameState, rng: Rng): string | null {
  const cast = parishCast(state);
  if (cast.length < 2) return null;
  const year = yearOf(state);
  const names = rng.shuffle(cast).slice(0, 3).map((n) => castName(n, year));
  const joined = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return fill(rng.pick(content.farewell), cast[0]!, year, { names: joined });
}
