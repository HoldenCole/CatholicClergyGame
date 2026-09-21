import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { acknowledgeEvaluation, ordain, startSeminary } from '@/engine/seminary';
import { applyEffects } from '@/engine/effects';
import { testNpc } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { creationContent } from '@/content/creation';
import { applyCreation } from '@/systems/creation';
import { beginReligious, generateProvinceCandidates } from '@/systems/religious/newGame';
import { formationStage } from '@/systems/religious/formation';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { befriend, friendPietyFactor, friendshipLoad, friendshipWeek, friendsNearAndFar, friendSlots, mayBefriend, FRIENDSHIP } from '@/systems/religious/friendship';
import { pietyCeiling, RESTLESS, restlessPietyFactor, restlessWeek, statDeltaFactor } from '@/systems/religious/restless';
import { horariumLoad } from '@/systems/religious/horarium';
import { preachingOf, studyApFactor } from '@/systems/religious/study';
import { officeOffers } from '@/systems/religious/offices';
import { moveToHouse } from '@/systems/religious/transfer';
import { pietyLabelsOf } from '@/systems/religious/feel';
import { pillarsOf } from '@/systems/campaign';
import { pietyFactor } from '@/systems/direction';
import type { CreationAnswers, GameState, Npc, OrderKey } from '@/types';

const answers: CreationAnswers = { firstName: 'Michael', lastName: 'Hale', portrait: 'p1', entryYear: 2010, origin: 'suburban', tie: 'transfer', path: 'college', field: 'philosophy', career: null, yearsWorked: 0, motive: 'priest', family: 'supportive', past: null };

function novice(seed: string, order: OrderKey): GameState {
  const { state, rng } = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  const candidates = generateProvinceCandidates(rng.derive('provinces'), order, 2010);
  let s = applyCreation({ ...state, campaign: 'religious' }, answers, creationContent);
  s = beginReligious(s, candidates[0]!, { order, provinceId: candidates[0]!.province.id, why: 'community', tie: 'near_house' }, 2010);
  const npcs: Record<string, Npc> = { ...s.npcs, c1: testNpc('c1', { role: 'classmate', tags: ['classmate'] }) };
  s = startSeminary({ ...s, npcs }, ['c1'], 'the novitiate');
  // The province thinks well of him, so the votes of a career test go his way.
  for (const id of s.province!.friarIds) npcs[id] = { ...npcs[id]!, relationship: 45 };
  return { ...s, npcs, mode: { kind: 'clock' } };
}

function endYear(s: GameState): GameState {
  const record = { year: s.seminary!.year, result: 'ADVANCED' as const, pillars: { human: 8, spiritual: 8, intellectual: 8, pastoral: 8 }, notes: [] };
  const w = { ...s, seminary: { ...s.seminary!, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 } }, clock: { ...s.clock, week: s.clock.week + 52 } };
  return acknowledgeEvaluation({ ...w, mode: { kind: 'evaluation', record } } as GameState);
}

describe('the Augustinians (E3 R1.4, §7)', () => {
  it('formation: a pre-novitiate in a priory, the novitiate, then annual renewals each voted, solemn vows in the fifth year', () => {
    let s = novice('osa', 'OSA');
    expect(currentHouse(s)!.kind).toBe('priory');
    expect(formationStage(s)!.label).toBe('Pre-novitiate');
    s = endYear(s);
    expect(currentHouse(s)!.kind).toBe('novitiate');
    expect(s.religious!.vows.simpleWeek).toBeUndefined();
    s = endYear(s);
    expect(s.religious!.vows.simpleWeek).toBeDefined();
    expect(currentHouse(s)!.kind).toBe('studium');
    s = endYear(s);
    s = endYear(s);
    expect(s.religious!.vows.renewals.length).toBe(2);
    expect(religiousOrder('OSA').formation.filter((f) => f.milestone === 'renewal').every((f) => f.communityVote)).toBe(true);
    s = endYear(s);
    expect(s.religious!.vows.solemnWeek).toBeDefined();
    expect(s.seminary!.year).toBe(6);
    s = endYear(s);
    expect(s.flags.diaconate).toBeDefined();
    s = endYear(s);
    expect(s.mode.kind).toBe('ordination');
    const o = ordain(s, createRng('o'));
    expect(o.religious!.consultation!.reason).toBe('first');
  });

  it('friendship: three slots, named from brothers who know him, kept at a cost across distance, deepening at the table, and torn by a transfer', () => {
    const s = novice('friends', 'OSA');
    expect(friendSlots(s)).toBe(3);
    expect(friendSlots(novice('friends-op', 'OP'))).toBe(0);
    const house = currentHouse(s)!;
    const men = membersOf(s, house);
    const [a, b, c, d] = men;
    expect(mayBefriend(s, a!.id).ok).toBe(true);
    const cold = { ...s, npcs: { ...s.npcs, [b!.id]: { ...b!, relationship: 10 } } };
    expect(mayBefriend(cold, b!.id).why).toMatch(/well enough/);
    const f = befriend(befriend(befriend(s, a!.id), b!.id), c!.id);
    expect(f.religious!.closeFriendIds).toEqual([a!.id, b!.id, c!.id]);
    expect(mayBefriend(f, d!.id).why).toBe('No room for another');
    expect(befriend(f, d!.id)).toBe(f);
    expect(friendshipLoad(f)).toBe(0);
    expect(friendPietyFactor(f)).toBeCloseTo(1 + 3 * FRIENDSHIP.pietyPerNear);
    expect(pietyFactor(f, 0)).toBeLessThan(pietyFactor(s, 0));
    const week = friendshipWeek(f);
    expect(week.npcs[a!.id]!.relationship).toBeCloseTo(45 + FRIENDSHIP.near);
    // A transfer: friends left behind cost piety and strain; kept at a distance they cost hours and fade.
    const other = Object.values(s.orderHouses!).find((h) => h.id !== house.id)!;
    const moved = moveToHouse(f, other.id, other.works[0]!);
    expect(moved.flags['friend:split']).toBe(s.clock.week);
    expect(moved.character!.stats.piety).toBeLessThan(f.character!.stats.piety);
    expect(moved.strain).toBeGreaterThan(f.strain);
    expect(friendsNearAndFar(moved).far.length).toBe(3);
    expect(friendshipLoad(moved)).toBe(3 * FRIENDSHIP.distantAp);
    let far = moved;
    for (let i = 0; i < 80; i++) far = friendshipWeek(far);
    expect(far.religious!.closeFriendIds!.length).toBe(0);
    expect(far.flags['friend:lapsed']).toBeDefined();
    // The Dominican move costs nothing of the kind.
    const op = novice('friends-op', 'OP');
    const opOther = Object.values(op.orderHouses!).find((h) => h.id !== op.religious!.houseId)!;
    expect(moveToHouse(op, opOther.id, opOther.works[0]!).flags['friend:split']).toBeUndefined();
  });

  it('the restless heart: piety swings wider both ways, and a survived crisis raises the ceiling', () => {
    const osa = novice('restless', 'OSA');
    const op = novice('restless-op', 'OP');
    expect(statDeltaFactor(osa, 'piety', 5)).toBeCloseTo(RESTLESS.swing);
    expect(statDeltaFactor(osa, 'piety', -5)).toBeCloseTo(RESTLESS.swing);
    expect(statDeltaFactor(osa, 'theology', 5)).toBe(1);
    expect(statDeltaFactor(op, 'piety', 5)).toBe(1);
    expect(restlessPietyFactor(osa)).toBe(RESTLESS.swing);
    expect(restlessPietyFactor(op)).toBe(1);
    const up = applyEffects(osa, [{ target: 'stat', key: 'piety', delta: 4 }]);
    const upOp = applyEffects(op, [{ target: 'stat', key: 'piety', delta: 4 }]);
    expect(up.character!.stats.piety - osa.character!.stats.piety).toBeGreaterThan(upOp.character!.stats.piety - op.character!.stats.piety);
    // Down into a crisis, and out the other side.
    let s: GameState = { ...osa, character: { ...osa.character!, stats: { ...osa.character!.stats, piety: 20 } } };
    s = restlessWeek(s);
    expect(s.flags['restless:crisis']).toBe(s.clock.week);
    expect(pietyCeiling(s)).toBe(0);
    s = restlessWeek({ ...s, character: { ...s.character!, stats: { ...s.character!.stats, piety: 46 } } });
    expect(s.flags['restless:crisis']).toBeUndefined();
    expect(s.flags['restless:crises']).toBe(1);
    expect(pietyCeiling(s)).toBe(RESTLESS.ceilingPerCrisis);
    expect(s.character!.stats.piety).toBe(46 + RESTLESS.survivedGain);
    expect(statDeltaFactor(s, 'piety', 5)).toBeCloseTo(RESTLESS.swing * (1 + RESTLESS.ceilingPerCrisis / RESTLESS.ceilingScale));
    expect(s.career.at(-1)!.text).toMatch(/higher than before/);
    // The Dominican has no such curve.
    expect(restlessWeek({ ...op, character: { ...op.character!, stats: { ...op.character!.stats, piety: 20 } } }).flags['restless:crisis']).toBeUndefined();
  });

  it('the education and mission tracks are the order\'s offices', () => {
    let s = novice('tracks', 'OSA');
    s = { ...s, flags: { ...s.flags, ordained: true, ordination_week: s.clock.week - 10 * 52 }, character: { ...s.character!, stats: { administration: 65, charisma: 60, theology: 55, knowledge: 55, piety: 60 } } };
    const offers = officeOffers(s);
    expect(offers.map((o) => o.def.id)).toEqual(['novice_director', 'formation_director', 'vocation_director', 'school_president', 'mission_superior']);
    expect(offers.find((o) => o.def.id === 'school_president')!.available).toBe(true);
    expect(offers.find((o) => o.def.id === 'mission_superior')!.available).toBe(true);
    expect(religiousOrder('OSA').credentials.map((c) => c.id)).toEqual(['patristics', 'educational_administration']);
  });
});

describe('the build test (E3 §10): the same man in both orders is two games by year ten', () => {
  it('reads differently in every system that is data on the order', () => {
    const op = novice('feel', 'OP');
    const osa = novice('feel', 'OSA');
    const a = pietyLabelsOf(op);
    const b = pietyLabelsOf(osa);
    expect(a).not.toEqual(b);
    expect(pillarsOf(op).map((p) => p.label)).toEqual(['Community', 'Prayer', 'Study', 'Preaching']);
    expect(pillarsOf(osa).map((p) => p.label)).toEqual(['Community', 'Interiority', 'Truth', 'Service']);
    expect(horariumLoad(op)).toBeGreaterThan(horariumLoad(osa));
    expect(studyApFactor(op)).toBeLessThan(studyApFactor(osa));
    expect(preachingOf(op)).toBeDefined();
    expect(preachingOf(osa)).toBeUndefined();
    expect(friendSlots(osa)).toBeGreaterThan(friendSlots(op));
    expect(religiousOrder('OP').formation.filter((f) => f.milestone === 'renewal').length).toBeLessThan(religiousOrder('OSA').formation.filter((f) => f.milestone === 'renewal').length);
    expect(religiousOrder('OP').formation.filter((f) => f.communityVote).length).toBeLessThan(religiousOrder('OSA').formation.filter((f) => f.communityVote).length);
    expect(religiousOrder('OP').mechanics.democracy!).toBeGreaterThan(religiousOrder('OSA').mechanics.democracy!);
    expect(religiousOrder('OP').governance.generalRenewable).toBe(false);
    expect(religiousOrder('OSA').governance.generalRenewable).toBe(true);
    expect(op.religious!.religiousName).toBeUndefined();
    expect(a.join(' ')).toMatch(/choir|study|preach/i);
    expect(b.join(' ')).toMatch(/friend|house|heart/i);
  });
});
