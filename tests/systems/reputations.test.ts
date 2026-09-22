import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder, reputationDefs, identityDefs, spendDefs } from '@/content/religious';
import { REPUTATION_KEYS, type GameState, type OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { gainReputation, identitiesOf, legibilityFromReputations, phraseOf, reputationCap, reputationFit, reputationOf, reputationsFade, REPUTATIONS } from '@/systems/religious/reputations';
import { setSpend, spendBudget, spendOffered, spendsWeek, spendsUsed } from '@/systems/religious/spends';
import { consult, fitOf } from '@/systems/religious/obedience';
import { playerLegibility } from '@/systems/religious/electorate';
import { BISHOP_ASKS, friarLoad } from '@/systems/religious/bishopAsks';

function friar(seed: string, order: OrderKey = 'OP', stats = { administration: 50, charisma: 55, theology: 60, knowledge: 55, piety: 60 }): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = gen.houses.find((h) => h.kind === 'priory')!.id;
  const base = seminaryState(seed);
  const s = installProvince({ ...base, character: testCharacter({ stats, reputation: { ...base.character!.reputation, province: 20, superiors: 10, community: 20 } }) }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 6 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

describe('reputations and the friar\'s week (E3 §3.3, §8)', () => {
  it('the data names eleven reputations with stat gates, seven identities of two, and spends that feed them', () => {
    expect(reputationDefs.map((r) => r.id).sort()).toEqual([...REPUTATION_KEYS].sort());
    for (const r of reputationDefs) expect(r.gates.length).toBeGreaterThan(0);
    expect(identityDefs.length).toBe(7);
    for (const d of identityDefs) for (const k of d.mix) expect(REPUTATION_KEYS).toContain(k);
    for (const key of REPUTATION_KEYS) expect(spendDefs.some((s) => (s.reputations?.[key] ?? 0) > 0), key).toBe(true);
  });

  it('a reputation is built by the hours, held under its stat cap, and fades only when unused', () => {
    const s = friar('rep');
    expect(spendBudget(s)).toBe(Math.round((BISHOP_ASKS.weekBlocks - friarLoad(s)) * 4) / 4);
    let next = setSpend(s, 'confessions', 3);
    expect(next.religious!.spends!.confessions).toBe(3);
    expect(spendsUsed(next)).toBe(3);
    for (let i = 0; i < 200; i++) next = spendsWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`w:${i}`)).state;
    const v = reputationOf(next, 'confessor');
    expect(v).toBeGreaterThan(REPUTATIONS.known);
    expect(v).toBeLessThanOrEqual(reputationCap(next, 'confessor') + 0.01);
    expect(next.flags['rep:confessor:known']).toBe(true);
    expect(next.character!.stats.piety).toBeGreaterThan(s.character!.stats.piety);
    // Low piety cannot become the confessor however long he sits in the box.
    const dull = friar('dull', 'OP', { administration: 50, charisma: 50, theology: 30, knowledge: 50, piety: 20 });
    let d = setSpend(dull, 'confessions', 3);
    for (let i = 0; i < 60; i++) d = spendsWeek({ ...d, clock: { ...d.clock, week: d.clock.week + 1 } }, createRng(`d:${i}`)).state;
    expect(reputationOf(d, 'confessor')).toBeLessThan(REPUTATIONS.known);
    expect(reputationOf(d, 'confessor')).toBeLessThanOrEqual(reputationCap(d, 'confessor') + 0.01);
    // Unused, it fades; used, it does not.
    const faded = reputationsFade(next, new Set());
    expect(reputationOf(faded, 'confessor')).toBeLessThan(v);
    expect(reputationOf(reputationsFade(next, new Set(['confessor'])), 'confessor')).toBe(v);
    // Same seed, same week.
    expect(spendsWeek(next, createRng('same')).state.religious!.reputations).toEqual(spendsWeek(next, createRng('same')).state.religious!.reputations);
  });

  it('two reputations make an identity, the province can say the man in a phrase, and legibility follows', () => {
    const s = friar('id');
    expect(phraseOf(s)).toBeNull();
    let next = gainReputation(s, 'confessor', 60);
    expect(phraseOf(next)).toBe('the one they line up for on Saturdays');
    next = gainReputation(next, 'man_of_prayer', 60);
    expect(identitiesOf(next).map((d) => d.id)).toContain('lined_up_for');
    expect(next.flags['identity:lined_up_for']).toBe(true);
    expect(phraseOf(next)).toBe('the one they line up for');
    expect(legibilityFromReputations(next)).toBeGreaterThan(legibilityFromReputations(s));
    expect(playerLegibility(next)).toBeGreaterThan(playerLegibility(s));
    // A reputation past its stats is a liability the flags say so.
    const over = { ...s, religious: { ...s.religious!, reputations: { preacher: 95 } } };
    const flagged = gainReputation(over, 'preacher', 0);
    expect(flagged.flags['rep:overshoot:preacher']).toBe(true);
  });

  it('two friars with identical stats but different reputations are offered different postings', () => {
    const s = friar('assign');
    const scholar = gainReputation(gainReputation(s, 'professor', 80), 'spiritual_director', 60);
    const pastor = gainReputation(gainReputation(s, 'pastor_of_dying', 80), 'confessor', 60);
    const studium = Object.values(s.orderHouses!).find((h) => h.kind === 'studium')!;
    const parish = Object.values(s.orderHouses!).find((h) => h.kind === 'parish') ?? Object.values(s.orderHouses!).find((h) => h.kind === 'priory' && h.id !== s.religious!.houseId)!;
    expect(reputationFit(scholar, 'teaching')).toBeGreaterThan(reputationFit(pastor, 'teaching'));
    expect(reputationFit(pastor, 'parish')).toBeGreaterThan(reputationFit(scholar, 'parish'));
    expect(fitOf(scholar, studium)).toBeGreaterThan(fitOf(pastor, studium));
    expect(fitOf(pastor, parish)).toBeGreaterThanOrEqual(fitOf(scholar, parish));
    const a = consult(scholar, createRng('c'));
    const b = consult(pastor, createRng('c'));
    const fitA = a.religious!.consultation!.options.map((o) => `${o.houseId}:${o.fit}`);
    const fitB = b.religious!.consultation!.options.map((o) => `${o.houseId}:${o.fit}`);
    expect(fitA).not.toEqual(fitB);
  });

  it('spends are gated: a priest\'s work waits for ordination, teaching needs a house that teaches, and the week cannot be overspent', () => {
    const s = friar('gate');
    const novice = { ...s, flags: { ...s.flags, ordained: false } };
    expect(spendOffered(novice, spendDefs.find((d) => d.id === 'supply')!).ok).toBe(false);
    expect(spendOffered(s, spendDefs.find((d) => d.id === 'supply')!).ok).toBe(true);
    const budget = spendBudget(s);
    let next = s;
    for (const d of spendDefs) next = setSpend(next, d.id, 4);
    expect(spendsUsed(next)).toBeLessThanOrEqual(budget + 1e-6);
    // Sunday supply pays the province.
    const paid = spendsWeek(setSpend(s, 'supply', 2), createRng('p')).state;
    expect(paid.province!.finances.balance).toBeGreaterThan(s.province!.finances.balance);
    // Observance moves his own against the house's.
    const strict = spendsWeek(setSpend(s, 'observance', 3), createRng('o')).state;
    expect(strict.religious!.observance).toBeGreaterThan(s.religious!.observance ?? 50);
  });
});
