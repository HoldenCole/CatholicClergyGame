import type { Condition, Effect, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import livesJson from '@/content/lives.json';
import { applyEffects } from '@/engine/effects';
import { STAFF_LABEL, staffOf } from './staff';
import { currentHouse, membersOf } from './religious/house';
import { isWomansName } from '@/generation/names';

/**
 * Lives that move without you. DESIGN §8.11: every named person in the
 * man's orbit carries a clock. A year at a time, one of the lives in
 * content/lives.json may begin for them, runs its years, and resolves one
 * way or another; the record says so when it crosses his path, the sheets
 * show it under the name, and scenes hang on it through `npc_life` and
 * the `@life:<id>` selector.
 */
export type LifeWho = 'staff' | 'clergy' | 'classmate' | 'family' | 'director' | 'confrere';

export interface LifeOutcome {
  kind: string;
  weight: number;
  line: string;
  line_man?: string;
  status?: Npc['status'];
  mark?: string;
  effects?: Effect[];
}

export interface LifeDef {
  id: string;
  who: LifeWho[];
  tags?: string[];
  women?: boolean;
  men?: boolean;
  married?: boolean;
  ages?: [number, number];
  weight: number;
  years: [number, number];
  label: string;
  label_man?: string;
  line: string;
  line_man?: string;
  resolve: LifeOutcome[];
}

const content = livesJson as unknown as { chancePerYear: number; startsPerYear: number; lives: LifeDef[] };
export const lifeDefs: LifeDef[] = content.lives;
export const LIVES = { chancePerYear: content.chancePerYear, startsPerYear: content.startsPerYear } as const;

export function lifeDef(id: string): LifeDef | undefined {
  return lifeDefs.find((l) => l.id === id);
}

/** Someone in the man's orbit, and what he is to him. */
export interface OrbitEntry {
  npc: Npc;
  who: LifeWho;
  /** The desk, or mother/father/sibling. */
  tag?: string;
}

/** The named people whose lives he would hear about: staff, the clergy around him, classmates, family, his director, his confreres. */
export function orbit(state: GameState): OrbitEntry[] {
  const out: OrbitEntry[] = [];
  const seen = new Set<string>();
  const add = (npc: Npc | null | undefined, who: LifeWho, tag?: string) => {
    if (!npc || npc.status !== 'active' || seen.has(npc.id)) return;
    seen.add(npc.id);
    out.push({ npc, who, ...(tag ? { tag } : {}) });
  };
  const pid = state.assignment?.parishId;
  if (state.parish && pid) for (const { tag, npc } of staffOf(state)) add(npc, 'staff', tag);
  // One pass over the people for the rest: the deacon and the pastor here, the classmates, the family.
  const all = Object.values(state.npcs);
  if (state.parish && pid) {
    add(all.find((n) => n.status === 'active' && n.tags.includes('deacon') && n.tags.includes(`parish:${pid}`)), 'staff', 'deacon');
    add(all.find((n) => n.status === 'active' && n.tags.includes(`pastor:${pid}`)), 'clergy');
  }
  const deanery = state.parish?.deanery ?? state.religious?.deanery;
  for (const id of deanery?.priestIds ?? []) add(state.npcs[id], 'clergy');
  for (const n of all) {
    if (n.role === 'classmate') add(n, 'classmate');
    else if (n.role === 'family') { const tag = (['mother', 'father', 'sibling'] as const).find((t) => n.tags.includes(t)); if (tag) add(n, 'family', tag); }
  }
  const directorId = state.character?.direction?.endedWeek === undefined ? state.character?.direction?.npcId : undefined;
  if (directorId) add(state.npcs[directorId], 'director');
  const house = currentHouse(state);
  if (house) for (const n of membersOf(state, house)) add(n, 'confrere');
  return out;
}

/** The life open on a person, if any. */
export function lifeOf(npc: Npc): { id: string; since: number; until: number } | null {
  const id = npc.tags.find((t) => t.startsWith('life:') && !t.startsWith('life:since:') && !t.startsWith('life:until:'))?.slice(5);
  if (!id) return null;
  const since = Number(npc.tags.find((t) => t.startsWith('life:since:'))?.slice(11) ?? 0);
  const until = Number(npc.tags.find((t) => t.startsWith('life:until:'))?.slice(11) ?? 0);
  return { id, since, until };
}

function isWoman(npc: Npc, tag?: string): boolean {
  if (npc.tags.includes('woman') || tag === 'mother') return true;
  if (npc.tags.includes('man') || tag === 'father' || npc.role === 'priest' || npc.role === 'classmate' || npc.role === 'religious' || npc.title) return false;
  return isWomansName(npc.name.first);
}

function nameOf(entry: OrbitEntry): string {
  const { npc, who, tag } = entry;
  if (who === 'family') return tag === 'mother' ? 'your mother' : tag === 'father' ? 'your father' : npc.name.first;
  if (who === 'clergy' || who === 'classmate' || who === 'director' || who === 'confrere') return `${npc.title || 'Fr.'} ${npc.name.last}`;
  return `${npc.name.first} ${npc.name.last}`;
}

function roleOf(entry: OrbitEntry): string {
  const { who, tag } = entry;
  if (who === 'staff') return tag === 'deacon' ? 'the deacon' : STAFF_LABEL[tag ?? ''] ?? 'the staff';
  if (who === 'family') return tag === 'mother' ? 'your mother' : tag === 'father' ? 'your father' : 'your sibling';
  if (who === 'clergy') return 'a priest of the deanery';
  if (who === 'classmate') return 'a classmate';
  if (who === 'director') return 'your director';
  return 'a brother of the house';
}

export function fillLife(template: string, entry: OrbitEntry): string {
  const woman = isWoman(entry.npc, entry.tag);
  const name = nameOf(entry);
  const vars: Record<string, string> = {
    name, Name: name.charAt(0).toUpperCase() + name.slice(1), first: entry.npc.name.first, role: roleOf(entry),
    he: woman ? 'she' : 'he', He: woman ? 'She' : 'He', his: woman ? 'her' : 'his', His: woman ? 'Her' : 'His', him: woman ? 'her' : 'him', himself: woman ? 'herself' : 'himself',
  };
  const out = template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function pick<T extends { line: string; line_man?: string }>(x: T, woman: boolean): string {
  return !woman && x.line_man ? x.line_man : x.line;
}

/** The short state for a sheet: "her husband ill, since March", or null. */
export function lifeLabel(state: GameState, npc: Npc): string | null {
  const open = lifeOf(npc);
  if (!open) return null;
  const def = lifeDef(open.id);
  if (!def) return null;
  const entry = orbit(state).find((e) => e.npc.id === npc.id) ?? { npc, who: 'staff' as LifeWho };
  const woman = isWoman(npc, entry.tag);
  const label = fillLife(!woman && def.label_man ? def.label_man : def.label, entry).replace(/^./, (c) => c.toLowerCase());
  const years = Math.floor((state.clock.week - open.since) / 52);
  return years <= 0 ? label : `${label}, ${years === 1 ? 'a year' : `${years} years`} now`;
}

function fits(def: LifeDef, entry: OrbitEntry, age: number): boolean {
  if (!def.who.includes(entry.who)) return false;
  if (def.tags && !(entry.tag && def.tags.includes(entry.tag))) return false;
  const woman = isWoman(entry.npc, entry.tag);
  if (def.women && !woman) return false;
  if (def.men && woman) return false;
  if (def.ages && (age < def.ages[0] || age > def.ages[1])) return false;
  if (def.married && (entry.npc.tags.includes('widowed') || entry.npc.tags.includes('divorced') || (!entry.npc.tags.includes('married') && !(entry.who === 'family' && entry.tag !== 'sibling')))) return false;
  if (entry.npc.tags.some((t) => t === `lived:${def.id}`)) return false;
  return true;
}

function yearOf(state: GameState): number {
  return new Date((state.clock.startDay + state.clock.week * 7) * 86_400_000).getUTCFullYear();
}

/**
 * The year among the people around him: the lives that reached their end
 * resolve, and a few new ones begin. At most `startsPerYear` begin.
 */
export function livesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  const week = state.clock.week;
  const year = yearOf(state);
  // Resolutions first, so a life that ends this year is not replaced in the same breath.
  for (const entry of orbit(next)) {
    const open = lifeOf(entry.npc);
    if (!open || open.until > week) continue;
    const def = lifeDef(open.id);
    const npc = next.npcs[entry.npc.id]!;
    const rest = npc.tags.filter((t) => !t.startsWith('life:'));
    if (!def) { next = { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, tags: rest } } }; continue; }
    const r = rng.derive(`life:end:${npc.id}:${week}`);
    const outcome = r.weighted(def.resolve, (o) => o.weight);
    const tags = [...rest, `lived:${def.id}`, ...(outcome.mark ? [outcome.mark] : [])];
    const moved: Npc = { ...npc, tags, ...(outcome.status ? { status: outcome.status } : {}) };
    next = { ...next, npcs: { ...next.npcs, [npc.id]: moved } };
    if (outcome.effects?.length) next = applyEffects(next, outcome.effects, { '@life': npc.id }, `${nameOf(entry)}'s year`);
    lines.push(fillLife(pick(outcome, isWoman(npc, entry.tag)), { ...entry, npc: moved }));
    if (outcome.status === 'dead') next = { ...next, career: [...next.career, { week, kind: 'note', text: `${fillLife('{Name}', entry)} died.` }] };
  }
  // New lives.
  let starts = 0;
  for (const entry of rng.shuffle(orbit(next))) {
    if (starts >= LIVES.startsPerYear) break;
    if (lifeOf(entry.npc)) continue;
    const r = rng.derive(`life:start:${entry.npc.id}:${week}`);
    if (!r.chance(LIVES.chancePerYear)) continue;
    const age = year - entry.npc.birthYear;
    const open = lifeDefs.filter((d) => fits(d, entry, age));
    if (!open.length) continue;
    const def = r.weighted(open, (d) => d.weight);
    const until = week + r.int(def.years[0], def.years[1]) * 52;
    const npc = next.npcs[entry.npc.id]!;
    next = { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, tags: [...npc.tags, `life:${def.id}`, `life:since:${week}`, `life:until:${until}`] } } };
    lines.push(fillLife(pick(def, isWoman(npc, entry.tag)), entry));
    starts++;
  }
  return { state: next, lines };
}

/** The people in his orbit with a life open, for a condition, a selector, or the review. */
export function openLives(state: GameState, id?: string, who?: LifeWho): OrbitEntry[] {
  return orbit(state).filter((e) => { const l = lifeOf(e.npc); return !!l && (!id || l.id === id) && (!who || e.who === who); });
}

export function lifeCondition(state: GameState, cond: Extract<Condition, { type: 'npc_life' }>): boolean {
  return openLives(state, cond.key, cond.who).length > 0;
}

/** The `@life:<id>` selector: the person in his orbit with that life open, the first by id. */
export function lifeSelector(state: GameState, id: string): Npc | null {
  const found = openLives(state, id).sort((a, b) => (a.npc.id < b.npc.id ? -1 : 1));
  return found[0]?.npc ?? null;
}

/** The review's row: who around him is carrying something this year. Null when nobody is. */
export function livesReviewLine(state: GameState): string | null {
  const open = openLives(state);
  if (!open.length) return null;
  return open.slice(0, 4).map((e) => `${nameOf(e)}, ${lifeLabel(state, e.npc) ?? ''}`.replace(/, $/, '')).join('; ') + (open.length > 4 ? `; and ${open.length - 4} more` : '');
}
