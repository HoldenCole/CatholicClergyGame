import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { directedTransfer } from '@/engine/career';
import { acceptOffer, offersWeek } from '@/engine/offers';
import { offerById, offersForPhase } from '@/content/offers';
import { officeDefs } from '@/content/parish';
import { buildChoice, chooseAssignment, withChoice } from '@/systems/choice';
import { dropOffices, holdsOrHeld, officeFlagOf } from '@/systems/offices';
import { studyWeekHook } from '@/engine/weekHook';
import { eventById, eventsForPhase } from '@/content';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

function withOffice(seed: string, id = 'vocations'): GameState {
  const s = parishState(seed);
  const o = officeDefs.find((x) => x.id === id)!;
  return { ...s, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 6, [o.flag]: true }, commitments: [{ offerId: `office:${o.id}`, label: o.label, startWeek: s.clock.week, endWeek: s.clock.week + o.weeks, apPerWeek: o.apPerWeek, failed: false }] };
}

describe('diocesan offices are one man\'s for a term, and go with the desk, not the man', () => {
  it('a move to another parish drops the office; renewal where he is keeps it', () => {
    const s = withOffice('drop');
    expect(holdsOrHeld(s, 'vocations')).toBe(true);
    const moved = directedTransfer(s, createRng('t'), 'difficult', 'parochial_vicar').state;
    expect(moved.commitments.some((c) => c.offerId === 'office:vocations')).toBe(false);
    expect(moved.flags['office:vocations']).toBeUndefined();
    expect(moved.flags['held:office:vocations']).toBe(true);
    expect(moved.career.some((c) => /vocations office went to another man/.test(c.text))).toBe(true);
    // Still remembered as held: the board's office alongside a won post is a different one.
    expect(holdsOrHeld(moved, 'vocations')).toBe(true);
    const here = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const fallback = { parishId: here.id, role: 'pastor' as const, startWeek: s.clock.week, letter: 'x', reasons: ['x'] };
    const board = buildChoice({ ...moved, parish: s.parish, assignment: { ...s.assignment!, role: 'pastor' }, character: { ...moved.character!, reputation: { ...moved.character!.reputation, chancery: 80 } } }, createRng('c'), 'board', fallback)!;
    expect(board.options.find((o) => o.id === 'won_office')!.office).not.toBe('vocations');
  });

  it('choosing the office twice does not stack it, and a term that runs out releases the flag', () => {
    const s = withOffice('twice');
    const here = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    const fallback = { parishId: here.id, role: 'pastor' as const, startWeek: s.clock.week, letter: 'x', reasons: ['x'] };
    const staged: GameState = { ...s, assignment: { ...s.assignment!, role: 'pastor' }, character: { ...s.character!, reputation: { ...s.character!.reputation, chancery: 80 } } };
    const choice = buildChoice(staged, createRng('c'), 'board', fallback)!;
    const office = choice.options.find((o) => o.id === 'won_office')!;
    expect(office.office).not.toBe('vocations');
    // Force the held office onto an option: chooseAssignment refuses to stack it.
    const forced: GameState = { ...staged, mode: { kind: 'assignment_choice', options: [{ ...office, office: 'vocations' }, ...choice.options.filter((o) => o.id !== 'won_office')], why: 'x' } };
    const chosen = chooseAssignment(forced, 'won_office', createRng('x'));
    expect(chosen.commitments.filter((c) => c.offerId === 'office:vocations').length).toBe(1);
    // The term ends: flag off, held on, and the payout.
    const ending: GameState = { ...s, commitments: s.commitments.map((c) => ({ ...c, endWeek: s.clock.week })) };
    const after = offersWeek(ending, createRng('w'), [], offerById);
    expect(after.commitments).toEqual([]);
    expect(after.flags['office:vocations']).toBeUndefined();
    expect(after.flags['held:office:vocations']).toBe(true);
    expect(after.career.some((c) => /the years ended/.test(c.text))).toBe(true);
  });

  it('the chancery\'s own letter for the vocations office is an office too: dropped when moved, and never offered twice', () => {
    const def = offerById('pv_vocations_office')!;
    expect(officeFlagOf(def.id)).toBe('office:vocations');
    const base = parishState('letter');
    const s: GameState = { ...base, flags: { ...base.flags, ordination_week: base.clock.week - 52 * 4 }, character: { ...base.character!, stats: { ...base.character!.stats, charisma: 70 } }, offers: [{ offerId: def.id, arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 4, bindings: {} }] };
    const taken = acceptOffer(s, def, createRng('a')).state;
    expect(taken.flags['office:vocations']).toBe(true);
    expect(taken.commitments.some((c) => c.offerId === def.id)).toBe(true);
    const moved = dropOffices(taken);
    expect(moved.commitments.some((c) => c.offerId === def.id)).toBe(false);
    expect(moved.flags['held:office:vocations']).toBe(true);
    // Going away for a degree drops it too.
    const rome: GameState = { ...taken, character: { ...taken.character!, stats: { ...taken.character!.stats, theology: 75, knowledge: 60 }, reputation: { ...taken.character!.reputation, chancery: 40 } }, flags: { ...taken.flags, rome_track: true }, offers: [{ offerId: 'pv_rome_study', arrivedWeek: taken.clock.week, expiresWeek: taken.clock.week + 6, bindings: {} }] };
    const away = acceptAndGo(rome, offerById('pv_rome_study')!, createRng('go')).state;
    expect(away.commitments).toEqual([]);
    expect(away.flags['office:vocations']).toBeUndefined();
    // Home from Rome: the choice is the top of the diocese, and the letter behind it is the flagship.
    const hook = studyWeekHook({ pool: eventsForPhase('study'), lookup: eventById, offers: offersForPhase('study'), offerLookup: offerById });
    const home = hook({ ...away, clock: { ...away.clock, week: away.study!.endWeek } }, createRng('end'), []);
    expect(home.mode.kind).toBe('assignment_choice');
    if (home.mode.kind !== 'assignment_choice') return;
    expect(home.mode.options[0]!.id).toBe('flagship');
    const kinds = home.mode.options.filter((o) => !o.posting).map((o) => home.world!.parishes.find((p) => p.id === o.assignment.parishId)!.kind);
    for (const k of kinds) expect(['rural', 'difficult']).not.toContain(k);
    expect(home.world!.parishes.find((p) => p.id === home.assignment!.parishId)!.kind).not.toBe('rural');
    expect(withChoice(home, createRng('x'), 'degree', home.assignment!).mode.kind).toBe('assignment_choice');
  });
});
