import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { parishState } from './week.test';
import { religiousOrder, horariumDefs, permissionDefs } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { moveToHouse, currentPosting, worldOf } from '@/systems/religious/transfer';
import { consult, decideAssignment, dualAuthorityCheck, receiveAssignment, statePreference, OBEDIENCE } from '@/systems/religious/obedience';
import { horariumAp, horariumLoad, horariumRows, horariumWeek, setHorarium } from '@/systems/religious/horarium';
import { cohesionPietyFactor, currentHouse, houseLine, houseWeek, HOUSE, membersOf, priorOf } from '@/systems/religious/house';
import { askPermission, permissionChance, permissionOffers } from '@/systems/religious/poverty';
import { religiousWeek } from '@/systems/religious/week';
import { planWeek } from '@/systems/week';
import { pietyFactor } from '@/systems/direction';
import { decayWeek } from '@/systems/stats';
import type { GameState, OrderKey } from '@/types';

/** A friar of an order, professed into its first province, in its novitiate. */
function friar(seed: string, order: OrderKey = 'OP', houseKind?: string): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = houseKind ? gen.houses.find((h) => h.kind === houseKind)?.id : undefined;
  const base = seminaryState(seed);
  return installProvince({ ...base, character: testCharacter({ reputation: { ...base.character!.reputation, province: 20, rome: 5 } }) }, gen, 2010, first);
}

describe('a friar moved through three houses in three dioceses (E3 R1.1)', () => {
  it('the province is home, the house is where he lives, and the diocese is the one he is in now', () => {
    const s = friar('install');
    expect(s.campaign).toBe('religious');
    expect(s.province!.order).toBe('OP');
    expect(currentHouse(s)!.kind).toBe('novitiate');
    expect(s.world!.diocese.presetId).toBe(currentHouse(s)!.dioceseId);
    expect(Object.keys(s.territory!).length).toBe(s.province!.dioceseIds.length - 1);
    expect(s.flags[`diocese:${currentHouse(s)!.dioceseId}`]).toBe(true);
    expect(s.flags['order:OP']).toBe(true);
    // Every friar of the province and every diocese's people are in the state.
    for (const id of s.province!.friarIds) expect(s.npcs[id]).toBeDefined();
    expect(currentPosting(s)!.houseId).toBe(currentHouse(s)!.id);
    expect(s.career.at(-1)!.text).toMatch(/Sent to/);
    expect(priorOf(s)).toBeDefined();
    expect(membersOf(s, currentHouse(s)!).length).toBe(currentHouse(s)!.memberIds.length);
  });

  it('three moves, three dioceses: local standings reset, the province persists, each house reads differently, and a diocese left is found as it was', () => {
    let s = friar('moves');
    const houses = Object.values(s.orderHouses!);
    const dioceses = new Set<string>([currentHouse(s)!.dioceseId]);
    const picks = houses.filter((h) => {
      if (dioceses.has(h.dioceseId)) return false;
      dioceses.add(h.dioceseId);
      return true;
    }).slice(0, 3);
    expect(picks.length).toBe(3);
    // He has made friends here and fallen out with the bishop.
    s = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, community: 40, local_bishop: -30, laity: 25, province: 20 } } };
    const firstDiocese = s.world!.diocese.presetId;
    const marked = { ...s.world!, parishes: s.world!.parishes.map((p, i) => (i === 0 ? { ...p, name: 'St. Marker' } : p)) };
    s = { ...s, world: marked };
    const lines: string[] = [];
    const seen: string[] = [];
    for (const h of picks) {
      s = moveToHouse({ ...s, clock: { ...s.clock, week: s.clock.week + 200 } }, h.id, h.works[0]!);
      expect(s.world!.diocese.presetId).toBe(h.dioceseId);
      expect(s.territory![h.dioceseId]).toBeUndefined();
      expect(s.flags[`diocese:${h.dioceseId}`]).toBe(true);
      expect(Object.keys(s.flags).filter((k) => k.startsWith('diocese:')).length).toBe(1);
      lines.push(houseLine(s, currentHouse(s)!));
      seen.push(h.dioceseId);
      expect(s.religious!.horarium.hours).toBe('standard');
    }
    expect(new Set(lines).size).toBe(3);
    expect(new Set(seen).size).toBe(3);
    const rep = s.character!.reputation;
    expect(rep.province).toBe(20);
    expect(rep.rome).toBe(5);
    expect(rep.local_bishop).toBe(0);
    expect(rep.laity).toBe(0);
    expect(rep.community).toBeLessThan(5);
    // The first move carried a share of the house standing.
    const one = moveToHouse({ ...friar('moves'), character: { ...s.character!, reputation: { ...rep, community: 40 } } }, picks[0]!.id, 'parish');
    expect(one.character!.reputation.community).toBe(Math.round(40 * HOUSE.communityCarry));
    // The postings are a record with ends.
    expect(s.religious!.assignments.length).toBe(4);
    expect(s.religious!.assignments.slice(0, 3).every((a) => a.endWeek !== undefined)).toBe(true);
    expect(currentPosting(s)!.houseId).toBe(picks[2]!.id);
    // The diocese he left first waits in the territory as he left it, and coming back finds it.
    expect(worldOf(s, firstDiocese)!.parishes[0]!.name).toBe('St. Marker');
    const back = moveToHouse(s, houses.find((h) => h.dioceseId === firstDiocese)!.id, 'formation');
    expect(back.world!.parishes[0]!.name).toBe('St. Marker');
    expect(back.territory![picks[2]!.dioceseId]).toBeDefined();
  });
});

describe('the horarium (E3 §3.3)', () => {
  it('the common life takes its AP before any work, the Dominican choir costs one more, and a dispensation lifts most of a line', () => {
    expect(horariumDefs.map((h) => h.key)).toEqual(['hours', 'conventual_mass', 'common_table', 'house_chapter']);
    const op = friar('h-op', 'OP');
    const osa = friar('h-osa', 'OSA');
    expect(horariumAp(osa, 'hours', 'standard')).toBe(2);
    expect(horariumAp(op, 'hours', 'standard')).toBe(3);
    expect(horariumLoad(osa)).toBe(4.5);
    expect(horariumLoad(op)).toBe(5.5);
    const minimal = setHorarium(setHorarium(op, 'hours', 'min'), 'common_table', 'min');
    expect(horariumLoad(minimal)).toBe(3.5);
    const dispensed: GameState = { ...op, religious: { ...op.religious!, dispensed: { from: ['hours'], untilWeek: 999 } } };
    expect(horariumAp(dispensed, 'hours', 'standard')).toBe(0.75);
    expect(horariumRows(dispensed).find((r) => r.key === 'hours')!.dispensed).toBe(true);
    // The invested level does not exist for the conventual Mass.
    expect(setHorarium(op, 'conventual_mass', 'invested').religious!.horarium.conventual_mass).toBe('standard');
    // The parish planner counts it in the mandatory floor.
    const pastor = parishState('h-plan');
    const asFriar: GameState = { ...pastor, campaign: 'religious', religious: op.religious!, orderHouses: op.orderHouses!, province: op.province! };
    expect(planWeek(asFriar).mandatory).toBeGreaterThanOrEqual(planWeek(pastor).mandatory + horariumLoad(op) - 0.01);
  });

  it('skipping common prayer is visible to the whole house: the minimum costs standing, cohesion, and piety, more where observance is high', () => {
    const s = friar('h-week', 'OSA');
    const house = currentHouse(s)!;
    const strict = { ...s, orderHouses: { ...s.orderHouses!, [house.id]: { ...house, observance: 90 } } };
    const lax = { ...s, orderHouses: { ...s.orderHouses!, [house.id]: { ...house, observance: 10 } } };
    const skip = (st: GameState) => horariumWeek(setHorarium(setHorarium(st, 'hours', 'min'), 'common_table', 'min'));
    const kept = horariumWeek(s);
    expect(kept.character!.reputation.community ?? 0).toBe(0);
    const a = skip(strict);
    const b = skip(lax);
    expect(a.character!.reputation.community!).toBeLessThan(0);
    expect(a.character!.reputation.community!).toBeLessThan(b.character!.reputation.community!);
    expect(a.character!.stats.piety).toBeLessThan(s.character!.stats.piety);
    expect(a.orderHouses![house.id]!.cohesion).toBeLessThan(house.cohesion);
    const invested = horariumWeek(setHorarium(setHorarium(s, 'hours', 'invested'), 'common_table', 'invested'));
    expect(invested.character!.reputation.community!).toBeGreaterThan(0);
    expect(invested.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
  });
});

describe('the house (E3 §3.2, §7.2)', () => {
  it('cohesion drifts toward what the men make of it, and for the Augustinians it modulates piety decay', () => {
    const osa = friar('c-osa', 'OSA');
    const house = currentHouse(osa)!;
    const low = { ...osa, orderHouses: { ...osa.orderHouses!, [house.id]: { ...house, cohesion: 10 } } };
    const high = { ...osa, orderHouses: { ...osa.orderHouses!, [house.id]: { ...house, cohesion: 90 } } };
    expect(cohesionPietyFactor(low)).toBeGreaterThan(1.2);
    expect(cohesionPietyFactor(high)).toBeLessThan(0.8);
    expect(cohesionPietyFactor(friar('c-op', 'OP'))).toBe(1);
    expect(pietyFactor(low, 0)).toBeGreaterThan(pietyFactor(high, 0));
    const stats = { ...osa.character!.stats, piety: 60 };
    expect(decayWeek(stats, { adminAp: 4, theologyUsed: true, knowledgeUsed: true, pietyFactor: pietyFactor(low, 0) }).piety).toBeLessThan(decayWeek(stats, { adminAp: 4, theologyUsed: true, knowledgeUsed: true, pietyFactor: pietyFactor(high, 0) }).piety);
    // A week pulls a house toward its rest, not past it.
    let s: GameState = low;
    for (let i = 0; i < 60; i++) s = houseWeek(s, createRng(`w-${i}`));
    expect(currentHouse(s)!.cohesion).toBeGreaterThan(10);
    let t: GameState = high;
    for (let i = 0; i < 60; i++) t = houseWeek(t, createRng(`w-${i}`));
    expect(currentHouse(t)!.cohesion).toBeLessThan(90);
    // The week hook runs both and leaves a diocesan run alone.
    const pastor = parishState('c-plain');
    expect(religiousWeek(pastor, createRng('x'))).toBe(pastor);
    expect(religiousWeek(osa, createRng('x'))).not.toEqual(osa);
  });
});

describe('poverty (E3 §3.4)', () => {
  it('every expense is a permission: the prior\'s regard, the budget, his temperament, and precedent decide, and asking twice waits', () => {
    expect(permissionDefs.length).toBe(8);
    const s = friar('p');
    const offers = permissionOffers(s);
    expect(offers.length).toBe(8);
    expect(offers.every((o) => o.available)).toBe(true);
    const prior = priorOf(s)!;
    const warm = { ...s, npcs: { ...s.npcs, [prior.id]: { ...prior, relationship: 80, temperament: 'warm' as const } } };
    const cold = { ...s, npcs: { ...s.npcs, [prior.id]: { ...prior, relationship: -60, temperament: 'severe' as const } } };
    const books = permissionDefs.find((d) => d.id === 'books')!;
    const sabbatical = permissionDefs.find((d) => d.id === 'sabbatical')!;
    expect(permissionChance(warm, books)).toBeGreaterThan(permissionChance(cold, books));
    expect(permissionChance(warm, sabbatical)).toBeLessThan(permissionChance(warm, books));
    const house = currentHouse(s)!;
    const poor = { ...warm, orderHouses: { ...warm.orderHouses!, [house.id]: { ...house, budget: 20000 } } };
    expect(permissionChance(poor, sabbatical)).toBeLessThan(permissionChance(warm, sabbatical));
    const granted = askPermission(warm, 'retreat', createRng('yes'));
    expect(granted.granted).toBe(true);
    expect(granted.line).toMatch(/glad/);
    expect(granted.state.flags['permission:retreat']).toBe(s.clock.week);
    expect(currentHouse(granted.state)!.budget).toBe(house.budget - 900);
    expect(granted.state.religious!.permissions).toEqual([{ id: 'retreat', week: s.clock.week, granted: true }]);
    expect(permissionOffers(granted.state).find((o) => o.def.id === 'retreat')!.available).toBe(false);
    // Precedent: a grant makes the next easier.
    const precedent: GameState = { ...cold, religious: { ...cold.religious!, permissions: [{ id: 'books', week: 0, granted: true }, { id: 'books', week: 10, granted: true }] } };
    expect(permissionChance(precedent, books)).toBeCloseTo(permissionChance(cold, books) + 0.12);
    let refusedOnce = false;
    for (let i = 0; i < 30 && !refusedOnce; i++) refusedOnce = !askPermission(cold, 'sabbatical', createRng(`no-${i}`)).granted;
    expect(refusedOnce).toBe(true);
  });
});

describe('obedience and dual authority (E3 §3.1, §3.8)', () => {
  it('the consultation names three houses that need a man, the provincial decides on need, fit, and formation, and the letter is answered', () => {
    const s = friar('o');
    const opened = consult(s, createRng('c'));
    const c = opened.religious!.consultation!;
    expect(c.options.length).toBe(OBEDIENCE.options);
    expect(c.options.every((o) => o.houseId !== s.religious!.houseId)).toBe(true);
    expect(c.options.every((o) => o.need >= 0 && o.fit >= 0 && o.formation >= 0 && o.line.length > 20)).toBe(true);
    expect(consult(s, createRng('c')).religious!.consultation).toEqual(c);
    const decided = decideAssignment(opened, createRng('d')).religious!.consultation!.decided!;
    expect(c.options.some((o) => o.houseId === decided.houseId)).toBe(true);
    expect(decided.reasons.length).toBeGreaterThan(0);
    // A preference is heard: asking for a house lifts it.
    const asked = c.options[2]!;
    let heard = 0;
    for (let i = 0; i < 40; i++) if (decideAssignment(statePreference(opened, asked.houseId), createRng(`p-${i}`)).religious!.consultation!.decided!.houseId === asked.houseId) heard++;
    let plain = 0;
    for (let i = 0; i < 40; i++) if (decideAssignment(opened, createRng(`p-${i}`)).religious!.consultation!.decided!.houseId === asked.houseId) plain++;
    expect(heard).toBeGreaterThanOrEqual(plain);
    // Good grace: standing up, a little piety, and he moves.
    const withDecision = decideAssignment(opened, createRng('d'));
    const good = receiveAssignment(withDecision, 'good');
    expect(good.religious!.houseId).toBe(decided.houseId);
    expect(good.religious!.consultation).toBeUndefined();
    expect(good.religious!.obedience.accepted).toBe(1);
    expect(good.character!.reputation.superiors).toBe(6);
    expect(good.character!.reputation.province).toBe(24);
    expect(good.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
    const reluctant = receiveAssignment(withDecision, 'reluctant');
    expect(reluctant.religious!.houseId).toBe(decided.houseId);
    expect(reluctant.character!.reputation.superiors).toBe(-5);
    expect(reluctant.flags['obedience:reluctant']).toBe(s.clock.week);
    expect(currentPosting(reluctant)!.grace).toBe('reluctant');
    // Refusal: he stays, standing collapses, and a second refusal opens the process.
    const refused = receiveAssignment(withDecision, 'refused');
    expect(refused.religious!.houseId).toBe(s.religious!.houseId);
    expect(refused.character!.reputation.superiors).toBe(-30);
    expect(refused.flags['obedience:refused']).toBe(s.clock.week);
    expect(refused.flags['obedience:process']).toBeUndefined();
    const again = receiveAssignment(decideAssignment(consult(refused, createRng('c2')), createRng('d2')), 'refused');
    expect(again.religious!.obedience.refused).toBe(2);
    expect(again.flags['obedience:process']).toBe(s.clock.week);
  });

  it('a parish held by two keys: a bishop who has turned, a province that needs him, or a withdrawal can each end it', () => {
    const s = friar('dual');
    const parishHouse = Object.values(s.orderHouses!).find((h) => h.kind === 'parish') ?? Object.values(s.orderHouses!).find((h) => h.kind === 'priory')!;
    const posted = moveToHouse(s, parishHouse.id, 'parish', { dual: true });
    expect(currentPosting(posted)!.dual).toBe(true);
    const count = (st: GameState, n = 200) => {
      const out: Record<string, number> = {};
      for (let i = 0; i < n; i++) {
        const r = dualAuthorityCheck(st, createRng(`da-${i}`)) ?? 'none';
        out[r] = (out[r] ?? 0) + 1;
      }
      return out;
    };
    const calm = count(posted);
    expect(calm.bishop ?? 0).toBe(0);
    const badBishop = { ...posted, character: { ...posted.character!, reputation: { ...posted.character!.reputation, local_bishop: -60 } } };
    expect(count(badBishop).bishop).toBeGreaterThan(60);
    const badProvincial = { ...posted, character: { ...posted.character!, reputation: { ...posted.character!.reputation, superiors: -50 } } };
    expect(count(badProvincial).province).toBeGreaterThan(40);
    const shrinking = { ...posted, province: { ...posted.province!, trajectory: 'shrinking' as const } };
    expect(count(shrinking).withdrawal).toBeGreaterThan(5);
    // Not a parish: no keys to turn.
    const priory = moveToHouse(s, Object.values(s.orderHouses!).find((h) => h.kind === 'novitiate')!.id, 'formation');
    expect(count(priory, 50).none).toBe(50);
  });
});
