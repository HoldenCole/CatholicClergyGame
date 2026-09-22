import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { closeChapter, holdElection, openChapter, resolveElection, returnToRanks, successorChapter } from '@/systems/religious/chapter';
import { currentHouse, playerIsPrior, priorOf } from '@/systems/religious/house';
import { electedOfficeLoad, nameOfficer, officerRows, purseOffers, ruleWeek, setHouseRule, spendPurse } from '@/systems/religious/priorDesk';
import { permissionChance } from '@/systems/religious/poverty';
import { permissionDefs } from '@/content/religious';
import { houseOfficeOffers } from '@/systems/religious/requests';
import { BISHOP_ASKS, friarLoad } from '@/systems/religious/bishopAsks';
import { spendBudget } from '@/systems/religious/spends';
import { friarPost, friarWord } from '@/systems/religious/who';
import { postLine } from '@/systems/profile';
import { resolveSelector } from '@/engine/selectors';
import { evaluateAll } from '@/engine/conditions';
import type { GameState, OrderKey } from '@/types';

/** A solemnly professed priest of fifty in a priory of his province, known and liked. */
function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: 0 } }, gen, 2010, priory.id);
  s = { ...s, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10 } };
  const npcs = { ...s.npcs };
  for (const id of s.province!.friarIds) npcs[id] = { ...npcs[id]!, relationship: 40 };
  return { ...s, npcs };
}

/** Elect him prior of his house, whatever the ballots say: the seeds are tried until one does. */
function elected(seed: string): GameState {
  for (let i = 0; i < 40; i++) {
    const s = friar(`${seed}-${i}`);
    const held = holdElection(openChapter(s, 'house', s.religious!.houseId, 'prior'));
    if (held.religious!.chapter!.outcome!.electedId === PLAYER_ID) return closeChapter(resolveElection(held, createRng('confirm'), true));
  }
  throw new Error('never elected');
}

describe('the player as prior: the house knows it, and the desk is his', () => {
  it('seating writes him on the house: the old prior loses the tag, the selector finds no other prior, the sheets say prior', () => {
    const s = elected('seat');
    const house = currentHouse(s)!;
    expect(house.priorId).toBe(PLAYER_ID);
    expect(playerIsPrior(s)).toBe(true);
    expect(priorOf(s)).toBeUndefined();
    expect(Object.values(s.npcs).filter((n) => n.tags.includes('prior') && n.tags.includes(`house:${house.id}`))).toEqual([]);
    expect(resolveSelector(s, '@prior')).toBeNull();
    expect(friarWord(s)).toBe('Prior');
    expect(friarPost(s)).toBe(`Prior of ${house.name}`);
    expect(postLine(s)).toBe(`Prior of ${house.name}`);
    // His own office of the house is laid down: a prior gives these, he does not hold them.
    expect(s.religious!.houseOffice).toBeUndefined();
    expect(houseOfficeOffers(s).every((o) => !o.available && /prior gives/.test(o.why))).toBe(true);
    // Permissions are his to take, within the purse.
    expect(permissionChance(s, permissionDefs[0]!)).toBe(1);
    // The office takes blocks, from the order's data.
    expect(electedOfficeLoad(s)).toBe(3);
    expect(friarLoad(s)).toBeGreaterThanOrEqual(3);
  });

  it('a friar of the ranks is not a prior, is called a friar, and his profile line is the house\'s, not the seminary\'s', () => {
    const s = friar('ranks');
    expect(playerIsPrior(s)).toBe(false);
    expect(friarWord(s)).toMatch(/^Friar/);
    expect(postLine(s)).toMatch(/^Friar of /);
    expect(postLine(s)).not.toMatch(/Seminarian/);
    expect(permissionChance(s, permissionDefs[0]!)).toBeLessThan(1);
    expect(electedOfficeLoad(s)).toBe(0);
  });

  it('the week is the diocesan twelve with the common life counted in, so a friar at standard keeps most of it', () => {
    const s = friar('hours');
    expect(BISHOP_ASKS.weekBlocks).toBe(16.5);
    expect(spendBudget(s)).toBeGreaterThanOrEqual(10);
  });

  it('the rule of the house: the house moves toward it a week at a time, the men of a mind react, and a house being moved rubs', () => {
    const s = elected('rule');
    const house = currentHouse(s)!;
    const before = house.observance;
    const strict = setHouseRule(s, 'strict');
    expect(strict.line).toMatch(/Matins/);
    expect(currentHouse(strict.state)!.rule).toBe('strict');
    const old = Object.values(s.npcs).filter((n) => n.tags.includes(`house:${house.id}`) && n.alignment <= -20);
    const young = Object.values(s.npcs).filter((n) => n.tags.includes(`house:${house.id}`) && n.alignment >= 20);
    for (const n of old) expect(strict.state.npcs[n.id]!.relationship).toBe(Math.min(100, n.relationship + 3));
    for (const n of young) expect(strict.state.npcs[n.id]!.relationship).toBe(n.relationship - 3);
    let next = strict.state;
    for (let i = 0; i < 20; i++) next = ruleWeek(next);
    const moved = currentHouse(next)!.observance;
    expect(moved).toBeGreaterThan(before);
    expect(moved - before).toBeCloseTo(Math.min(20 * 0.6, 85 - before), 1);
    expect(next.character!.reputation.community ?? 0).toBeLessThan(strict.state.character!.reputation.community ?? 0);
    // Setting the same rule again is nothing; a man of the ranks cannot set it.
    expect(setHouseRule(strict.state, 'strict').state).toBe(strict.state);
    expect(setHouseRule(friar('ranks'), 'strict').line).toMatch(/prior decides/);
  });

  it('the offices of the house are in his gift: the man named is grateful, a better man passed over notices, and the house runs better filled', () => {
    const s = elected('offices');
    const rows = officerRows(s);
    expect(rows.length).toBe(religiousOrder('OP').houseOffices.length);
    const row = rows.find((r) => r.def.id === 'procurator')!;
    const fit = row.candidates.filter((c) => !c.short);
    expect(fit.length).toBeGreaterThan(0);
    const pick = fit[fit.length - 1]!;
    const named = nameOfficer(s, 'procurator', pick.npc.id);
    expect(named.line).toMatch(new RegExp(pick.npc.name.last));
    expect(currentHouse(named.state)!.officers).toEqual({ procurator: pick.npc.id });
    expect(named.state.npcs[pick.npc.id]!.relationship).toBe(Math.min(100, pick.npc.relationship + 5));
    const best = fit[0]!;
    if (best.npc.id !== pick.npc.id && best.fit > pick.fit + 8) expect(named.state.npcs[best.npc.id]!.relationship).toBe(best.npc.relationship - 3);
    // A man holding one office is not offered another; vacating clears it.
    expect(officerRows(named.state).find((r) => r.def.id === 'sacristan')!.candidates.some((c) => c.npc.id === pick.npc.id)).toBe(false);
    expect(currentHouse(nameOfficer(named.state, 'procurator', null).state)!.officers).toEqual({});
    // Not his to give from the ranks.
    const ranks = friar('ranks');
    expect(nameOfficer(ranks, 'procurator', pick.npc.id).state).toBe(ranks);
  });

  it('the purse: a spend costs the house, lands its effects, and waits its cooldown; not from the ranks', () => {
    const s = elected('purse');
    const house = currentHouse(s)!;
    const offers = purseOffers(s);
    expect(offers.some((o) => o.available)).toBe(true);
    const library = offers.find((o) => o.def.id === 'library')!;
    expect(library.available).toBe(true);
    const spent = spendPurse(s, 'library');
    expect(currentHouse(spent.state)!.budget).toBe(house.budget - library.def.cost);
    expect(spent.state.character!.stats.knowledge).toBeGreaterThan(s.character!.stats.knowledge);
    expect(spent.line).toMatch(/boxes/);
    expect(purseOffers(spent.state).find((o) => o.def.id === 'library')!.available).toBe(false);
    expect(purseOffers(friar('ranks')).every((o) => !o.available)).toBe(true);
  });

  it('the term ends: the chair is empty, and the house elects a successor with him voting and not on the ballot', () => {
    const s = elected('succ');
    const o = s.religious!.office!;
    const ended = { ...s, clock: { ...s.clock, week: o.endWeek } };
    const back = returnToRanks(ended, 'well');
    expect(currentHouse(back)!.priorId).toBe('');
    expect(playerIsPrior(back)).toBe(false);
    const after = successorChapter(back, 'prior', o.bodyId, createRng('successor'));
    const ch = after.state.religious!.chapter;
    if (ch) {
      expect(ch.electorIds).toContain(PLAYER_ID);
      expect(ch.candidateIds).not.toContain(PLAYER_ID);
      expect(ch.candidateIds.length).toBeGreaterThan(0);
      const seated = resolveElection(holdElection(after.state), createRng('c'), true);
      const prior = currentHouse(seated)!.priorId;
      expect(prior).not.toBe(PLAYER_ID);
      expect(seated.npcs[prior]!.tags).toContain('prior');
    } else {
      const prior = currentHouse(after.state)!.priorId;
      expect(prior).not.toBe('');
      expect(prior).not.toBe(PLAYER_ID);
    }
    expect(after.state.flags[`chapter:house:${o.bodyId}`]).toBe(o.endWeek);
    // A chair the chapter had already filled before the term ran out is left alone.
    const filled = { ...back, orderHouses: { ...back.orderHouses, [o.bodyId]: { ...back.orderHouses![o.bodyId]!, priorId: currentHouse(s)!.memberIds[0]! } } };
    expect(successorChapter(filled, 'prior', o.bodyId, createRng('x')).state).toBe(filled);
  });

  it('an npc_age condition compares a person to the man himself, so no scene calls the prior younger when he is not', () => {
    const s = friar('age');
    const prior = priorOf(s)!;
    const year = 2010;
    const me = year - (s.character!.entryYear - s.character!.background.entryAge);
    const priorAge = year - prior.birthYear;
    expect(evaluateAll([{ type: 'npc_age', who: 'prior', op: '<=', value: 'self', offset: -1 }], s)).toBe(priorAge <= me - 1);
    expect(evaluateAll([{ type: 'npc_age', who: 'prior', op: '>=', value: priorAge }], s)).toBe(true);
    expect(evaluateAll([{ type: 'npc_age', who: 'prior', op: '>=', value: priorAge + 1 }], s)).toBe(false);
    // With the player as prior there is no prior to compare, and the scene does not fire.
    expect(evaluateAll([{ type: 'npc_age', who: 'prior', op: '<=', value: 'self' }], elected('age2'))).toBe(false);
  });

  it('the formation houses sit where the province keeps them: the eastern Dominicans study in Washington', () => {
    const def = religiousOrder('OP');
    for (const seed of ['a', 'b', 'c']) {
      const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
      const studium = gen.houses.find((h) => h.kind === 'studium');
      expect(studium?.dioceseId).toBe('washington');
      const novitiate = gen.houses.find((h) => h.kind === 'novitiate')!;
      expect(gen.dioceses.find((d) => d.presetId === novitiate.dioceseId)!.preset.see).toBe('Cincinnati');
      expect(studium!.name).not.toMatch(/Dominican House of Studies/);
    }
    // A pinned see outside the region pool is still found: the western province's school sits in Oakland.
    const west = generateProvince(createRng('w:province'), def, def.provinces[3]!, 2010);
    const studium = west.houses.find((h) => h.kind === 'studium');
    if (studium) expect(west.dioceses.find((d) => d.presetId === studium.dioceseId)!.preset.see).toBe('Oakland');
  });
});
