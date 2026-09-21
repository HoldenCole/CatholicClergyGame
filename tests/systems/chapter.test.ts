import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { contendersOf, electorsOf, PLAYER_ID, playerLegibility, provinceState, respectOf } from '@/systems/religious/electorate';
import { castVote, CHAPTER, closeChapter, confirmChance, declineElection, holdElection, openChapter, resolveElection, returnToRanks, signalWillingness, speakFor, steerBloc, termOver } from '@/systems/religious/chapter';
import { currentHouse } from '@/systems/religious/house';
import type { GameState, OrderKey } from '@/types';

/** A solemnly professed priest of fifty in a priory of his province, known and liked. */
function friar(seed: string, order: OrderKey = 'OP', patch: Partial<GameState['religious'] & object> = {}): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true } }, gen, 2010, priory.id);
  s = { ...s, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10, ...patch } };
  return s;
}

function liked(s: GameState, by = 40): GameState {
  const npcs = { ...s.npcs };
  for (const id of s.province!.friarIds) npcs[id] = { ...npcs[id]!, relationship: by };
  return { ...s, npcs };
}

/** How often the player wins the priorship of his house across seeds. */
function wins(make: (seed: string) => GameState, n = 30): number {
  let w = 0;
  for (let i = 0; i < n; i++) {
    const s = make(`w-${i}`);
    const held = holdElection(openChapter(s, 'house', s.religious!.houseId, 'prior'));
    if (held.religious!.chapter!.outcome!.electedId === PLAYER_ID) w++;
  }
  return w;
}

describe('the chapter engine (E3 §3.6, R1.2)', () => {
  it('a house chapter: the solemnly professed vote, the priests of age may be elected, and the ballots are the same every time', () => {
    const s = friar('house');
    const house = currentHouse(s)!;
    const opened = openChapter(s, 'house', house.id, 'prior');
    const ch = opened.religious!.chapter!;
    expect(ch.electorIds).toContain(PLAYER_ID);
    for (const id of ch.electorIds.filter((i) => i !== PLAYER_ID)) {
      const n = s.npcs[id]!;
      expect(house.memberIds).toContain(id);
      expect(n.tags).toContain('vows:solemn');
    }
    expect(ch.candidateIds).toContain(PLAYER_ID);
    for (const id of ch.candidateIds.filter((i) => i !== PLAYER_ID)) expect(s.npcs[id]!.title).toBe('Fr.');
    const held = holdElection(opened);
    const c = held.religious!.chapter!;
    expect(c.ballots.length).toBeGreaterThanOrEqual(1);
    expect(c.candidateIds).toContain(c.outcome!.electedId);
    for (const b of c.ballots) expect(Object.values(b.tallies).reduce((a, x) => a + x, 0)).toBe(ch.electorIds.length);
    expect(holdElection(opened)).toEqual(held);
    // A second seed for the same province tells a different story.
    const other = holdElection(openChapter({ ...s, seed: 'other' }, 'house', house.id, 'prior')).religious!.chapter!;
    expect(other.ballots.map((b) => JSON.stringify(b.tallies))).not.toEqual(c.ballots.map((b) => JSON.stringify(b.tallies)));
  });

  it('a provincial chapter seats the provincial, his council, every prior, and a delegate from each house; the player only as an officeholder or delegate', () => {
    const s = friar('prov');
    const voters = electorsOf(s, 'provincial', s.province!.id);
    const ids = new Set(voters.map((v) => v.id));
    expect(ids.has(s.province!.provincialId)).toBe(true);
    for (const id of s.province!.councilIds) expect(ids.has(id), id).toBe(true);
    for (const h of Object.values(s.orderHouses!)) {
      expect(ids.has(h.priorId), h.name).toBe(true);
      expect(voters.filter((v) => v.houseId === h.id).length).toBeGreaterThanOrEqual(2);
    }
    expect(ids.has(PLAYER_ID)).toBe(false);
    expect(electorsOf({ ...s, flags: { ...s.flags, 'chapter:delegate': true } }, 'provincial', s.province!.id).some((v) => v.id === PLAYER_ID)).toBe(true);
    const contenders = contendersOf(s, 'provincial', s.province!.id);
    expect(contenders.every((c) => c.age >= 38)).toBe(true);
    expect(contenders.some((c) => c.isPlayer)).toBe(true);
    // The chapter reads the province: a province in debt weights administration.
    const inDebt = { ...s, province: { ...s.province!, finances: { ...s.province!.finances, balance: -500000 } } };
    expect(provinceState(inDebt)).toBe('debt');
    const admin = contenders[0]!;
    const clerk = { ...admin, stats: { ...admin.stats, administration: 95 } };
    expect(respectOf(inDebt, clerk, 'provincial')).toBeGreaterThan(respectOf(inDebt, admin, 'provincial'));
  });

  it('the ambition inversion: the same man, visibly ambitious, loses the elections he would otherwise win', () => {
    const strong = (seed: string, ambition: number) => liked(friar(seed, 'OP', { perceivedAmbition: ambition, legibility: 80 }), 60);
    const humble = wins((seed) => strong(seed, 5));
    const eager = wins((seed) => strong(seed, 90));
    expect(humble).toBeGreaterThan(eager + 5);
    expect(humble).toBeGreaterThan(15);
  });

  it('legibility: a man the province can describe in a phrase is electable; a competent man nobody can characterize is not', () => {
    const make = (seed: string, legibility: number) => liked(friar(seed, 'OP', { perceivedAmbition: 10, legibility }), 40);
    expect(wins((seed) => make(seed, 95))).toBeGreaterThan(wins((seed) => make(seed, 5)) + 3);
    const s = friar('leg');
    expect(playerLegibility(s)).toBe(20);
    expect(playerLegibility({ ...s, religious: { ...s.religious!, termsServed: [{ office: 'prior', startWeek: 0, endWeek: 156 }], preachingReputation: 50 } })).toBe(55);
  });

  it('as an elector: a vote is his every round, speaking once moves the men who like him, twice is too visibly, and steering is remembered', () => {
    const s = liked(friar('speak'), 50);
    const house = currentHouse(s)!;
    const opened = openChapter(s, 'house', house.id, 'prior');
    const target = opened.religious!.chapter!.candidateIds.find((id) => id !== PLAYER_ID)!;
    const plain = holdElection(opened).religious!.chapter!;
    const backed = holdElection(speakFor(castVote(opened, target), target)).religious!.chapter!;
    expect(backed.ballots[0]!.tallies[target]!).toBeGreaterThanOrEqual(plain.ballots[0]!.tallies[target]!);
    const once = speakFor(opened, target);
    expect(once.religious!.perceivedAmbition).toBe(10 + CHAPTER.ambition.speak);
    expect(once.character!.reputation.province ?? 0).toBe(0);
    const twice = speakFor(once, target);
    expect(twice.religious!.perceivedAmbition).toBe(10 + CHAPTER.ambition.speak + CHAPTER.ambition.speakAgain);
    expect(twice.character!.reputation.province).toBe(-3);
    const steered = steerBloc(opened, target, createRng('seen'));
    expect(steered.religious!.chapter!.actions.steered).toBe(target);
    expect(steered.religious!.perceivedAmbition).toBe(10 + CHAPTER.ambition.steer);
    let seen = 0;
    for (let i = 0; i < 20; i++) if ((steerBloc(opened, target, createRng(`s-${i}`)).character!.reputation.province ?? 0) < 0) seen++;
    expect(seen).toBeGreaterThan(3);
    expect(seen).toBeLessThan(18);
    // As a candidate: unwilling, and the electors half-believe him.
    const unwilling = signalWillingness(opened, 'unwilling');
    expect(unwilling.religious!.perceivedAmbition).toBe(10 + CHAPTER.ambition.unwilling);
    expect(contendersOf(unwilling, 'prior', house.id).find((c) => c.isPlayer)!.unwilling).toBe(true);
  });

  it('elected: accept and serve a term, or decline; twice declined ends the question; the term ends and he returns to the ranks', () => {
    const s = liked(friar('seat', 'OP', { perceivedAmbition: 0, legibility: 100 }), 90);
    const house = currentHouse(s)!;
    let held: GameState | undefined;
    for (let i = 0; i < 20 && !held; i++) {
      const t = holdElection(openChapter({ ...s, seed: `seat-${i}` }, 'house', house.id, 'prior'));
      if (t.religious!.chapter!.outcome!.electedId === PLAYER_ID) held = t;
    }
    expect(held).toBeDefined();
    // Accept.
    const seated = resolveElection(held!, createRng('confirm'), true);
    const o = seated.religious!.office!;
    expect(o.office).toBe('prior');
    expect(o.bodyId).toBe(house.id);
    expect(o.endWeek - o.startWeek).toBe(religiousOrder('OP').governance.priorTermYears * 52);
    expect(o.consecutive).toBe(1);
    expect(seated.flags['office:prior']).toBe(s.clock.week);
    expect(seated.character!.reputation.superiors).toBe(4);
    expect(seated.religious!.perceivedAmbition).toBe(CHAPTER.ambition.accept);
    expect(seated.career.at(-1)!.text).toMatch(/Elected prior/);
    expect(termOver(seated)).toBe(false);
    expect(termOver({ ...seated, clock: { ...seated.clock, week: o.endWeek } })).toBe(true);
    expect(closeChapter(seated).religious!.chapter).toBeUndefined();
    // Return well, then badly.
    const ended = { ...seated, clock: { ...seated.clock, week: o.endWeek } };
    const well = returnToRanks(ended, 'well');
    expect(well.religious!.office).toBeUndefined();
    expect(well.religious!.termsServed).toEqual([{ office: 'prior', startWeek: o.startWeek, endWeek: o.endWeek }]);
    expect(well.flags['office:prior']).toBeUndefined();
    expect(well.character!.reputation.province).toBe(8);
    expect(returnToRanks(ended, 'badly').character!.reputation.province).toBe(-10);
    // Decline: honored, and the runner-up takes the house.
    const declined = resolveElection(held!, createRng('confirm'), false);
    expect(declined.religious!.declined!.prior).toBe(1);
    expect(declined.religious!.office).toBeUndefined();
    expect(declined.character!.reputation.province).toBe(5);
    const newPrior = declined.religious!.chapter!.outcome!.electedId;
    expect(newPrior).not.toBe(PLAYER_ID);
    expect(declined.religious!.chapter!.outcome!.second).toBe(true);
    expect(declined.orderHouses![house.id]!.priorId).toBe(newPrior);
    expect(declined.npcs[newPrior]!.tags).toContain('prior');
    expect(declined.npcs[house.priorId]!.tags.includes('prior')).toBe(newPrior === house.priorId);
    const twice = declineElection(declined);
    expect(twice.religious!.declined!.prior).toBe(2);
    expect(contendersOf(twice, 'prior', house.id).some((c) => c.isPlayer)).toBe(false);
    // Declining when he looked ambitious costs instead.
    const eager = declineElection({ ...held!, religious: { ...held!.religious!, perceivedAmbition: 60 } });
    expect(eager.character!.reputation.superiors).toBe(-8);
  });

  it('confirmation is almost always given; a man his superiors distrust can be refused, and the runner-up is seated', () => {
    const s = liked(friar('confirm', 'OP', { perceivedAmbition: 0, legibility: 100 }), 90);
    const house = currentHouse(s)!;
    let held: GameState | undefined;
    for (let i = 0; i < 20 && !held; i++) {
      const t = holdElection(openChapter({ ...s, seed: `c-${i}` }, 'house', house.id, 'prior'));
      if (t.religious!.chapter!.outcome!.electedId === PLAYER_ID) held = t;
    }
    expect(confirmChance(held!, PLAYER_ID)).toBe(CHAPTER.confirm.base);
    const distrusted = { ...held!, character: { ...held!.character!, reputation: { ...held!.character!.reputation, superiors: -60 } } };
    expect(confirmChance(distrusted, PLAYER_ID)).toBe(CHAPTER.confirm.whenLow);
    let refused: GameState | undefined;
    for (let i = 0; i < 40 && !refused; i++) {
      const r = resolveElection(distrusted, createRng(`r-${i}`), true);
      if (r.flags['chapter:refused:prior'] !== undefined) refused = r;
    }
    expect(refused).toBeDefined();
    expect(refused!.religious!.office).toBeUndefined();
    expect(refused!.religious!.chapter!.outcome!.electedId).not.toBe(PLAYER_ID);
    expect(refused!.religious!.chapter!.outcome!.second).toBe(true);
    expect(refused!.orderHouses![house.id]!.priorId).toBe(refused!.religious!.chapter!.outcome!.electedId);
  });

  it('a provincial election from the same seed gives the same ballots; different seeds give varied, plausible outcomes including upsets', () => {
    const s = friar('upset');
    const open = (seed: string) => openChapter({ ...s, seed }, 'provincial', s.province!.id, 'provincial');
    const one = holdElection(open('p-0')).religious!.chapter!;
    expect(holdElection(open('p-0')).religious!.chapter!).toEqual(one);
    const winners: string[] = [];
    let respected = 0;
    for (let i = 0; i < 40; i++) {
      const st = open(`p-${i}`);
      const ch = holdElection(st).religious!.chapter!;
      winners.push(ch.outcome!.electedId);
      const contenders = contendersOf(st, 'provincial', s.province!.id);
      const top = contenders.map((c) => ({ c, r: respectOf(st, c, 'provincial') })).sort((a, b) => b.r - a.r)[0]!.c.id;
      if (top === ch.outcome!.electedId) respected++;
    }
    expect(new Set(winners).size).toBeGreaterThanOrEqual(3);
    expect(respected).toBeLessThan(40);
    // Seating an NPC as provincial moves the office and the tag.
    const seated = resolveElection(holdElection(open('p-1')), createRng('x'));
    const id = seated.religious!.chapter!.outcome!.electedId;
    expect(seated.province!.provincialId).toBe(id);
    expect(seated.npcs[id]!.tags).toContain('provincial');
    expect(seated.flags[`terms:provincial:${id}`]).toBe(1);
  });
});
