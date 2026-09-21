import type { Effect, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyInternalForum } from '@/engine/internalForum';
import { generateClassmate } from '@/generation/classmates';
import { rollTrajectory } from '@/systems/trajectories';
import { dateOf } from '@/engine/time';
import { friarDeaneryPriests } from './deanery';
import { diocesanClassmates } from './diocesanClassmates';

/**
 * Direction given. E3 §3.13. A friar who teaches at the diocesan seminary
 * meets its men and may direct one; a friar the diocese's priests trust
 * is asked by them. What is said in direction is sealed exactly as the
 * player's own direction is (CLAUDE.md rule 7): every week of it runs
 * through the internal-forum resolver, which accepts only what changes
 * the friar himself and throws on anything the diocese could see. The
 * relationship with the directee is his own regard for the friar, not a
 * standing. Tunables are invented.
 */
export const DIRECTING = {
  slots: 3,
  /** Blocks a week each. */
  ap: 1,
  /** Chance a year a diocesan priest asks, at piety 50, plus per point of piety over it and of the presbyterate's regard. */
  priestBase: 0.12,
  perPiety: 0.006,
  perClergy: 0.004,
  /** Chance a year one of the seminary's men asks, when he teaches there. */
  seminarianChance: 0.5,
  /** Men the diocesan seminary sends him when he teaches there. */
  seminarians: [3, 4] as [number, number],
  /** What a year of directing a man does to the friar: interior only. */
  weekly: [{ target: 'stat', key: 'piety', delta: 0.02 }, { target: 'stat', key: 'charisma', delta: 0.015 }] as Effect[],
  askWeeks: 6,
} as const;

export function directees(state: GameState): { npcId: string; npc: Npc; sinceWeek: number; kind: 'seminarian' | 'priest' }[] {
  return (state.religious?.directees ?? []).map((d) => ({ ...d, npc: state.npcs[d.npcId]! })).filter((d) => !!d.npc && d.npc.status === 'active');
}

export function directingLoad(state: GameState): number {
  return directees(state).length * DIRECTING.ap;
}

/** The diocesan seminary's men, generated the year he begins to teach there. E3 §3.13. */
export function seminaryMenStart(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const did = state.world?.diocese.presetId;
  const teaching = r?.apostolate?.id === 'seminary_faculty';
  if (!r || !did || !teaching || r.seminarians?.[did]) return state;
  const year = dateOf(state.clock).year;
  const n = rng.int(...DIRECTING.seminarians);
  const npcs = { ...state.npcs };
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `dsem_${did}_${i + 1}`;
    const base = generateClassmate(rng.derive(`dsem:${i}`), i, year - rng.int(0, 3));
    npcs[id] = { ...base, id, tags: [...base.tags.filter((t) => t !== 'classmate'), 'diocesan_seminarian', 'seminarian', `diocese:${did}`], relationship: rng.int(-5, 15) };
    ids.push(id);
  }
  return {
    ...state,
    npcs,
    religious: { ...r, seminarians: { ...(r.seminarians ?? {}), [did]: ids } },
    flags: { ...state.flags, 'seminary:has_men': state.clock.week },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `The seminary's men: ${ids.map((id) => `${npcs[id]!.name.first} ${npcs[id]!.name.last}`).join(', ')}. They will be the diocese's priests.` }],
  };
}

/** The seminary's men are ordained four years after he met them, and become priests of that diocese. */
export function seminaryMenYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  if (!r?.seminarians) return state;
  const npcs = { ...state.npcs };
  let changed = false;
  for (const [did, ids] of Object.entries(r.seminarians)) {
    for (const id of ids) {
      const n = npcs[id];
      const met = Number(state.flags[`seminary:met:${id}`] ?? state.flags['seminary:has_men'] ?? state.clock.week);
      if (!n || n.status !== 'active' || n.role === 'priest' || state.clock.week - met < 52 * 4) continue;
      npcs[id] = { ...n, role: 'priest', title: 'Fr.', tags: [...n.tags.filter((t) => t !== 'seminarian'), 'priest', 'vicar', `diocese:${did}`], trajectory: rollTrajectory(rng.derive(`traj:${id}`), n) };
      changed = true;
    }
  }
  return changed ? { ...state, npcs, flags: { ...state.flags, 'seminary:men_ordained': state.clock.week } } : state;
}

function candidates(state: GameState, kind: 'seminarian' | 'priest'): Npc[] {
  const did = state.world?.diocese.presetId;
  const have = new Set((state.religious?.directees ?? []).map((d) => d.npcId));
  if (kind === 'seminarian') return (did ? (state.religious?.seminarians?.[did] ?? []) : []).map((id) => state.npcs[id]).filter((n): n is Npc => !!n && n.status === 'active' && n.role !== 'priest' && !have.has(n.id));
  const near = friarDeaneryPriests(state).map((p) => p.npc);
  const mates = diocesanClassmates(state).filter((n) => n.status === 'active' && n.role === 'priest' && n.tags.includes(`diocese:${did}`));
  const pool = [...near, ...mates].filter((n) => !have.has(n.id));
  if (pool.length) return pool;
  return Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'priest' && (!did || n.tags.includes(`diocese:${did}`)) && !have.has(n.id)).sort((a, b) => a.id.localeCompare(b.id));
}

/** A year: a man may ask him. Seminarians when he teaches; priests when the presbyterate trusts him and he is a man of prayer. */
export function directingYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !state.flags.ordained || r.directionAsk || directees(state).length >= DIRECTING.slots) return state;
  const teaching = r.apostolate?.id === 'seminary_faculty';
  let kind: 'seminarian' | 'priest' | null = null;
  if (teaching && rng.chance(DIRECTING.seminarianChance) && candidates(state, 'seminarian').length) kind = 'seminarian';
  else {
    const p = DIRECTING.priestBase + Math.max(0, c.stats.piety - 50) * DIRECTING.perPiety + (c.reputation.diocesan_clergy ?? 0) * DIRECTING.perClergy + (state.flags['career:the_confessor'] ? 0.15 : 0);
    if (rng.chance(Math.max(0.02, Math.min(0.8, p))) && candidates(state, 'priest').length) kind = 'priest';
  }
  if (!kind) return state;
  const pool = candidates(state, kind);
  const npc = rng.pick(pool);
  return { ...state, religious: { ...r, directionAsk: { npcId: npc.id, week: state.clock.week, kind } }, career: [...state.career, { week: state.clock.week, kind: 'note', text: `${npc.title ? `${npc.title} ` : ''}${npc.name.first} ${npc.name.last} asked whether you would direct him.` }] };
}

/** Yes or no to the man who asked. A no is his to remember; nothing else hears of it. */
export function answerDirectionAsk(state: GameState, yes: boolean): GameState {
  const r = state.religious;
  const ask = r?.directionAsk;
  if (!r || !ask) return state;
  const npc = state.npcs[ask.npcId];
  const { directionAsk: _gone, ...rest } = r;
  if (!npc) return { ...state, religious: rest };
  const who = `${npc.title ? `${npc.title} ` : ''}${npc.name.first} ${npc.name.last}`;
  if (!yes) return { ...state, religious: { ...rest, directingLine: `You told ${who} you could not, and gave him a name.` }, npcs: { ...state.npcs, [npc.id]: { ...npc, relationship: Math.max(-100, npc.relationship - 3) } } };
  return takeDirectee({ ...state, religious: { ...rest, directingLine: `${who} comes on the first Tuesday, and what he says stays in the room.` } }, npc.id, ask.kind);
}

export function takeDirectee(state: GameState, npcId: string, kind: 'seminarian' | 'priest'): GameState {
  const r = state.religious;
  const npc = state.npcs[npcId];
  if (!r || !npc || directees(state).length >= DIRECTING.slots || (r.directees ?? []).some((d) => d.npcId === npcId)) return state;
  const week = state.clock.week;
  const count = (r.directees ?? []).length + 1;
  return {
    ...state,
    religious: { ...r, directees: [...(r.directees ?? []), { npcId, sinceWeek: week, kind }] },
    npcs: { ...state.npcs, [npcId]: { ...npc, relationship: Math.min(100, npc.relationship + 5), tags: [...npc.tags, 'directee'] } },
    flags: { ...state.flags, [`directee:${kind}`]: week, 'directees:count': count },
    career: [...state.career, { week, kind: 'note', text: `Began directing ${npc.title ? `${npc.title} ` : ''}${npc.name.first} ${npc.name.last}.` }],
  };
}

export function endDirectee(state: GameState, npcId: string): GameState {
  const r = state.religious;
  const npc = state.npcs[npcId];
  if (!r?.directees?.some((d) => d.npcId === npcId)) return state;
  const directees = r.directees.filter((d) => d.npcId !== npcId);
  return {
    ...state,
    religious: { ...r, directees },
    npcs: npc ? { ...state.npcs, [npcId]: { ...npc, tags: npc.tags.filter((t) => t !== 'directee') } } : state.npcs,
    flags: { ...state.flags, 'directees:count': directees.length },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: npc ? `Stopped directing ${npc.title ? `${npc.title} ` : ''}${npc.name.first} ${npc.name.last}.` : 'A direction ended.' }],
  };
}

/**
 * The week: what directing does to the friar, and only to him. Runs through
 * the internal forum, which throws on anything else, so the sheet's
 * reputation can never move because of what a man said on a Tuesday.
 */
export function directingWeek(state: GameState): GameState {
  const r = state.religious;
  const live = directees(state);
  if (!r || !live.length) return state;
  // A directee who has left or died is let go quietly.
  const gone = (r.directees ?? []).filter((d) => !live.some((l) => l.npcId === d.npcId));
  let next = state;
  for (const d of gone) next = { ...next, religious: { ...next.religious!, directees: next.religious!.directees!.filter((x) => x.npcId !== d.npcId) } };
  const effects: Effect[] = DIRECTING.weekly.map((e) => ({ ...e, delta: (e as { delta: number }).delta * live.length }) as Effect);
  next = applyInternalForum(next, effects, {}, 'direction given');
  // The men come to trust him, slowly. Their regard is theirs, not a standing.
  const npcs = { ...next.npcs };
  for (const d of live) npcs[d.npcId] = { ...npcs[d.npcId]!, relationship: Math.min(100, npcs[d.npcId]!.relationship + 0.08) };
  // An ask left six weeks is a no.
  if (next.religious?.directionAsk && state.clock.week - next.religious.directionAsk.week >= DIRECTING.askWeeks) next = answerDirectionAsk(next, false);
  return { ...next, npcs };
}
