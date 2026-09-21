import type { CharterDial, GameState, ReputationKey } from '@/types';
import type { Rng } from '@/engine/rng';
import { religiousOrder } from '@/content/religious';
import { friar } from '@/generation/province';
import { CHARTER_DIALS, reviseCharter } from './charter';
import { closeHouse } from './foundations';
import { foundationOf, myFoundation } from './foundationYear';

/**
 * A scene's `foundation` effect: the house the founder leads now, or the
 * first alive of his line when he leads none. Content decides what
 * happened; this only writes it. E3 §9.
 */
export function foundationEffect(state: GameState, key: string, delta: number | undefined, value: string | undefined, rng: Rng): GameState {
  const r = state.religious;
  if (!r) return state;
  if (key === 'invite') {
    const did = value ?? state.world?.diocese.presetId;
    return did ? { ...state, flags: { ...state.flags, [`foundation:invited:${did}`]: state.clock.week } } : state;
  }
  const f = myFoundation(state) ?? (r.foundations ?? []).find((x) => x.status === 'alive');
  if (!f) return state;
  const set = (patch: Partial<typeof f>): GameState => ({ ...state, religious: { ...r, foundations: r.foundations!.map((x) => (x.houseId === f.houseId ? { ...x, ...patch } : x)) } });
  if (key === 'budget') return set({ budget: f.budget + (delta ?? 0) });
  if (key.startsWith('reputation:')) {
    const k = key.slice('reputation:'.length) as ReputationKey;
    return set({ reputations: { ...f.reputations, [k]: Math.max(0, Math.min(100, (f.reputations[k] ?? 0) + (delta ?? 0))) } });
  }
  if (key === 'vocation') {
    const house = state.orderHouses?.[f.houseId];
    if (!house) return state;
    const n = Math.max(1, Math.round(delta ?? 1));
    const npcs = { ...state.npcs };
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const npc = friar(rng.derive(`v:${i}`), religiousOrder(r.order), { id: f.houseId, alignment: f.charter.alignment, kind: house.kind }, 2010 + Math.floor(state.clock.week / 52), `s${state.clock.week}_${i}`, 'novice', 0);
      npcs[npc.id] = { ...npc, tags: npc.tags.concat(`vocation_of:${f.houseId}`, `entered:${state.clock.week}`) };
      ids.push(npc.id);
    }
    const next = set({ vocationIds: [...f.vocationIds, ...ids] });
    const out: GameState = { ...next, npcs, orderHouses: { ...next.orderHouses, [f.houseId]: { ...house, memberIds: [...house.memberIds, ...ids] } } };
    return next.province ? { ...out, province: { ...next.province, friarIds: [...next.province.friarIds, ...ids] } } : out;
  }
  if (key.startsWith('revise:')) {
    const dial = key.slice('revise:'.length) as CharterDial;
    if (!CHARTER_DIALS.includes(dial) || !value) return state;
    return reviseCharter(state, f.houseId, dial, value, value === 'founder' ? 'player' : 'player');
  }
  if (key === 'fail') {
    const closed = closeHouse(state, f.houseId, rng);
    const r2 = closed.state.religious!;
    const iAmPrior = r2.office?.office === 'prior' && r2.office.bodyId === f.houseId;
    const { office, ...rest } = r2;
    return { ...closed.state, religious: { ...(iAmPrior ? rest : r2), ...(iAmPrior && office ? { termsServed: [...r2.termsServed, { office: 'prior', startWeek: office.startWeek, endWeek: state.clock.week }] } : {}), foundations: r2.foundations!.map((x) => (x.houseId === f.houseId ? { ...x, status: 'failed' as const, failedWeek: state.clock.week, failedWhy: value ?? 'it was closed' } : x)) }, flags: { ...closed.state.flags, 'foundation:failed': state.clock.week } };
  }
  return foundationOf(state, f.houseId) ? state : state;
}
