import type { Effect, GameState, Npc, PastorAskDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { dateOf } from '@/engine/time';
import { pastorAskDefs } from '@/content/religious';
import { currentHouse } from './house';
import { needOf } from './obedience';
import { friarLoad, BISHOP_ASKS } from './bishopAsks';
import { preachingOf } from './study';
import { friarDeaneryPriests } from './deanery';
import { reputationOf } from './reputations';

/**
 * The diocese's pastors ask the prior for him. E3 §3.12. A pastor who has
 * heard of the friar writes to the prior, not to the friar: for a mission,
 * a month of Sundays, the Saturday confessions. The prior says yes when
 * the house can spare the blocks, and only then does the friar see it, for
 * six weeks; silence is a no. What is done lands on the people, the
 * presbyterate, and the pastor. Tunables are invented.
 */
export const PASTOR_ASKS = {
  /** Chance a year a pastor writes, plus per point of the people's and the presbyterate's regard, and of a preaching name. */
  base: 0.25,
  perLaity: 0.004,
  perClergy: 0.004,
  perPreaching: 0.003,
  /** Weeks the ask stands. */
  askWeeks: 6,
  /** The prior will not lend a man from a house that needs him this much. */
  spareNeed: 65,
  /** A no, or silence, and the pastor's regard. */
  noRegard: -4,
  yesRegard: 8,
  silenceClergy: -2,
} as const;

function pastorsOf(state: GameState): Npc[] {
  const near = friarDeaneryPriests(state).map((p) => p.npc);
  if (near.length) return near;
  const here = state.world?.diocese.presetId;
  return Object.values(state.npcs)
    .filter((n) => n.status === 'active' && n.role === 'priest' && n.tags.some((t) => t.startsWith('pastor:')) && (!here || n.tags.includes(`diocese:${here}`)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parishOf(pastor: Npc): string {
  return pastor.tags.find((t) => t.startsWith('pastor:'))?.slice('pastor:'.length) ?? '';
}

/** The asks this friar could be written for. */
export function eligiblePastorAsks(state: GameState): PastorAskDef[] {
  const c = state.character;
  if (!c) return [];
  const preaching = preachingOf(state) ?? 0;
  return pastorAskDefs.filter((d) => {
    if (d.preacher && preaching < 25 && (c.reputation.laity ?? 0) < 25) return false;
    for (const [k, v] of Object.entries(d.requires ?? {})) if (c.stats[k as keyof typeof c.stats] < (v ?? 0)) return false;
    return true;
  });
}

/** A year: a pastor may write to the prior, and the prior answers him before the friar hears of it. */
export function pastorAskYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const c = state.character;
  const house = currentHouse(state);
  if (!r || !c || !house || !state.flags.ordained || r.pastorAsk || r.pastorTask) return state;
  const p = PASTOR_ASKS;
  const known = Math.max(reputationOf(state, 'preacher'), reputationOf(state, 'confessor'), reputationOf(state, 'pastor_of_dying'));
  const chance = p.base + (c.reputation.laity ?? 0) * p.perLaity + (c.reputation.diocesan_clergy ?? 0) * p.perClergy + (preachingOf(state) ?? 0) * p.perPreaching + known * 0.003;
  if (!rng.chance(Math.max(0.05, Math.min(0.9, chance)))) return state;
  const pastors = pastorsOf(state);
  const defs = eligiblePastorAsks(state);
  if (!pastors.length || !defs.length) return state;
  const pastor = rng.pick(pastors);
  const def = rng.pick(defs);
  const week = state.clock.week;
  const need = needOf(state, house, dateOf(state.clock).year);
  const room = friarLoad(state) + def.ap <= BISHOP_ASKS.weekBlocks + 2;
  const yes = need < p.spareNeed && room;
  const who = `${pastor.title} ${pastor.name.last}`;
  const line = yes
    ? `${who} wrote to the prior asking for you: ${def.blurb} The prior said the house could spare you, and left it to you.`
    : `${who} wrote to the prior asking for you: ${def.blurb} The prior said the house could not spare you this year, and wrote to him himself.`;
  let next: GameState = { ...state, religious: { ...r, pastorAskLine: line, ...(yes ? { pastorAsk: { defId: def.id, pastorId: pastor.id, parishId: parishOf(pastor), week, dueWeek: week + p.askWeeks, priorSaidYes: true } } : {}) }, career: [...state.career, { week, kind: 'note', text: `${who} asked the prior for you: ${def.label.toLowerCase()}. ${yes ? 'The prior said yes.' : 'The prior said no.'}` }] };
  if (!yes) next = { ...next, npcs: { ...next.npcs, [pastor.id]: { ...pastor, relationship: Math.max(-100, pastor.relationship + p.noRegard / 2) } } };
  return next;
}

/** Yes or no. Yes begins the work; no is remembered by the pastor a little. */
export function answerPastorAsk(state: GameState, yes: boolean): GameState {
  const r = state.religious;
  const ask = r?.pastorAsk;
  if (!r || !ask) return state;
  const def = pastorAskDefs.find((d) => d.id === ask.defId);
  const pastor = state.npcs[ask.pastorId];
  const { pastorAsk: _gone, ...rest } = r;
  const week = state.clock.week;
  if (!def || !pastor) return { ...state, religious: rest };
  if (!yes) {
    return {
      ...state,
      religious: { ...rest, pastorAskLine: `You said no to ${pastor.title} ${pastor.name.last}, which is allowed and is remembered.` },
      npcs: { ...state.npcs, [pastor.id]: { ...pastor, relationship: Math.max(-100, pastor.relationship + PASTOR_ASKS.noRegard) } },
      career: [...state.career, { week, kind: 'note', text: `Said no to ${pastor.title} ${pastor.name.last}: ${def.label.toLowerCase()}.` }],
    };
  }
  return {
    ...state,
    religious: { ...rest, pastorTask: { defId: def.id, label: def.label, pastorId: pastor.id, parishId: ask.parishId, startWeek: week, untilWeek: week + def.weeks, ap: def.ap }, pastorAskLine: `You said yes to ${pastor.title} ${pastor.name.last}: ${def.costs}.` },
    flags: { ...state.flags, [`pastor_ask:${def.id}`]: week },
    career: [...state.career, { week, kind: 'note', text: `Said yes to ${pastor.title} ${pastor.name.last}: ${def.label.toLowerCase()}.` }],
  };
}

/** The week: an ask left six weeks is a no; a task done lands its effects. */
export function pastorAskWeek(state: GameState): GameState {
  const r = state.religious;
  if (!r) return state;
  let next = state;
  const week = state.clock.week;
  if (r.pastorAsk && week >= r.pastorAsk.dueWeek) {
    next = answerPastorAsk(next, false);
    next = applyEffects(next, [{ target: 'reputation', key: 'diocesan_clergy', delta: PASTOR_ASKS.silenceClergy }], {}, 'a pastor\'s letter left unanswered');
  }
  const task = next.religious?.pastorTask;
  if (task && week >= task.untilWeek) {
    const def = pastorAskDefs.find((d) => d.id === task.defId);
    const pastor = next.npcs[task.pastorId];
    const { pastorTask: _done, ...rest } = next.religious!;
    next = { ...next, religious: rest, career: [...next.career, { week, kind: 'note', text: `${task.label} for ${pastor ? `${pastor.title} ${pastor.name.last}` : 'the pastor'}: done.` }] };
    if (def) next = applyEffects(next, def.effects.map((e) => ({ target: e.target as Effect['target'], key: e.key, delta: e.delta }) as Effect), {}, task.label.toLowerCase());
    if (pastor) next = { ...next, npcs: { ...next.npcs, [pastor.id]: { ...pastor, relationship: Math.min(100, pastor.relationship + PASTOR_ASKS.yesRegard) } } };
  }
  return next;
}
