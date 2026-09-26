import { describe, it, expect } from 'vitest';
import { eventById, allEvents } from '@/content';
import { applyChoice, fireEvent, isEligible } from '@/engine/events';
import { createRng } from '@/engine/rng';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { documentsWeek, documentsOfHisLife, issueDocument, type Draft } from '@/systems/rome/documents';
import { costOf, reversalOf } from '@/systems/rome/reversal';
import { policyOf } from '@/systems/rome/policy';
import { parishState } from './week.test';
import type { GameState, IssuedDocument } from '@/types';

function until(state: GameState, test: (s: GameState) => boolean, max = 600): GameState {
  let s = state;
  for (let i = 0; i < max && !test(s); i++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    s = documentsWeek(s).state;
  }
  return s;
}

/** Play a cascade scene with one of its choices, the way the week hook and the store would. */
function answer(s: GameState, eventId: string, choiceId: string): GameState {
  const ev = eventById(eventId)!;
  const fired = fireEvent(s, ev, createRng(`fire:${eventId}`));
  const withPending = { ...fired.state, pending: [...fired.state.pending, fired.pending] };
  return applyChoice(withPending, ev, fired.pending, choiceId, eventById).state;
}

/** A generated document on the older Mass, issued by hand. */
function draft(id: string, from: string, value: string, day: number): Draft {
  return { id, kind: 'motu_proprio', title: id === 'gen:1' ? 'Lucerna Fidelium' : 'Radix Pacis', gist: 'on the older Mass', day, popeId: 'gen:1', axis: 'older_mass', value, from };
}

describe('reversal detection', () => {
  const base = { id: 'x', kind: 'motu_proprio' as const, title: 'X', gist: '', day: 0, week: 0, popeId: 'p', axis: 'older_mass', from: 'free', value: 'faculties' };
  it('finds the latest document on the axis he answered, if the new one turns it back', () => {
    const answered: IssuedDocument = { ...base, implemented: 'faithful', implementedWeek: 40 };
    expect(reversalOf([answered], { axis: 'older_mass', from: 'faculties', value: 'free' })).toMatchObject({ index: 0, implemented: 'faithful', title: 'X', week: 40 });
    // The same way again is not a reversal; nor is turning back a document he never answered.
    expect(reversalOf([answered], { axis: 'older_mass', from: 'faculties', value: 'closed' })).toBeUndefined();
    expect(reversalOf([{ ...base }], { axis: 'older_mass', from: 'faculties', value: 'free' })).toBeUndefined();
    // Another axis is another question.
    expect(reversalOf([answered], { axis: 'missal', from: 'literal', value: 'dynamic' })).toBeUndefined();
  });

  it('says what an answer cost and won, from its authored effects', () => {
    const choice = eventById('rc_om_fac_parish_mass')!.choices.find((c) => c.id === 'end_now')!;
    expect(costOf(choice)).toBe('It cost you the traditional families and some of the parish, and won you Rome, the chancery and the bishop.');
    expect(costOf(undefined)).toMatch(/nobody wrote down/);
  });
});

describe('the record read back', () => {
  it('a man who answered Traditionis Custodes meets its undoing, and again a second time', () => {
    let s = parishState('reversal');
    s = { ...s, assignment: { ...s.assignment!, role: 'pastor' }, phase: 'pastor' };
    s = until(s, (x) => policyOf(x, 'older_mass') === 'faculties');
    // He answers it in his parish: the families are told, and he defends it.
    s = answer(s, 'rc_om_fac_families', 'defend');
    const tc = s.rome!.issued!.find((d) => d.title === 'Traditionis Custodes')!;
    expect(tc.implemented).toBe('eager');

    // Years on, a generated pope frees it again.
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 300 } };
    const first = issueDocument(s, draft('gen:1', 'faculties', 'free', tc.day + 2200));
    s = first.state;
    const undo = s.rome!.issued!.at(-1)!;
    expect(undo.reverses).toMatchObject({ title: 'Traditionis Custodes', implemented: 'eager' });
    const letter = first.letter!.body.join(' ');
    expect(letter).toContain('It undoes Traditionis Custodes');
    expect(letter).toContain('"Explain it, and defend it: unity is the point, and the Pope has the right."');
    expect(letter).toContain('It cost you the traditional families, and won you Rome and the reforming wing.');
    // The scene that reads it back is the one that must be said, ahead of any ordinary one.
    const due = allEvents.filter((e) => e.beat === 'cascade' && isEligible(e, s));
    const top = Math.max(...due.map((e) => e.priority ?? 0));
    expect(due.filter((e) => e.priority === top).map((e) => e.id)).toEqual(['rv_om_mass_returns']);
    const body = renderText(eventById('rv_om_mass_returns')!.body, s);
    expect(body).toContain('In 2021, at ');
    expect(body).toContain('"Explain it, and defend it: unity is the point, and the Pope has the right."');
    expect(body).not.toMatch(/\{then_/);
    s = answer(s, 'rv_om_mass_returns', 'law_then_law_now');
    expect(evaluateAll([{ type: 'document', axis: 'older_mass', reverses: true, implemented: false }], s)).toBe(false);

    // And a later pope restricts it once more: the record read back is the newer answer.
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 400 } };
    const second = issueDocument(s, draft('gen:2', 'free', 'faculties', tc.day + 5200));
    s = second.state;
    expect(s.rome!.issued!.at(-1)!.reverses).toMatchObject({ title: 'Lucerna Fidelium', implemented: 'faithful' });
    expect(second.letter!.body.join(' ')).toContain('"Say from the pulpit that you obeyed then and obey now, and mean both."');
    expect(allEvents.filter((e) => e.beat === 'cascade' && (e.priority ?? 0) > 0 && isEligible(e, s)).map((e) => e.id)).toContain('rv_om_taken_again');

    // The Profile keeps all of it.
    const lines = documentsOfHisLife(s);
    expect(lines.find((d) => d.title === 'Traditionis Custodes')!.line).toMatch(/you went ahead of the diocese; undone by Lucerna Fidelium/);
    expect(lines.find((d) => d.title === 'Lucerna Fidelium')!.line).toMatch(/you put it into effect as given; undone by Radix Pacis/);
  });

  it('a man who never answered the earlier document is not read back to', () => {
    let s = until(parishState('unanswered'), (x) => policyOf(x, 'older_mass') === 'faculties');
    const tc = s.rome!.issued!.find((d) => d.title === 'Traditionis Custodes')!;
    s = issueDocument(s, draft('gen:1', 'faculties', 'free', tc.day + 2000)).state;
    expect(s.rome!.issued!.at(-1)!.reverses).toBeUndefined();
    expect(allEvents.filter((e) => (e.priority ?? 0) > 0 && e.beat === 'cascade' && isEligible(e, s))).toEqual([]);
  });
});
