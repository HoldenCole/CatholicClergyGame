import type { GameState, Npc, OrderHouse, ChapterLevel, ChapterOffice, StatKey } from '@/types';
import { createRng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';
import { dateOf } from '@/engine/time';
import { membersOf } from './house';
import { legibilityFromReputations } from './reputations';

/**
 * Who votes, who may be elected, and how each elector scores each man.
 * E3 §3.6 "The election model" and §8.3 "legibility". Every input is a
 * number the tests can set; the ballots are counted in systems/ballot.ts.
 * Weights are invented.
 */
export const ELECTORATE = {
  weights: { respect: 0.25, relationship: 0.28, record: 0.12, alignment: 0.12, age: 0.08, legibility: 0.15, ambition: -0.35 },
  /** Age bands: presumptuous under, caretaker over, by office. */
  age: { prior: [36, 72], provincial: [42, 70], general: [45, 68] } as Record<ChapterOffice, [number, number]>,
  /** Youngest a man may be elected, by office. */
  eligibleAge: { prior: 33, provincial: 38, general: 42 } as Record<ChapterOffice, number>,
  /** How much of an NPC's private ambition the brothers can see. */
  ambitionSeen: 0.7,
  /** A man who let it be known he is unwilling is scored at this share. */
  unwillingShare: 0.55,
  /** A man who declined twice is never scored. */
  declinedOut: 2,
  /** The story of the moment: a sermon that went round the province, a quarrel that did. One roll per man per chapter, shared by every elector. */
  moment: 9,
} as const;

/** The player's id in an electorate. */
export const PLAYER_ID = 'player';

export type ProvinceState = 'debt' | 'decline' | 'growth' | 'division';

/** What the moment requires: the chapter's reading of the province. */
export function provinceState(state: GameState): ProvinceState {
  const p = state.province;
  if (!p) return 'growth';
  if (p.finances.balance < 0) return 'debt';
  if (p.factions.hostility >= 70) return 'division';
  if (p.trajectory === 'shrinking') return 'decline';
  return 'growth';
}

export interface Voter {
  id: string;
  npc?: Npc;
  isPlayer: boolean;
  alignment: number;
  relationshipWithPlayer: number;
  houseId?: string;
}

export interface Contender {
  id: string;
  name: string;
  isPlayer: boolean;
  stats: Record<StatKey, number>;
  age: number;
  alignment: number;
  /** 0..100 as the province can see it. */
  ambition: number;
  /** 0..100: the record of his last posts. */
  record: number;
  legibility: number;
  houseId?: string;
  /** He let it be known, privately. */
  unwilling?: boolean;
}

function ageOf(state: GameState, npc: Npc): number {
  return dateOf(state.clock).year - npc.birthYear;
}

function playerAge(state: GameState): number {
  const c = state.character;
  return c ? dateOf(state.clock).year - (c.entryYear - c.background.entryAge) : 45;
}

function solemn(n: Npc): boolean {
  return n.status === 'active' && n.tags.includes('vows:solemn') && !n.tags.includes('lay_brother');
}

function playerSolemn(state: GameState): boolean {
  return !!state.religious?.vows.solemnWeek || !!state.flags.ordained;
}

/** The record of an NPC's posts: offices held and years, as the tags and age carry them. */
function npcRecord(state: GameState, n: Npc): number {
  let r = 40;
  if (n.tags.includes('prior')) r += 20;
  if (n.tags.includes('councilor')) r += 15;
  if (n.tags.includes('provincial')) r += 15;
  r += Math.min(15, Math.max(0, ageOf(state, n) - 40) * 0.6);
  return Math.min(100, r);
}

function npcLegibility(state: GameState, n: Npc): number {
  let l = 25;
  for (const tag of ['prior', 'councilor', 'provincial', 'novice_master', 'regent']) if (n.tags.includes(tag)) l += 18;
  l += Math.min(20, Math.max(0, ageOf(state, n) - 45));
  return Math.min(100, l);
}

/** The player's record and legibility from what he has done, until §8's reputations feed them. */
export function playerRecord(state: GameState): number {
  const r = state.religious;
  if (!r) return 40;
  let rec = 40 + r.obedience.accepted * 6 - r.obedience.reluctant * 8 - r.obedience.refused * 25;
  rec += r.termsServed.length * 12;
  rec += Math.min(20, r.assignments.length * 3);
  return Math.max(0, Math.min(100, rec));
}

export function playerLegibility(state: GameState): number {
  const r = state.religious;
  if (!r) return 20;
  if (r.legibility !== undefined) return r.legibility;
  // The electorate votes for a reputation, not a stat sheet: what he is known for makes him legible, and offices held a little. E3 §8.3.
  const byOffice = 20 + r.termsServed.length * 15 + (r.office ? 15 : 0) + (r.preachingReputation ?? 0) * 0.4;
  return Math.max(0, Math.min(100, Math.max(byOffice, legibilityFromReputations(state) + r.termsServed.length * 5)));
}

/** The body a chapter sits for: the house's solemnly professed, or the province's delegates. */
export function electorsOf(state: GameState, level: ChapterLevel, bodyId: string): Voter[] {
  const houses = Object.values(state.orderHouses ?? {}).filter((h) => h.provinceId === state.religious?.provinceId);
  const out: Voter[] = [];
  const add = (n: Npc, houseId: string) => out.push({ id: n.id, npc: n, isPlayer: false, alignment: n.alignment, relationshipWithPlayer: n.relationship, houseId });
  if (level === 'house') {
    const house = state.orderHouses?.[bodyId];
    if (!house) return out;
    for (const n of membersOf(state, house)) if (solemn(n)) add(n, house.id);
    if (playerSolemn(state) && state.religious?.houseId === house.id) out.push(playerVoter(state));
    return out;
  }
  // Provincial chapter: the provincial and council ex officio, every prior, and one delegate elected by each house (the man the house would send).
  const p = state.province;
  const seen = new Set<string>();
  const exOfficio = p ? [p.provincialId, ...p.councilIds] : [];
  for (const h of houses) {
    const members = membersOf(state, h).filter(solemn);
    const prior = members.find((m) => m.id === h.priorId);
    const picks = [...exOfficio.map((id) => members.find((m) => m.id === id)).filter((m): m is Npc => !!m), ...(prior ? [prior] : [])];
    const delegate = members.filter((m) => !picks.includes(m)).sort((a, b) => b.stats.charisma + b.relationship - (a.stats.charisma + a.relationship) || a.id.localeCompare(b.id))[0];
    if (delegate) picks.push(delegate);
    for (const m of picks) if (!seen.has(m.id)) {
      seen.add(m.id);
      add(m, h.id);
    }
  }
  if (playerSolemn(state) && (state.religious?.office || state.flags['chapter:delegate'])) out.push(playerVoter(state));
  return out;
}

function playerVoter(state: GameState): Voter {
  const v: Voter = { id: PLAYER_ID, isPlayer: true, alignment: state.character?.alignment ?? 0, relationshipWithPlayer: 100 };
  if (state.religious?.houseId) v.houseId = state.religious.houseId;
  return v;
}

/** Everyone the office could go to: solemnly professed priests of the body, of age, not term-limited, not twice-declined. */
export function contendersOf(state: GameState, office: ChapterOffice, bodyId: string): Contender[] {
  const r = state.religious;
  const order = r ? religiousOrder(r.order) : undefined;
  const pool: Npc[] = office === 'prior'
    ? (state.orderHouses?.[bodyId] ? membersOf(state, state.orderHouses[bodyId]!) : [])
    : Object.values(state.orderHouses ?? {}).filter((h) => h.provinceId === r?.provinceId).flatMap((h) => membersOf(state, h));
  const max = office === 'prior' ? order?.governance.priorMaxConsecutive ?? 2 : order?.governance.provincialMaxConsecutive ?? 2;
  const out: Contender[] = [];
  for (const n of pool) {
    if (!solemn(n) || n.title !== 'Fr.') continue;
    const age = ageOf(state, n);
    if (age < ELECTORATE.eligibleAge[office]) continue;
    // The incumbent, if he has served the most consecutive terms the constitutions allow, sits this one out.
    const incumbent = office === 'prior' ? state.orderHouses?.[bodyId]?.priorId === n.id : state.province?.provincialId === n.id;
    const served = Number(state.flags[`terms:${office}:${n.id}`] ?? (incumbent ? 1 : 0));
    if (incumbent && served >= max) continue;
    const c: Contender = { id: n.id, name: `${n.title} ${n.name.first} ${n.name.last}`, isPlayer: false, stats: n.stats, age, alignment: n.alignment, ambition: n.ambition * ELECTORATE.ambitionSeen, record: npcRecord(state, n), legibility: npcLegibility(state, n) };
    const house = houseOfNpc(state, n);
    if (house) c.houseId = house.id;
    out.push(c);
  }
  if (r && state.character && playerSolemn(state) && state.flags.ordained) {
    const inBody = office === 'prior' ? r.houseId === bodyId : true;
    const age = playerAge(state);
    const declined = r.declined?.[office] ?? 0;
    const consecutive = r.office?.office === office ? r.office.consecutive : 0;
    if (inBody && age >= ELECTORATE.eligibleAge[office] && declined < ELECTORATE.declinedOut && consecutive < max) {
      const c: Contender = { id: PLAYER_ID, name: `Fr. ${state.character.name.first} ${state.character.name.last}`, isPlayer: true, stats: state.character.stats, age, alignment: state.character.alignment, ambition: r.perceivedAmbition, record: playerRecord(state), legibility: playerLegibility(state), houseId: r.houseId };
      if (r.chapter?.actions.signal === 'unwilling') c.unwilling = true;
      out.push(c);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function houseOfNpc(state: GameState, n: Npc): OrderHouse | undefined {
  const tag = n.tags.find((t) => t.startsWith('house:'));
  return tag ? state.orderHouses?.[tag.slice(6)] : undefined;
}

/** Respect: the stats weighted by what the office needs now, 0..100. */
export function respectOf(state: GameState, c: Contender, office: ChapterOffice): number {
  const order = state.religious ? religiousOrder(state.religious.order) : undefined;
  const need = provinceState(state);
  // A copy: the order's table is content, and a prior's election must not lean the next one.
  const weights: Partial<Record<StatKey, number>> = { ...(order?.officeWeights?.[need] ?? { charisma: 1, piety: 1, administration: 1 }) };
  if (office === 'prior') weights.charisma = (weights.charisma ?? 0) + 0.5;
  let sum = 0;
  let total = 0;
  for (const [k, w] of Object.entries(weights) as [StatKey, number][]) {
    sum += c.stats[k] * w;
    total += w;
  }
  return total ? sum / total : 50;
}

function ageScore(age: number, office: ChapterOffice): number {
  const [lo, hi] = ELECTORATE.age[office];
  if (age < lo) return Math.max(0, 100 - (lo - age) * 12);
  if (age > hi) return Math.max(0, 100 - (age - hi) * 10);
  return 100;
}

/** An elector's private relationship with a man he is not the player: closeness on the line, the same house, and a stable pairwise roll. */
function relationshipBetween(seed: string, voter: Voter, c: Contender): number {
  if (c.isPlayer) return voter.isPlayer ? 100 : voter.relationshipWithPlayer;
  if (voter.isPlayer) return c.id ? (voter.npc ? 0 : 0) : 0;
  const rng = createRng(`${seed}:rel:${voter.id}:${c.id}`);
  const same = voter.houseId && voter.houseId === c.houseId ? 15 : 0;
  return Math.max(-100, Math.min(100, 100 - Math.abs(voter.alignment - c.alignment) * 0.6 - 40 + same + rng.gaussian() * 32));
}

/** One elector's score for one man. Deterministic from the seed. */
export function scoreFor(state: GameState, seed: string, voter: Voter, c: Contender, office: ChapterOffice): number {
  const w = ELECTORATE.weights;
  const respect = respectOf(state, c, office);
  const relationship = (relationshipBetween(seed, voter, c) + 100) / 2;
  const alignment = 100 - Math.abs(voter.alignment - c.alignment) / 2;
  const moment = createRng(`${seed}:moment:${c.id}`).gaussian() * ELECTORATE.moment;
  let score = respect * w.respect + relationship * w.relationship + c.record * w.record + alignment * w.alignment + ageScore(c.age, office) * w.age + c.legibility * w.legibility + c.ambition * w.ambition + moment;
  if (c.unwilling) score *= ELECTORATE.unwillingShare;
  return score;
}
