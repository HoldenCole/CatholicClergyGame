import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { circleLabel, circleOf, circleOrder } from '@/systems/circle';
import { whoWord, lifeOf } from '@/systems/life';
import { housesUnderFloor, provincialAct, provincialActs, provincialHouses, provincialMen } from '@/systems/religious/provincialDesk';
import { consult } from '@/systems/religious/obedience';
import { seedRumour, talkOf } from '@/systems/talk';
import { mayTalk, whoIs } from '@/systems/talks';
import { careerSummary } from '@/engine/career';
import { membersOf } from '@/systems/religious/house';
import type { GameState } from '@/types';

/** A solemnly professed priest of fifty in a house of his province. */
function friar(seed: string, patch: Partial<NonNullable<GameState['religious']>> = {}): GameState {
  const def = religiousOrder('OP');
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 60, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true }, mode: { kind: 'clock' } }, gen, 2010, priory.id);
  s = { ...s, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10, ...patch } };
  return s;
}

function provincial(seed: string): GameState {
  const s = friar(seed);
  return { ...s, province: { ...s.province!, provincialId: 'player' }, religious: { ...s.religious!, office: { office: 'provincial', bodyId: s.province!.id, startWeek: 0, endWeek: 208, consecutive: 1 } } };
}

describe('Q1: the friar\'s circle', () => {
  it('groups the men of his house under the house, labelled in the friar\'s words, ahead of the class', () => {
    const s = friar('circle');
    const rows = circleOf(s);
    const house = s.orderHouses![s.religious!.houseId]!;
    const atTable = rows.filter((r) => r.group === 'house');
    expect(atTable.length).toBe(membersOf(s, house).length);
    expect(circleLabel(s, 'house')).toBe('The house, at table');
    expect(circleOrder(s).indexOf('house')).toBeLessThan(circleOrder(s).indexOf('class'));
    for (const r of atTable) expect(['friar', 'prior', 'provincial', 'novice', 'student brother', 'brother', 'novice master', 'master of students']).toContain(r.who);
  });

  it('a word can be had with a confrere, and the diocesan labels stay for a diocesan man', () => {
    const s = friar('word');
    const brother = membersOf(s, s.orderHouses![s.religious!.houseId]!)[0]!;
    expect(whoIs(s, brother)).toBe('confrere');
    expect(mayTalk(s, brother.id).ok).toBe(true);
    expect(whoWord(s, brother)).not.toBe('parishioner');
    const diocesan = seminaryState('dio');
    expect(circleLabel(diocesan, 'brothers')).toBe('Brother priests');
    expect(circleOrder(diocesan)).not.toContain('house');
  });
});

describe('Q2: the shelf reads a friar\'s life', () => {
  it('lists his houses and offices and says the obediences in the summary', () => {
    const s0 = friar('shelf');
    const s: GameState = { ...s0, clock: { ...s0.clock, week: 520 }, religious: { ...s0.religious!, assignments: [{ houseId: s0.religious!.houseId, dioceseId: 'x', work: 'priory_church', startWeek: 0, endWeek: 260 }, { houseId: s0.religious!.houseId, dioceseId: 'x', work: 'parish', startWeek: 260, grace: 'reluctant' }], obedience: { accepted: 1, reluctant: 1, refused: 0 }, termsServed: [{ office: 'prior', startWeek: 52, endWeek: 208 }] } };
    const life = lifeOf(s);
    expect(life.houses?.length).toBe(2);
    expect(life.houses?.[1]?.grace).toBe('taken badly');
    expect(life.terms?.[0]?.label).toBe('prior');
    const summary = careerSummary(s, 'retired');
    expect(summary).toMatch(/Sent once under obedience|Sent 2 times under obedience/);
    expect(summary).toContain('prior once');
    expect(summary).not.toContain('appointed');
  });
});

describe('Q3: the provincial\'s desk', () => {
  it('is nobody\'s but the provincial\'s', () => {
    const s = friar('desk');
    expect(provincialActs(s).every((a) => !a.available)).toBe(true);
    const p = provincial('desk');
    expect(provincialActs(p).some((a) => a.available)).toBe(true);
  });

  it('a levy takes a tenth of every purse to the province and is not done twice in a year', () => {
    const p = provincial('levy');
    const before = p.province!.finances.balance;
    const purses = provincialHouses(p).reduce((n, h) => n + Math.max(0, Math.round(h.budget * 0.1)), 0);
    const res = provincialAct(p, 'levy_houses', {}, createRng('levy'));
    expect(res.state.province!.finances.balance - before).toBe(purses);
    expect(res.line).toContain('levy');
    expect(provincialActs(res.state).find((a) => a.def.id === 'levy_houses')!.available).toBe(false);
  });

  it('sending a man moves him between houses and the house he leaves is a man short', () => {
    const p = provincial('send');
    const men = provincialMen(p);
    const { npc, house: from } = men[0]!;
    const to = provincialHouses(p).find((h) => h.id !== from.id)!;
    const res = provincialAct(p, 'move_man', { npcId: npc.id, houseId: to.id }, createRng('send'));
    expect(res.state.orderHouses![to.id]!.memberIds).toContain(npc.id);
    expect(res.state.orderHouses![from.id]!.memberIds).not.toContain(npc.id);
    expect(res.state.npcs[npc.id]!.tags).toContain(`house:${to.id}`);
    expect(res.line).toContain(to.name);
  });

  it('a visit tidies the house toward the province\'s custom, and a house can only be closed under its floor', () => {
    const p = provincial('visit');
    const house = provincialHouses(p).find((h) => h.id !== p.religious!.houseId)!;
    const lax = { ...p, orderHouses: { ...p.orderHouses, [house.id]: { ...house, observance: 30 } } };
    const res = provincialAct(lax, 'visit_house', { houseId: house.id }, createRng('visit'));
    expect(res.state.orderHouses![house.id]!.observance).toBeGreaterThan(30);
    expect(res.line).toContain(house.name);
    const closing = provincialActs(lax).find((a) => a.def.id === 'close_house')!;
    expect(closing.available).toBe(housesUnderFloor(lax).length > 0);
  });
});

describe('Q4: the consultation says what the house needs', () => {
  it('each option carries the work, the life against his own, and the men he knows', () => {
    const s = friar('consult');
    const c = consult(s, createRng('consult')).religious!.consultation!;
    expect(c.options.length).toBeGreaterThan(0);
    for (const o of c.options) {
      expect(o.why).toBeTruthy();
      expect(o.why).toMatch(/stricter than you keep|looser than you keep|about as you do/);
    }
  });
});

describe('Q5: what is said, in the friar\'s idiom', () => {
  it('a friar\'s talk about him is the house\'s, not the deanery\'s, and reaches the provincial', () => {
    const s = friar('talk');
    const seeded = seedRumour(s, createRng('talk'), 'named');
    const r = talkOf(seeded).rumours[0]!;
    expect(r.text).not.toContain('chancery');
    expect(r.text).toMatch(/provincial|council|house|prior|chapter/);
    const dio = seedRumour({ ...seminaryState('dio'), character: testCharacter() }, createRng('talk'), 'named');
    expect(talkOf(dio).rumours[0]!.text).not.toMatch(/provincial|the house/);
  });
});
