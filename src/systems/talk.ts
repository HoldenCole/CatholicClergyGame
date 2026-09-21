import type { Condition, Effect, GameState, Npc, Rumour, TalkState } from '@/types';
import type { Rng } from '@/engine/rng';
import rumoursJson from '@/content/rumours.json';
import { applyEffects } from '@/engine/effects';
import { seasonOf } from '@/engine/time';
import { lifeOf } from './lives';
import { sinceArrival } from './trajectory';
import { strainOf, WEEK } from './week';

/**
 * The presbyterate as people who talk. DESIGN §8.12: rumours seeded by
 * what actually happened (to him, from his own record; to the men he
 * watches, from a snapshot diffed week to week), true or distorted, going
 * round at once and reaching him later at a venue, moving his standing
 * with his brothers as they go, and reaching the bishop a step later
 * unless he answers them first.
 */
interface KindDef { about: 'you' | 'other'; standing: number; true: string[]; false: string[] }
interface VenueDef { id: string; label: string; weight: number; when?: string }
const content = rumoursJson as unknown as { truth: number; spawnChance: number; hearChance: number; hearAboutYouChance: number; bishopWeeks: [number, number]; kinds: Record<string, KindDef>; venues: { diocesan: VenueDef[]; religious: VenueDef[] }; aboutYouHeard: string[] };

export const TALK = {
  truth: content.truth,
  spawnChance: content.spawnChance,
  hearChance: content.hearChance,
  hearAboutYouChance: content.hearAboutYouChance,
  bishopWeeks: content.bishopWeeks,
  /** Weeks a fact stays fresh enough to talk about. */
  freshWeeks: 6,
  /** The same kind about him is not talked about again inside this. */
  repeatWeeks: 104,
  /** A rumour heard counts for a condition this long. */
  heardWindow: 26,
  /** Kept rumours. */
  keep: 40,
  /** The bishop's ear: what a rumour about him does to the chancery when it gets there, as a share of its standing. */
  bishopShare: 0.7,
} as const;

export const RUMOUR_KINDS: readonly string[] = Object.keys(content.kinds);

export function talkOf(state: GameState): TalkState {
  return state.talk ?? { rumours: [], snapshot: {} };
}

function nameOf(npc: Npc): string {
  return `${npc.title || 'Fr.'} ${npc.name.last}`;
}

function playerName(state: GameState): string {
  return `Fr. ${state.character?.name.last ?? ''}`.trim();
}

/** The men whose lives the presbyterate talks about: the deanery, the pastor above him, his classmates, his confreres. */
export function watched(state: GameState): Npc[] {
  const out = new Map<string, Npc>();
  const pid = state.assignment?.parishId;
  const deanery = state.parish?.deanery ?? state.religious?.deanery;
  for (const id of deanery?.priestIds ?? []) { const n = state.npcs[id]; if (n) out.set(n.id, n); }
  if (pid) for (const n of Object.values(state.npcs)) if (n.tags.includes(`pastor:${pid}`)) out.set(n.id, n);
  for (const n of Object.values(state.npcs)) if (n.role === 'classmate') out.set(n.id, n);
  const house = state.religious?.houseId ? state.orderHouses?.[state.religious.houseId] : undefined;
  for (const id of house?.memberIds ?? []) { const n = state.npcs[id]; if (n) out.set(n.id, n); }
  return [...out.values()];
}

const MARKS = ['chancery', 'pastor', 'bishop_elsewhere', 'scandal'] as const;

function snapshotOf(npc: Npc, inDeanery: boolean): string {
  return `${npc.status}|${MARKS.filter((m) => npc.tags.includes(m)).join(',')}|${lifeOf(npc)?.id ?? ''}|${inDeanery ? 'd' : ''}`;
}

/** What changed for a watched man since the snapshot, as rumour kinds. */
function changesOf(before: string | undefined, after: string): string[] {
  if (before === undefined) return [];
  const [s0, m0, l0, d0] = before.split('|');
  const [s1, m1, l1, d1] = after.split('|');
  const out: string[] = [];
  if (s0 === 'active' && s1 === 'left') out.push('left');
  if (s0 !== 'dead' && s1 === 'dead') out.push('died');
  const marks0 = new Set((m0 ?? '').split(',').filter(Boolean));
  for (const m of (m1 ?? '').split(',').filter(Boolean)) if (!marks0.has(m)) out.push(m === 'chancery' ? 'named_chancery' : m === 'pastor' ? 'named_pastor' : m === 'bishop_elsewhere' ? 'named_bishop' : 'scandal');
  if (l1 && l1 !== l0 && content.kinds[`life_${l1}`]) out.push(`life_${l1}`);
  if (d0 === 'd' && d1 !== 'd' && s1 === 'active') out.push('moved');
  return out;
}

function recent(state: GameState, kind: string, about: string): boolean {
  return talkOf(state).rumours.some((r) => r.kind === kind && r.about === about && state.clock.week - r.week < TALK.repeatWeeks);
}

/** The facts of his own record fresh enough to talk about. */
function factsAboutHim(state: GameState): string[] {
  const week = state.clock.week;
  const out: string[] = [];
  const fresh = (w: unknown) => typeof w === 'number' && week - w >= 0 && week - w <= TALK.freshWeeks;
  for (const e of state.career) {
    if (!fresh(e.week)) continue;
    if (e.kind === 'passed_over') out.push('passed_over');
    if (e.kind === 'promotion') out.push('named');
    if (e.kind === 'position') out.push('stand');
  }
  if (fresh(state.flags['column:last'])) out.push('column');
  if (Object.keys(state.flags).some((k) => k.startsWith('request:') && state.flags[k] === true)) out.push('wants_out');
  if (state.flags['town:winter_shelter']) out.push('shelter');
  if (state.flags['town:sold_the_lot']) out.push('sold_lot');
  if (strainOf(state) >= WEEK.strainWorn) out.push('tired');
  if (state.parish && state.parish.weeksServed >= 52 && state.parish.weeksServed % 52 < 2) {
    const verdict = sinceArrival(state)?.verdict;
    if (verdict === 'Turning around') out.push('turnaround');
    if (verdict === 'Going under') out.push('decline');
  }
  return [...new Set(out)];
}

function fill(template: string, name: string, state: GameState): string {
  const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId)?.name ?? 'the parish';
  return template.replace(/\{name\}/g, name).replace(/\{parish\}/g, parish);
}

function spawn(state: GameState, rng: Rng, kind: string, about: string, name: string): Rumour {
  const def = content.kinds[kind]!;
  const isTrue = rng.chance(TALK.truth) || !def.false.length;
  const pool = isTrue ? def.true : def.false;
  const week = state.clock.week;
  return {
    id: `${kind}:${about}:${week}`,
    kind, about, name, true: isTrue,
    text: fill(rng.pick(pool), name, state),
    week,
    standing: def.standing,
    ...(about === 'you' ? { bishopWeek: week + rng.int(TALK.bishopWeeks[0], TALK.bishopWeeks[1]) } : {}),
  };
}

function reputationKey(state: GameState, who: 'brothers' | 'bishop'): string {
  if (state.religious) return who === 'brothers' ? 'community' : 'local_bishop';
  return who === 'brothers' ? 'brother_priests' : 'chancery';
}

function venuesFor(state: GameState): VenueDef[] {
  const season = seasonOf(state.clock);
  return (state.religious && !state.parish ? content.venues.religious : content.venues.diocesan).filter((v) => !v.when || v.when === season);
}

/**
 * The week: the watched men are compared with the snapshot and his own
 * record is read for fresh facts; some of it becomes talk, true or not,
 * and talk about him moves his standing at once. One rumour he has not
 * heard may reach him, at a venue; one about him may reach the bishop.
 */
export function talkWeek(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  if (!state.character) return { state, lines: [] };
  const week = state.clock.week;
  const talk = talkOf(state);
  const lines: string[] = [];
  let rumours = [...talk.rumours];
  let next = state;
  // The watched men, diffed.
  const deaneryIds = new Set((state.parish?.deanery ?? state.religious?.deanery)?.priestIds ?? []);
  const snapshot: Record<string, string> = {};
  const first = Object.keys(talk.snapshot).length === 0;
  for (const npc of watched(state)) {
    const now = snapshotOf(npc, deaneryIds.has(npc.id));
    snapshot[npc.id] = now;
    if (first) continue;
    const changes = changesOf(talk.snapshot[npc.id], now);
    let talked = false;
    for (const kind of changes) {
      if (recent(next, kind, npc.id)) { talked = true; continue; }
      if (!rng.derive(`spawn:${kind}:${npc.id}:${week}`).chance(TALK.spawnChance)) continue;
      rumours.push(spawn(next, rng.derive(`rumour:${kind}:${npc.id}:${week}`), kind, npc.id, nameOf(npc)));
      talked = true;
    }
    // A change nobody picked up this week is still there to be noticed next week.
    if (changes.length && !talked) snapshot[npc.id] = talk.snapshot[npc.id]!;
  }
  // A man moved out of the deanery keeps his old snapshot until it is seen once more, so the move is noticed.
  for (const [id, snap] of Object.entries(talk.snapshot)) if (!snapshot[id] && snap.endsWith('|d')) {
    const npc = state.npcs[id];
    if (npc && npc.status === 'active' && !recent(next, 'moved', id) && rng.derive(`spawn:moved:${id}:${week}`).chance(TALK.spawnChance)) rumours.push(spawn(next, rng.derive(`rumour:moved:${id}:${week}`), 'moved', id, nameOf(npc)));
  }
  // His own record.
  for (const kind of factsAboutHim(next)) {
    if (recent(next, kind, 'you') || !rng.derive(`spawn:${kind}:you:${week}`).chance(TALK.spawnChance)) continue;
    const r = spawn(next, rng.derive(`rumour:${kind}:you:${week}`), kind, 'you', playerName(next));
    rumours.push(r);
    if (r.standing) next = applyEffects(next, [{ target: 'reputation', key: reputationKey(next, 'brothers'), delta: r.standing }], {}, 'what the men are saying');
  }
  // One reaches him.
  const unheard = rumours.filter((r) => r.heardWeek === undefined && r.week < week);
  if (unheard.length && rng.derive(`hear:${week}`).chance(TALK.hearChance)) {
    const r = unheard[0]!;
    const aboutYou = r.about === 'you';
    if (!aboutYou || rng.derive(`hear-you:${week}`).chance(TALK.hearAboutYouChance)) {
      const venues = venuesFor(next);
      const venue = rng.derive(`venue:${week}`).weighted(venues, (v) => v.weight);
      rumours = rumours.map((x) => (x.id === r.id ? { ...x, heardWeek: week, venue: venue.id } : x));
      lines.push(aboutYou ? rng.derive(`heard-line:${week}`).pick(content.aboutYouHeard).replace('{text}', r.text).replace('{venue}', venue.label) : `${venue.label}: ${r.text}`);
    }
  }
  // One about him reaches the bishop.
  for (const r of rumours) {
    if (r.about !== 'you' || r.reachedBishop || r.answered === 'correct' || r.bishopWeek === undefined || r.bishopWeek > week) continue;
    rumours = rumours.map((x) => (x.id === r.id ? { ...x, reachedBishop: true } : x));
    const delta = Math.round(r.standing * TALK.bishopShare);
    if (delta) next = applyEffects(next, [{ target: 'reputation', key: reputationKey(next, 'bishop'), delta }], {}, 'what reached the bishop');
    next = { ...next, career: [...next.career, { week, kind: 'note', text: `The bishop has heard what is being said: ${r.text}` }] };
  }
  rumours = rumours.slice(-TALK.keep);
  return { state: { ...next, talk: { rumours, snapshot } }, lines };
}

/** Rumours heard in the window and not yet answered, newest first. */
export function heardRumours(state: GameState, within = TALK.heardWindow): Rumour[] {
  const week = state.clock.week;
  return talkOf(state).rumours.filter((r) => r.heardWeek !== undefined && week - r.heardWeek <= within && !r.answered).sort((a, b) => b.heardWeek! - a.heardWeek!);
}

/** Every rumour he has heard, newest first, for the sheet. */
export function whatTheySay(state: GameState, count = 8): Rumour[] {
  return talkOf(state).rumours.filter((r) => r.heardWeek !== undefined).sort((a, b) => b.heardWeek! - a.heardWeek!).slice(0, count);
}

export function venueLabel(id: string | undefined): string {
  const all = [...content.venues.diocesan, ...content.venues.religious];
  return all.find((v) => v.id === id)?.label ?? 'Somewhere';
}

export function rumourCondition(state: GameState, cond: Extract<Condition, { type: 'rumour' }>): boolean {
  const heard = heardRumours(state);
  switch (cond.key) {
    case 'about_you_false': return heard.some((r) => r.about === 'you' && !r.true);
    case 'about_you_true': return heard.some((r) => r.about === 'you' && r.true);
    case 'about_other': return heard.some((r) => r.about !== 'you' && state.npcs[r.about]?.status === 'active');
    case 'reached_bishop': return heard.some((r) => r.about === 'you' && r.reachedBishop);
  }
}

/** The subject of the latest rumour heard about another man. */
export function rumourSubject(state: GameState): Npc | null {
  const r = heardRumours(state).find((x) => x.about !== 'you');
  return r ? state.npcs[r.about] ?? null : null;
}

/** The rumour effect: answer the latest heard rumour of the kind the key fits. */
export function applyRumourEffect(state: GameState, effect: Effect): GameState {
  const answer = effect.key as Rumour['answered'];
  const heard = heardRumours(state);
  const target = answer === 'defend' || answer === 'join' ? heard.find((r) => r.about !== 'you') : heard.find((r) => r.about === 'you');
  if (!target || !answer) return state;
  const rumours = talkOf(state).rumours.map((r) => (r.id === target.id ? { ...r, answered: answer } : r));
  return { ...state, talk: { ...talkOf(state), rumours } };
}

/** The review's row: what was said of him this year. Null when nothing was. */
export function talkReviewLine(state: GameState, sinceWeek: number): string | null {
  const mine = talkOf(state).rumours.filter((r) => r.about === 'you' && r.week > sinceWeek);
  if (!mine.length) return null;
  const untrue = mine.filter((r) => !r.true).length;
  const bishop = mine.filter((r) => r.reachedBishop).length;
  const heard = mine.filter((r) => r.heardWeek !== undefined).length;
  return `${mine.length === 1 ? 'One thing' : `${mine.length} things`} went round about you${untrue ? `, ${untrue === mine.length ? (mine.length === 1 ? 'untrue' : 'all untrue') : `${untrue} untrue`}` : ''}; you heard ${heard === mine.length ? (mine.length === 1 ? 'it' : 'all of it') : heard === 0 ? 'none of it' : `${heard} of them`}${bishop ? `; ${bishop === 1 ? 'one' : bishop} reached the bishop` : ''}.`;
}
