import type { ConfrereAskDef, Effect, GameState, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { applyEffects } from '@/engine/effects';
import { confrereAskDefs, religiousOrder } from '@/content/religious';
import { deliverLetter } from '@/systems/review';
import { currentHouse } from './house';
import { reputationOf } from './reputations';

/**
 * A brother of the province writes asking for help. E3 §6.2. Not the
 * bishop and not a pastor: a friar, usually from another house, who needs
 * a reader, a substitute, a translator, a second preacher, a driver. The
 * letter stands six weeks; yes takes blocks for the weeks it runs and
 * lands its effects when done; no is remembered by the brother, and
 * silence by the province a little. Tunables are invented.
 */
export const CONFRERE_ASKS = {
  /** Chance a year a brother writes, plus per point of community and province standing and of the reputation named. */
  base: 0.4,
  perCommunity: 0.003,
  perProvince: 0.003,
  perKnown: 0.004,
  askWeeks: 6,
  noRegard: -6,
  yesRegard: 10,
  silenceCommunity: -2,
  /** A brother from another house is preferred, this often. */
  otherHouse: 0.75,
} as const;

function brothersOf(state: GameState, from: 'other' | 'any'): Npc[] {
  const r = state.religious;
  if (!r) return [];
  const key = `order:${r.order}`;
  return Object.values(state.npcs)
    .filter((n) => n.status === 'active' && n.role === 'religious' && n.tags.includes(key) && n.tags.includes('vows:solemn') && (from === 'any' || !n.tags.includes(`house:${r.houseId}`)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The asks this friar could be written for. */
export function eligibleConfrereAsks(state: GameState): ConfrereAskDef[] {
  const c = state.character;
  const r = state.religious;
  if (!c || !r) return [];
  return confrereAskDefs.filter((d) => {
    if (d.orders && !d.orders.includes(r.order)) return false;
    if (d.reputation && reputationOf(state, d.reputation) < 40) return false;
    for (const [k, v] of Object.entries(d.requires ?? {})) if (c.stats[k as keyof typeof c.stats] < (v ?? 0)) return false;
    return true;
  });
}

export function confrereTaskLoad(state: GameState): number {
  return state.religious?.confrereTask?.ap ?? 0;
}

/** A year: a brother may write. The letter lands in the drawer and on the house sheet. */
export function confrereAskYear(state: GameState, rng: Rng): GameState {
  const r = state.religious;
  const c = state.character;
  if (!r || !c || !currentHouse(state) || !state.flags.ordained || r.confrereAsk || r.confrereTask) return state;
  const p = CONFRERE_ASKS;
  const defs = eligibleConfrereAsks(state);
  if (!defs.length) return state;
  const def = rng.pick(defs);
  const known = def.reputation ? reputationOf(state, def.reputation) : 0;
  const chance = p.base + (c.reputation.community ?? 0) * p.perCommunity + (c.reputation.province ?? 0) * p.perProvince + known * p.perKnown;
  if (!rng.chance(Math.max(0.05, Math.min(0.9, chance)))) return state;
  const from = def.from ?? (rng.chance(p.otherHouse) ? 'other' : 'any');
  const pool = brothersOf(state, from).length ? brothersOf(state, from) : brothersOf(state, 'any');
  if (!pool.length) return state;
  const npc = rng.pick(pool);
  const week = state.clock.week;
  const who = `${npc.title} ${npc.name.last}`;
  const blurb = def.blurb.replace('{npc}', who);
  const order = religiousOrder(r.order);
  const line = `${who} has written: ${blurb}`;
  let next: GameState = { ...state, religious: { ...r, confrereAsk: { defId: def.id, npcId: npc.id, week, dueWeek: week + p.askWeeks }, confrereAskLine: line }, career: [...state.career, { week, kind: 'note', text: `${who} wrote asking for help: ${def.label.toLowerCase()}.` }] };
  next = deliverLetter(next, { sort: 'confrere', title: `A letter from ${who}`, body: [blurb, `It would cost ${def.costs}. A brother of the ${order.short} does not write twice; the answer is on the house sheet, and silence for six weeks is a no.`], week });
  return next;
}

/** Yes or no. Yes begins the help; no is remembered by the brother. */
export function answerConfrereAsk(state: GameState, yes: boolean): GameState {
  const r = state.religious;
  const ask = r?.confrereAsk;
  if (!r || !ask) return state;
  const def = confrereAskDefs.find((d) => d.id === ask.defId);
  const npc = state.npcs[ask.npcId];
  const { confrereAsk: _gone, ...rest } = r;
  const week = state.clock.week;
  if (!def || !npc) return { ...state, religious: rest };
  const who = `${npc.title} ${npc.name.last}`;
  if (!yes) {
    return {
      ...state,
      religious: { ...rest, confrereAskLine: `You wrote back to ${who} that you could not, which is allowed, and which he will remember at the next chapter.` },
      npcs: { ...state.npcs, [npc.id]: { ...npc, relationship: Math.max(-100, npc.relationship + CONFRERE_ASKS.noRegard) } },
      career: [...state.career, { week, kind: 'note', text: `Said no to ${who}: ${def.label.toLowerCase()}.` }],
    };
  }
  return {
    ...state,
    religious: { ...rest, confrereTask: { defId: def.id, label: def.label, npcId: npc.id, startWeek: week, untilWeek: week + def.weeks, ap: def.ap }, confrereAskLine: `You wrote back to ${who} that you would: ${def.costs}.` },
    flags: { ...state.flags, [`confrere_ask:${def.id}`]: week },
    career: [...state.career, { week, kind: 'note', text: `Said yes to ${who}: ${def.label.toLowerCase()}.` }],
  };
}

/** The week: a letter left six weeks is a no; help finished lands its effects and the brother's regard. */
export function confrereAskWeek(state: GameState): GameState {
  const r = state.religious;
  if (!r) return state;
  let next = state;
  const week = state.clock.week;
  if (r.confrereAsk && week >= r.confrereAsk.dueWeek) {
    next = answerConfrereAsk(next, false);
    next = applyEffects(next, [{ target: 'reputation', key: 'community', delta: CONFRERE_ASKS.silenceCommunity }], {}, 'a brother\'s letter left unanswered');
  }
  const task = next.religious?.confrereTask;
  if (task && week >= task.untilWeek) {
    const def = confrereAskDefs.find((d) => d.id === task.defId);
    const npc = next.npcs[task.npcId];
    const { confrereTask: _done, ...rest } = next.religious!;
    const who = npc ? `${npc.title} ${npc.name.last}` : 'the brother';
    next = { ...next, religious: { ...rest, confrereAskLine: `${task.label} for ${who}: done, and he has said so at table.` }, career: [...next.career, { week, kind: 'note', text: `${task.label} for ${who}: done.` }] };
    if (def) next = applyEffects(next, def.effects.map((e) => ({ target: e.target as Effect['target'], key: e.key, delta: e.delta }) as Effect), {}, task.label.toLowerCase());
    if (npc) next = { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, relationship: Math.min(100, npc.relationship + CONFRERE_ASKS.yesRegard) } } };
  }
  return next;
}
