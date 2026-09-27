import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { fromDayNumber } from '@/engine/calendar';
import { runElection } from '@/systems/ballot';
import { CONCLAVE, PLAYER, collegeElects, electorsOn, papabiliOf } from '@/systems/rome/conclave';
import { COLLEGE, collegeWeek, makeCardinal, mayBeCreated, seedCollege } from '@/systems/rome/college';
import { answerConclave, conclaveAct, holdTheConclave, maybeOpenConclave } from '@/systems/rome/conclaveFlow';
import { papacyWeek } from '@/systems/rome/papacy';
import { parishState } from './week.test';
import type { Cardinal, GameState, Papacy } from '@/types';

const late: Papacy = { id: 'gen:9', name: 'Gregory XVII', born: 1950, electedDay: 0, endDay: 1, end: 'died', from: 'Italy', temperament: 0, historical: false };

/** A cardinal under eighty in a see vacant this week: a generated pope has died, and the College is the world's. */
function inRome(seed: string, college?: Cardinal[]): GameState {
  const base = parishState(seed);
  const day = sundayOf(base.clock);
  const c = base.character!;
  return {
    ...base,
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, reputation: { ...c.reputation, rome: 60 } },
    flags: { ...base.flags, cardinal: true, ordination_week: base.clock.week - 30 * 52 },
    rome: { ...base.rome!, popes: [{ ...late, endDay: day - 1 }], vacancy: { sinceDay: day - 1, electionDay: day + 30, cause: 'died', priorId: late.id }, college: college ?? seedCollege(seed, day).college },
  };
}

function weeks(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    s = papacyWeek(s).state;
    s = maybeOpenConclave(s);
    if (s.mode.kind !== 'clock') break;
  }
  return s;
}

/** A hand-made College: every elector reading `room`, and two papabili at either end. */
function room(seed: string, day: number, reading: number): Cardinal[] {
  const year = fromDayNumber(day).year;
  const electors = Array.from({ length: 60 }, (_, i) => ({ ...makeCardinal(seed, i + 1, day, { id: 'gen:1', temperament: 0 }), temperament: reading, papabile: 0.1, born: year - 70, diesDay: day + 9999, region: 'Europe' }));
  const reform = { ...electors[0]!, id: 'card:reform', name: 'Reformer', temperament: 80, papabile: 0.9 };
  const trad = { ...electors[1]!, id: 'card:trad', name: 'Traditionalist', temperament: -80, papabile: 0.9 };
  return [reform, trad, ...electors.slice(2)];
}

describe('the conclave rules', () => {
  it('need two thirds, and the two in the runoff do not vote', () => {
    const electors = Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, scores: { a: i < 5 ? 10 : 0, b: i < 5 ? 0 : 10 } }));
    const r = runElection(createRng('two-thirds'), electors, ['a', 'b'], { ...CONCLAVE, majorityRounds: 2, maxRounds: 3, shiftRate: 0 });
    // Five of nine is a majority and not two thirds: the first rounds do not elect.
    expect(r.rounds[0]!.tallies.a).toBe(5);
    expect(r.rounds.length).toBeGreaterThan(1);
  });
});

describe('the College', () => {
  it('holds a hundred and twenty electors, the same in the same world, reading as the popes who made them', () => {
    const day = sundayOf(parishState('college').clock);
    const a = seedCollege('college', day);
    expect(electorsOn(a.college, day)).toHaveLength(COLLEGE.electors);
    expect(seedCollege('college', day)).toEqual(a);
    expect(new Set(a.college.map((c) => c.from)).size).toBeGreaterThan(8);
    const papabili = papabiliOf('college', a.college, day);
    expect(papabili).toHaveLength(5);
  });

  it('is refilled at a consistory by men of the reigning pope, and a great see may bring the red hat', () => {
    let s = parishState('consistory');
    s = collegeWeek(s).state;
    const first = s.rome!.nextConsistoryDay!;
    const before = s.rome!.cardinalsMade!;
    while (sundayOf(s.clock) < first) s = collegeWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(s.rome!.cardinalsMade!).toBeGreaterThan(before);
    expect(s.rome!.nextConsistoryDay!).toBeGreaterThan(first);
    // An archbishop of a great see, Rome's regard high: the kind of man the pope creates.
    const c = s.character!;
    const archbishop: GameState = { ...s, character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, reputation: { ...c.reputation, rome: 60 } }, see: { id: 'chicago', name: 'the Archdiocese of Chicago', see: 'Chicago', region: 'Illinois', installedWeek: 0, presbyterate: 0, people: 0, rome: 0, money: 0, shortage: 3, ordinations: 0, closings: 0, years: [{}, {}] as never } };
    expect(mayBeCreated(archbishop, sundayOf(archbishop.clock))).toBe(true);
    expect(mayBeCreated({ ...archbishop, see: null }, sundayOf(archbishop.clock))).toBe(false);
  });
});

describe('the name follows from what the room was', () => {
  it('a reforming room elects the reformer, and a traditional room the traditionalist', () => {
    const s = parishState('room');
    const day = sundayOf(s.clock);
    expect(collegeElects(s, room('room', day, 70), day)?.id).toBe('card:reform');
    expect(collegeElects(s, room('room', day, -70), day)?.id).toBe('card:trad');
  });

  it("after the record, the pope is the College's man: his reading, his country, his years; and he leaves the College", () => {
    const s = inRome('elects', undefined);
    const outside: GameState = { ...s, flags: { ...s.flags, cardinal: false } };
    const elected = weeks(outside, 6);
    const pope = elected.rome!.popes.at(-1)!;
    expect(pope.historical).toBe(false);
    expect(elected.rome!.vacancy).toBeUndefined();
    // Exactly one cardinal has left the College for the chair, and the pope is he.
    const left = s.rome!.college!.filter((c) => !elected.rome!.college!.some((x) => x.id === c.id) && c.diesDay > sundayOf(elected.clock));
    expect(left).toHaveLength(1);
    expect(pope).toMatchObject({ from: left[0]!.from, temperament: left[0]!.temperament, born: left[0]!.born });
  });
});

describe('a cardinal in the conclave', () => {
  it('goes in fifteen days after the see falls vacant, and Rome waits for his ballots', () => {
    const s = weeks(inRome('inside'), 6);
    expect(s.mode.kind).toBe('conclave');
    expect(s.rome!.vacancy).toBeDefined();
    const c = s.rome!.conclave!;
    expect(c.electorIds).toContain(PLAYER);
    expect(c.candidateIds.length).toBeGreaterThanOrEqual(5);
  });

  it('votes, hears the ballots, and the man named is proclaimed on the election day', () => {
    let s = weeks(inRome('votes'), 6);
    const choice = s.rome!.conclave!.candidateIds.find((id) => id !== PLAYER)!;
    s = conclaveAct(s, 'speech', 'pastor');
    s = conclaveAct(s, 'vote', choice);
    s = holdTheConclave(s);
    const c = s.rome!.conclave!;
    expect(c.ballots!.length).toBeGreaterThan(0);
    const last = c.ballots!.at(-1)!;
    if (last.round <= CONCLAVE.majorityRounds) expect(last.tallies[c.electedId!]!).toBeGreaterThanOrEqual(Math.ceil((c.electorIds.length * 2) / 3 - 1e-9));
    expect(c.electedId).not.toBe(PLAYER);
    s = answerConclave(s, true);
    expect(s.mode.kind).toBe('clock');
    expect(s.rome!.vacancy!.winnerId).toBe(c.electedId);
    expect(s.rome!.collegeScene?.kind).toBe('after');
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 6 } };
    s = papacyWeek(s).state;
    const winner = inRome('votes').rome!.college!.find((x) => x.id === c.electedId)!;
    expect(s.rome!.popes.at(-1)!.temperament).toBe(winner.temperament);
  });

  it('can be elected himself, and accept, or refuse and let the College vote again', () => {
    // A room that reads as he does, and a man Rome rates highly.
    const day = sundayOf(parishState('elected').clock);
    let s = inRome('elected', room('elected', day, 60));
    // A man of seventy-two, the age the College looks for.
    s = { ...s, character: { ...s.character!, entryYear: 1970, background: { ...s.character!.background, entryAge: 25 }, alignment: 60, reputation: { ...s.character!.reputation, rome: 100, chancery: 100 } }, flags: { ...s.flags, vg_served: true, rome_alumnus: true, 'curia:secretary': true } };
    s = weeks(s, 6);
    expect(s.rome!.conclave!.candidateIds).toContain(PLAYER);
    s = conclaveAct(s, 'vote', 'card:reform');
    s = conclaveAct(s, 'signal', 'unwilling');
    // Tip the room further: the reformer and the traditionalist are too far from its reading for most of it.
    s = { ...s, rome: { ...s.rome!, college: s.rome!.college!.map((c) => (c.id === 'card:reform' ? { ...c, temperament: 100, papabile: 0.2 } : c)) } };
    s = holdTheConclave(s);
    expect(s.rome!.conclave!.electedId).toBe(PLAYER);
    const accepted = answerConclave(s, true, 'Clement XV');
    expect(accepted.mode).toMatchObject({ kind: 'ended', ending: 'elected_pope' });
    expect(accepted.mode.kind === 'ended' && accepted.mode.summary).toMatch(/took the name Clement XV/);
    const refused = answerConclave(s, false);
    expect(refused.rome!.conclave!.declined).toBe(true);
    expect(refused.rome!.conclave!.electedId).not.toBe(PLAYER);
    expect(refused.flags['conclave:refused']).toBe(true);
  });

  it('does not play a conclave the record already decided', () => {
    const s = inRome('record');
    const franciscan: GameState = { ...s, rome: { ...s.rome!, popes: [{ id: 'hist:benedict_xvi', name: 'Benedict XVI', born: 1927, electedDay: 0, endDay: 1, end: 'resigned', from: 'Germany', temperament: -40, historical: true }], vacancy: { ...s.rome!.vacancy!, priorId: 'hist:benedict_xvi' } } };
    expect(weeks(franciscan, 3).mode.kind).toBe('clock');
  });
});
