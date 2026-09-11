import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { generateCandidates, installWorld } from '@/generation/world';
import { freshSeminary } from '@/engine/seminary';
import { assignFirstParish, scoreParish } from '@/systems/assignment';
import { formationStanding, parishPrestige, summersOnRecord } from '@/systems/standing';
import { applyForOpening, chancesFor } from '@/systems/openings';
import { boardDecision } from '@/engine/career';
import { describeUnmet, offerDoors, whyNot } from '@/systems/doors';
import { allOffers } from '@/content/offers';
import { testCharacter } from '../helpers/fixtures';
import { parishState } from './week.test';
import type { EvaluationRecord, GameState, Opening, Pillar } from '@/types';

function evalRecord(year: number, result: EvaluationRecord['result'], pillar: number): EvaluationRecord {
  const pillars = Object.fromEntries((['human', 'spiritual', 'intellectual', 'pastoral'] as Pillar[]).map((p) => [p, pillar])) as Record<Pillar, number>;
  return { year, result, pillars, notes: [] };
}

function deacon(seed: string, record: 'strong' | 'weak', presetIndex = 2): GameState {
  const { state } = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  const cands = generateCandidates(createRng(seed), 2010);
  const s = installWorld(state, cands[presetIndex]!, 2010);
  const evaluations = [1, 2, 3, 4, 5, 6].map((y) => (record === 'strong' ? evalRecord(y, 'ADVANCED', 13) : evalRecord(y, 'ADVANCED_WITH_CONCERNS', 5)));
  const seminary = { ...freshSeminary([]), year: 7, evaluations, heldBackCount: record === 'strong' ? 0 : 1 };
  return { ...s, character: testCharacter(), seminary, flags: {} };
}

describe('assignments that mean something', () => {
  it('the formation record is read as standing, and prestige orders the parishes', () => {
    const strong = formationStanding(deacon('st', 'strong'));
    const weak = formationStanding(deacon('st', 'weak'));
    expect(strong.value).toBeGreaterThanOrEqual(80);
    expect(weak.value).toBeLessThan(35);
    expect(strong.word).toBe('the top of the class');
    expect(strong.reasons.join(' ')).toMatch(/evaluation/);
    const s = deacon('st', 'strong');
    const kinds = Object.fromEntries(s.world!.parishes.map((p) => [p.kind, parishPrestige(p)]));
    expect(kinds.flagship_suburban!).toBeGreaterThan(kinds.rural!);
    expect(kinds.rural!).toBeGreaterThan(kinds.difficult! - 0.01);
  });

  it('the top of the class is sent where he will be seen; a thin record goes somewhere quiet', () => {
    let strongSeen = 0;
    let weakQuiet = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const strong = deacon(`fa-${i}`, 'strong');
      const a = assignFirstParish(strong, createRng(`fa-${i}:x`));
      const kind = strong.world!.parishes.find((p) => p.id === a.parishId)!.kind;
      if (kind === 'flagship_suburban' || kind === 'immigrant_growing') strongSeen++;
      const weak = deacon(`fa-${i}`, 'weak');
      const b = assignFirstParish(weak, createRng(`fa-${i}:x`));
      const kindB = weak.world!.parishes.find((p) => p.id === b.parishId)!.kind;
      if (kindB === 'rural' || kindB === 'difficult' || kindB === 'struggling_urban') weakQuiet++;
    }
    expect(strongSeen).toBeGreaterThan(N * 0.55);
    expect(weakQuiet).toBeGreaterThan(N * 0.55);
    // And the letter says why.
    const strong = deacon('why', 'strong');
    const flagship = strong.world!.parishes.find((p) => p.kind === 'flagship_suburban')!;
    expect(scoreParish(strong, strong.world!, flagship).reasons.join(' ')).toMatch(/top of the class/);
  });

  it('the summers are remembered by the board', () => {
    const s = deacon('sum', 'strong');
    const hard = s.world!.parishes.find((p) => p.kind === 'difficult')!;
    const before = scoreParish(s, s.world!, hard).score;
    const after = scoreParish({ ...s, flags: { 'summer:hard_parish': true } }, s.world!, hard);
    expect(after.score).toBeGreaterThan(before + 10);
    expect(after.reasons.join(' ')).toMatch(/hard parish/);
    const withRecord = { ...s, seminary: { ...s.seminary!, summers: { 3: 'chancery' as const, 5: 'rome' as const } } };
    expect(summersOnRecord(withRecord.seminary).map((x) => x.label)).toEqual(['A chancery internship', 'A summer in Rome']);
  });

  it('putting your name forward is remembered, counts a little, and asking for everything costs standing', () => {
    const base = parishState('apply');
    const opening: Opening = { id: 'o1', kind: 'pastor', parishId: null, urgency: 60, needsSpanish: false, needsAdmin: false, alignment: 0, week: base.clock.week, label: 'A parish across the diocese' };
    const two: Opening = { ...opening, id: 'o2', label: 'A cluster of three churches' };
    const s: GameState = { ...base, openings: [opening, two], flags: { ...base.flags, ordination_week: base.clock.week - 52 * 6 } };
    const one = applyForOpening(s, 'o1');
    expect(one.openings[0]!.applied).toBe(true);
    expect(one.career[one.career.length - 1]!.text).toMatch(/Put your name in for A parish across the diocese/);
    expect(one.character!.reputation.chancery).toBe(s.character!.reputation.chancery);
    const both = applyForOpening(one, 'o2');
    expect(both.character!.reputation.chancery).toBe(s.character!.reputation.chancery - 2);
    expect(applyForOpening(both, 'o2')).toBe(both);
    // The board's read of the applied man is higher, all else equal.
    const rng = () => createRng('board');
    const scoreOf = (st: GameState) => boardDecision(st, rng()).decisions.find((d) => d.opening.id === 'o1')!.ranked.find((r) => r.candidate.isPlayer)!.score.total;
    expect(scoreOf(one)).toBeCloseTo(scoreOf(s) + 6, 5);
    const ch = chancesFor(s, opening);
    expect(['green', 'ready enough', 'ready']).toContain(ch.readiness);
    expect(ch.verdict.length).toBeGreaterThan(5);
    expect(chancesFor({ ...s, flags: { ...s.flags, ordination_week: s.clock.week } }, opening).verdict).toMatch(/Too soon/);
  });

  it('doors are sorted into open and shut, and the shut ones say what is in the way', () => {
    const s = parishState('doors');
    const doors = offerDoors(s, allOffers);
    expect(doors.ready.length + doors.closed.length).toBeGreaterThan(5);
    for (const { why } of doors.closed) expect(why.length).toBeGreaterThan(2);
    expect(describeUnmet({ type: 'stat', key: 'theology', op: '>=', value: 99 }, s)).toBe('more theology');
    expect(describeUnmet({ type: 'credential', key: 'JCL' }, s)).toBe('a canon law licentiate');
    expect(describeUnmet({ type: 'stat', key: 'theology', op: '>=', value: 0 }, s)).toBeNull();
    const rome = allOffers.find((o) => o.id === 'pv_rome_study')!;
    const low: GameState = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, theology: 10 }, reputation: { ...s.character!.reputation, chancery: -50 } } };
    expect(whyNot(rome, low)).toMatch(/years ordained|theology|chancery|Rome/);
  });
});
