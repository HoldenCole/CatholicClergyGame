import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { ALL_CONSTITUENCY_KEYS, CONSTITUENCY_KEYS } from '@/types';
import { applyEffects } from '@/engine/effects';
import { applyChoice, fireEvent } from '@/engine/events';
import { eventById } from '@/content';
import { buildSave, serialize } from '@/engine/save';
import { emptyReputation, fadeReputation } from '@/systems/reputation';
import { constituenciesOf, resolveConstituency } from '@/systems/campaign';
import { writeColumn, columnTopics } from '@/systems/press';
import { recordImplementation } from '@/systems/rome/documents';
import { conferenceDocuments } from '@/content/conference';
import { ensureConference, issueConferenceDocument, playerStanding } from '@/systems/conference';
import { NUNCIO, provinceTernaWeight } from '@/systems/rome/nuncio';
import { nuncioView } from '@/systems/rome/nuncioView';
import { yearInReview } from '@/systems/review';
import { lendableSees, LOAN, moveToDiocese } from '@/systems/loan';
import { offerById } from '@/content/offers';
import { parishState } from './week.test';
import type { GameState } from '@/types';

function pastor(seed: string): GameState {
  const s = parishState(seed);
  return { ...s, phase: 'pastor', assignment: { ...s.assignment!, role: 'pastor' }, clock: { ...s.clock, week: 52 * 6 }, flags: { ...s.flags, ordination_week: 0, speaks_spanish: true } };
}

describe('E2 R1.4: the bishops beyond the diocese', () => {
  it('is a constituency the base game does not carry until something writes it, and a friar has it under the order\'s name', () => {
    expect(ALL_CONSTITUENCY_KEYS).toContain('bishops');
    expect(CONSTITUENCY_KEYS).not.toContain('bishops');
    expect('bishops' in emptyReputation()).toBe(false);
    const s = pastor('empty');
    expect(s.character!.reputation.bishops).toBeUndefined();
    // A fresh save has no such key: the diocesan game reads as it was (rule 11).
    expect(serialize(buildSave(s, createRng(s.seed), null, {}))).not.toMatch(/"bishops"/);
    expect(resolveConstituency(s, 'bishops')).toBe('bishops');
    // The diocesan campaign owns it, after the base seven, with its own label.
    expect(constituenciesOf(s).map((c) => c.key).at(-1)).toBe('bishops');
    expect(resolveConstituency({ campaign: 'religious' }, 'bishops')).toBe('order');
    const moved = applyEffects(s, [{ target: 'reputation', key: 'bishops', delta: 7 }], {}, 'a test');
    expect(moved.character!.reputation.bishops).toBe(7);
    expect(moved.character!.reputation.rome).toBe(s.character!.reputation.rome);
    // It fades as the others do, and stays where it is under the floor.
    expect(fadeReputation(moved.character!).reputation.bishops).toBe(7);
    expect(fadeReputation({ ...moved.character!, reputation: { ...moved.character!.reputation, bishops: 80 } }).reputation.bishops).toBeLessThan(80);
  });

  it('is fed by a stand on the record, the column, a conference document kept eagerly or defied, and a loan', () => {
    const s0 = pastor('feeds');
    // A public position: the event engine writes a point.
    const e = eventById('mp_statement_immigration')!;
    const s = { ...s0, world: { ...s0.world!, metropolia: { ...s0.world!.metropolia!, policies: [{ id: 'common_statement_immigration', week: s0.clock.week }] } } };
    const fired = fireEvent(s, e, createRng('fire'));
    const open = { ...fired.state, pending: [fired.pending] };
    const publicChoice = e.choices.find((c) => c.volume === 'public') ?? e.choices.find((c) => c.volume === 'semi_public')!;
    const after = applyChoice(open, e, fired.pending, publicChoice.id, eventById).state;
    if (publicChoice.volume === 'public') expect(after.character!.reputation.bishops ?? 0).toBeGreaterThanOrEqual(1);
    // The column.
    const topic = columnTopics[0]!;
    const col = writeColumn({ ...s0, parish: s0.parish!, flags: { ...s0.flags, 'column:last': -100 } }, topic.id, topic.stances[0]!.id);
    expect((col.character!.reputation.bishops ?? 0) - (s0.character!.reputation.bishops ?? 0)).toBe(2);
    expect(col.movers!.some((m) => m.key === 'bishops')).toBe(true);
    // A conference document, kept eagerly or defied; Rome's own moves nothing here.
    const c0 = ensureConference({ ...s0, conference: undefined as never });
    const withDoc = issueConferenceDocument({ ...c0, conference: { ...c0.conference!, assemblies: [{ week: c0.clock.week }] } }, conferenceDocuments[0]!, createRng('doc')).state;
    const axis = `conference:${conferenceDocuments[0]!.topic}`;
    expect(recordImplementation(withDoc, axis, 'eager').character!.reputation.bishops).toBe(3);
    expect(recordImplementation(withDoc, axis, 'defiant').character!.reputation.bishops).toBe(-3);
    expect(recordImplementation(withDoc, axis, 'faithful').character!.reputation.bishops).toBeUndefined();
    // Being asked for on loan.
    const lent = moveToDiocese(s0, lendableSees(s0)[0]!.id, 'spanish', 3, createRng('lend')).state;
    expect(lent.character!.reputation.bishops).toBe(LOAN.bishopsBeyond.lent);
    // The convocation scene gives it.
    expect(eventById('mp_convocation')!.choices.find((c) => c.id === 'give')!.effects.some((f) => f.target === 'reputation' && f.key === 'bishops')).toBe(true);
  });

  it('is read by the nuncio, the terna\'s weight for the province, the conference\'s electors, the loans, and the year in review', () => {
    const s = pastor('reads');
    const known = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, bishops: 60 } } };
    const unknown = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, bishops: -40 } } };
    expect(nuncioView(known).value).toBeGreaterThan(nuncioView(s).value);
    expect(nuncioView(known).good).toContain('the bishops of the region know your name');
    expect(nuncioView(unknown).bad[0]).toMatch(/not for the right reasons/);
    expect(provinceTernaWeight(s)).toBe(NUNCIO.provinceWeight);
    expect(provinceTernaWeight(known)).toBeCloseTo(NUNCIO.provinceWeight * (1 + 60 / NUNCIO.bishopsBeyondPer), 5);
    expect(provinceTernaWeight(unknown)).toBe(NUNCIO.provinceWeight);
    expect(playerStanding(ensureConference(known))).toBeGreaterThan(playerStanding(ensureConference(s)));
    const bias = offerById('ln_loan_spanish')!.bias!;
    expect(bias[0]!.when).toEqual({ type: 'reputation', key: 'bishops', op: '>=', value: 20 });
    // The review has the row only once the name exists.
    const baseline: NonNullable<GameState['reviewBaseline']> = { reputation: { ...s.character!.reputation } as Record<string, number>, stats: { ...s.character!.stats }, week: s.clock.week - 52, strain: 0 };
    const plain = yearInReview({ ...s, reviewBaseline: baseline }).letter.body.join(' ');
    const beyond = yearInReview({ ...known, reviewBaseline: baseline }).letter.body.join(' ');
    expect(plain).not.toMatch(/The bishops beyond/);
    expect(beyond).toMatch(/The bishops beyond/);
  });
});
