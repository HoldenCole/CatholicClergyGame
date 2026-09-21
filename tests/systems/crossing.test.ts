import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { parishState } from './week.test';
import { religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { worldOf } from '@/systems/religious/transfer';
import { closeHouse, foundHouse, houseToClose, provinceYear } from '@/systems/religious/foundations';
import { crossingYear } from '@/systems/religious/crossing';
import { applyEffects } from '@/engine/effects';
import { housesOf } from '@/systems/houses';
import { formerReligiousArrives, institutesYear } from '@/systems/institutesDrift';
import { resolveSelector } from '@/engine/selectors';

function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = gen.houses.find((h) => h.kind === 'priory')!.id;
  const base = seminaryState(seed);
  const c = testCharacter({ reputation: { ...base.character!.reputation, local_bishop: 20 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 6 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

describe('closures, foundations, and crossing over (E3 §3.14)', () => {
  it('closing a house sends its men elsewhere, hands a parish back to the diocese, and takes it off the diocese\'s list', () => {
    const s = friar('close');
    const parishHouse = Object.values(s.orderHouses!).find((h) => h.kind === 'parish' && h.parishId && h.id !== s.religious!.houseId);
    const target = parishHouse ?? Object.values(s.orderHouses!).find((h) => h.id !== s.religious!.houseId && h.kind !== 'curia')!;
    const members = membersOf(s, target).map((m) => m.id);
    const before = worldOf(s, target.dioceseId)!;
    const seenBefore = (before.diocese.visible.houses ?? []).length;
    const closed = closeHouse(s, target.id, createRng('c'));
    expect(closed.state.orderHouses![target.id]).toBeUndefined();
    expect(closed.state.province!.houseIds).not.toContain(target.id);
    for (const id of members) {
      const n = closed.state.npcs[id]!;
      const house = n.tags.find((t) => t.startsWith('house:'))!.slice('house:'.length);
      expect(house).not.toBe(target.id);
      expect(closed.state.orderHouses![house]!.memberIds).toContain(id);
    }
    expect(closed.state.flags[`house_closed:${target.dioceseId}`]).toBeDefined();
    if (target.parishId) {
      const after = worldOf(closed.state, target.dioceseId)!;
      const parish = after.parishes.find((p) => p.id === target.parishId)!;
      expect(parish.pastorId).not.toBe(target.priorId);
      expect(closed.state.npcs[parish.pastorId]?.tags).toContain(`pastor:${parish.id}`);
      expect(closed.state.flags[`parish_handed_back:${target.dioceseId}`]).toBeDefined();
    }
    const after = worldOf(closed.state, target.dioceseId)!;
    expect((after.diocese.visible.houses ?? []).length).toBeLessThanOrEqual(seenBefore);
    // The scene's effect does the same on the provincial's word, deterministically.
    const byEffect = applyEffects(s, [{ target: 'province', key: 'close_house', value: target.id }], {}, 'the chapter');
    expect(byEffect.orderHouses![target.id]).toBeUndefined();
    expect(applyEffects(s, [{ target: 'province', key: 'close_house', value: target.id }], {}, 'x').province!.houseIds).toEqual(byEffect.province!.houseIds);
  });

  it('a foundation sends three to five professed men to a diocese without a house, and the diocese sees it', () => {
    const s = friar('found');
    const housed = new Set(Object.values(s.orderHouses!).map((h) => h.dioceseId));
    const did = s.province!.dioceseIds.find((d) => !housed.has(d)) ?? s.province!.dioceseIds[0]!;
    const before = (worldOf(s, did)!.diocese.visible.houses ?? []).length;
    const founded = foundHouse(s, did, 'parish', createRng('f'));
    expect(founded.line).toMatch(/founded/);
    const house = Object.values(founded.state.orderHouses!).find((h) => !s.orderHouses![h.id])!;
    expect(house.dioceseId).toBe(did);
    expect(house.memberIds.length).toBeGreaterThanOrEqual(3);
    expect(house.memberIds.length).toBeLessThanOrEqual(5);
    expect(house.memberIds).toContain(house.priorId);
    for (const id of house.memberIds) expect(founded.state.npcs[id]!.tags).toContain(`house:${house.id}`);
    expect(house.parishId).toBeDefined();
    expect(worldOf(founded.state, did)!.parishes.find((p) => p.id === house.parishId)!.pastorId).toBe(house.priorId);
    expect((worldOf(founded.state, did)!.diocese.visible.houses ?? []).length).toBe(before + 1);
    expect(founded.state.flags[`house_founded:${did}`]).toBeDefined();
    // The year rolls it for a growing province, and never touches the player's own house on a closure.
    const growing: GameState = { ...s, province: { ...s.province!, trajectory: 'growing' } };
    let rolled: GameState | undefined;
    for (let i = 0; i < 60 && !rolled; i++) {
      const y = provinceYear(growing, createRng(`py:${i}`));
      if (y.mode.kind === 'letter') rolled = y;
    }
    expect(rolled).toBeDefined();
    const shrinking: GameState = { ...s, province: { ...s.province!, trajectory: 'shrinking' } };
    const pick = houseToClose(shrinking);
    if (pick) expect(pick.id).not.toBe(shrinking.religious!.houseId);
  });

  it('a diocesan priest marked by a scene enters the order a year on, as a novice of the province; a friar marked leaves for the diocese', () => {
    const s = friar('cross');
    const did = s.world!.diocese.presetId;
    const priest = Object.values(s.npcs).find((n) => n.role === 'priest' && n.status === 'active' && n.tags.includes(`diocese:${did}`) && n.tags.some((t) => t.startsWith('pastor:')))!;
    const marked = applyEffects(s, [{ target: 'crossing', key: priest.id, value: 'enter_order' }], {}, 'a walk');
    expect(marked.npcs[priest.id]!.tags).toContain('crossing:entering');
    const soon = crossingYear(marked, createRng('y'));
    expect(soon.npcs[priest.id]!.role).toBe('priest');
    const later = crossingYear({ ...marked, clock: { ...marked.clock, week: marked.clock.week + 53 } }, createRng('y'));
    const n = later.npcs[priest.id]!;
    expect(n.role).toBe('religious');
    expect(n.tags).toContain('vows:novice');
    expect(n.tags).toContain('crossed_over');
    expect(n.tags.some((t) => t.startsWith('pastor:'))).toBe(false);
    const novitiate = Object.values(later.orderHouses!).find((h) => h.kind === 'novitiate')!;
    expect(novitiate.memberIds).toContain(priest.id);
    expect(later.province!.friarIds).toContain(priest.id);
    const parishTag = priest.tags.find((t) => t.startsWith('pastor:'))!;
    expect(Object.values(later.npcs).some((x) => x.id !== priest.id && x.tags.includes(parishTag))).toBe(true);
    expect(later.character!.reputation.local_bishop).toBeLessThan(s.character!.reputation.local_bishop ?? 0);
    // The other way.
    const confrere = membersOf(s, currentHouse(s)!).find((m) => m.id !== currentHouse(s)!.priorId)!;
    const leaving = crossingYear({ ...applyEffects(s, [{ target: 'crossing', key: confrere.id, value: 'leave_order' }], {}, 'chapter'), clock: { ...s.clock, week: s.clock.week + 53 } }, createRng('l'));
    const left = leaving.npcs[confrere.id]!;
    expect(left.role).toBe('priest');
    expect(left.tags).toContain('ex_religious');
    expect(currentHouse(leaving)!.memberIds).not.toContain(confrere.id);
    expect(leaving.flags['crossing:confrere_left']).toBeDefined();
  });

  it('from the diocese: a collapsing institute withdraws a house some year, and a man who left one may come as the pastor\'s curate', () => {
    const base = parishState('drift');
    const houses = housesOf(base);
    if (!houses.length) return;
    const collapsing: GameState = { ...base, world: { ...base.world!, institutes: (base.world!.institutes ?? []).map((i) => ({ ...i, trajectory: 'collapsing' as const })) } };
    let gone: GameState | undefined;
    for (let i = 0; i < 80 && !gone; i++) {
      const y = institutesYear(collapsing, createRng(`iy:${i}`));
      if (y.lines.length) gone = y.state;
    }
    if (housesOf(collapsing).some((h) => collapsing.world!.institutes?.some((i) => i.id === h.instituteId))) {
      expect(gone).toBeDefined();
      expect(housesOf(gone!).length).toBe(houses.length - 1);
      expect(gone!.flags['friars_leaving']).toBeDefined();
    }
    const pastor: GameState = { ...base, assignment: { ...base.assignment!, role: 'pastor' } };
    let came: GameState | undefined;
    for (let i = 0; i < 120 && !came; i++) {
      const y = formerReligiousArrives(pastor, createRng(`fr:${i}`));
      if (y.line) came = y.state;
    }
    expect(came).toBeDefined();
    expect(came!.parish!.vicarId).toBeDefined();
    const vicar = came!.npcs[came!.parish!.vicarId!]!;
    expect(vicar.role).toBe('priest');
    expect(vicar.tags).toContain('ex_religious');
    expect(resolveSelector(came!, '@former_friar')?.id).toBe(vicar.id);
    expect(came!.flags['vicar:former_religious']).toBeDefined();
  });
});
