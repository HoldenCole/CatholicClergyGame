import { describe, expect, it } from 'vitest';
import { allEvents, eventById } from '@/content';
import { createRng } from '@/engine/rng';
import { evaluateCondition } from '@/engine/conditions';
import { applyChoice, isEligible } from '@/engine/events';
import { renderText } from '@/engine/text';
import { careerSummary, playerAge } from '@/engine/career';
import { cloisterHouse, cloisterTokens, housesOf } from '@/systems/houses';
import { parishState } from './week.test';
import type { GameState, ReligiousHouse } from '@/types';

/** A pastor of ten years with an abbey of the diocese that knows him, his retreat made there. */
function withAbbey(seed: string, regard = 60): { state: GameState; abbey: ReligiousHouse } {
  const base = parishState(seed);
  const abbey: ReligiousHouse = { id: 'h_abbey', name: "St. Bede's Abbey", order: 'benedictine', orderLabel: 'the Benedictines', members: 'monks', charism: 'contemplative', alignment: -10, setting: 'country', size: 24, line: 'An abbey.' };
  const c = base.character!;
  const state: GameState = {
    ...base,
    phase: 'pastor',
    parish: { ...base.parish!, role: 'pastor' },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 10 },
    character: { ...c, stats: { ...c.stats, piety: 70 } },
    world: { ...base.world!, diocese: { ...base.world!.diocese, visible: { ...base.world!.diocese.visible, houses: [abbey, ...(base.world!.diocese.visible.houses ?? []).filter((h) => h.charism !== 'contemplative')] } } },
    houses: { h_abbey: { houseId: 'h_abbey', regard, sinceWeek: 0, asked: 1, given: 2, arrangements: [], lastUsed: { retreat: base.clock.week - 30 } } },
  };
  return { state, abbey };
}

describe('the cloister from the diocesan side (DESIGN §9A round 3)', () => {
  it('the house he would enter, and the condition on his standing with it', () => {
    const { state, abbey } = withAbbey('cloister');
    expect(cloisterHouse(state)?.id).toBe(abbey.id);
    expect(cloisterTokens(state)).toMatchObject({ cloister_house: "St. Bede's Abbey", cloister_superior: 'abbot', cloister_members: 'monks' });
    expect(evaluateCondition({ type: 'house_regard', charism: 'contemplative', men: true, retreat: true, op: '>=', value: 50 }, state)).toBe(true);
    expect(evaluateCondition({ type: 'house_regard', charism: 'contemplative', op: '>=', value: 70 }, state)).toBe(false);
    // No retreat made there: not yet. A house of nuns is not his to enter. No house at all: never.
    const noRetreat: GameState = { ...state, houses: { h_abbey: { ...state.houses!.h_abbey!, lastUsed: {} } } };
    expect(evaluateCondition({ type: 'house_regard', charism: 'contemplative', retreat: true, op: '>=', value: 50 }, noRetreat)).toBe(false);
    const nuns: GameState = { ...state, world: { ...state.world!, diocese: { ...state.world!.diocese, visible: { ...state.world!.diocese.visible, houses: [{ ...abbey, members: 'nuns' }] } } } };
    expect(cloisterHouse(nuns)).toBeUndefined();
    expect(evaluateCondition({ type: 'house_regard', charism: 'contemplative', men: true, op: '>=', value: 10 }, nuns)).toBe(false);
    expect(evaluateCondition({ type: 'house_regard', op: '>=', value: 0 }, { ...state, world: { ...state.world!, diocese: { ...state.world!.diocese, visible: { ...state.world!.diocese.visible, houses: [] } } } })).toBe(false);
    expect(housesOf(state).some((h) => h.id === abbey.id)).toBe(true);
  });

  it('the question comes only to a man the house knows, who is a priest of years and not a bishop; the chain reads its flags', () => {
    const { state } = withAbbey('cloister:gate');
    const question = eventById('cl_the_question')!;
    expect(isEligible(question, state)).toBe(true);
    expect(playerAge(state)).toBeLessThanOrEqual(60);
    expect(isEligible(question, parishState('cloister:plain'))).toBe(false);
    expect(isEligible(question, { ...state, flags: { ...state.flags, ordained_bishop: true } })).toBe(false);
    expect(isEligible(question, { ...state, character: { ...state.character!, stats: { ...state.character!.stats, piety: 30 } } })).toBe(false);
    expect(isEligible(question, withAbbey('cloister:cold', 20).state)).toBe(false);
    // The director's scene is the internal forum, and writes nothing a formator could read.
    const director = eventById('cl_the_director')!;
    expect(director.internalForum).toBe(true);
    for (const c of director.choices) for (const e of c.effects) expect(['stat', 'flag', 'thread']).toContain(e.target);
    expect(isEligible(director, state)).toBe(false);
    expect(isEligible(director, { ...state, flags: { ...state.flags, 'cloister:thought': true } })).toBe(true);
    // The bishop's leave is rolled, and may be asked again; the door needs the leave.
    const leave = eventById('cl_the_bishops_leave')!;
    expect(leave.once).toBeUndefined();
    expect(leave.suppressYears).toBeGreaterThanOrEqual(3);
    const ask = leave.choices.find((c) => c.id === 'ask')!;
    expect(ask.roll?.stat).toBe('piety');
    expect(ask.roll!.success.effects.some((e) => e.target === 'flag' && e.key === 'cloister:leave')).toBe(true);
    expect(ask.roll!.failure.effects.some((e) => e.target === 'flag' && e.key === 'cloister:refused')).toBe(true);
    const door = eventById('cl_the_door')!;
    expect(door.severity).toBe('CRITICAL');
    expect(isEligible(door, { ...state, flags: { ...state.flags, 'cloister:thought': true } })).toBe(false);
    expect(isEligible(door, { ...state, flags: { ...state.flags, 'cloister:leave': true } })).toBe(true);
    // Every scene of the chain renders clean, with the house named.
    for (const e of allEvents.filter((x) => x.id.startsWith('cl_'))) {
      const text = renderText([e.title, e.body, ...e.choices.flatMap((c) => [c.label, c.outcome ?? '', c.roll?.success.outcome ?? '', c.roll?.failure.outcome ?? ''])].join(' '), state, {});
      expect(text, e.id).not.toMatch(/\{[a-z_]+\}/);
      if (e.id !== 'cl_the_bishops_leave') expect(text, e.id).not.toMatch(/\{@/);
    }
    expect(renderText(question.body, state, {})).toContain("St. Bede's Abbey");
  });

  it('going in ends the run with respect: the ending, the summary with the house by name, and the way back kept open', () => {
    const { state } = withAbbey('cloister:door');
    const ready: GameState = { ...state, flags: { ...state.flags, 'cloister:leave': true } };
    const door = eventById('cl_the_door')!;
    const pending = { eventId: door.id, week: ready.clock.week, bindings: {}, severity: door.severity } as GameState['pending'][number];
    const gone = applyChoice(ready, door, pending, 'go_in', eventById).state;
    expect(gone.mode).toMatchObject({ kind: 'ended', ending: 'entered_cloister' });
    expect((gone.mode as { summary: string }).summary).toMatch(/novice of the cloister/);
    expect(gone.flags['cloister:house']).toBe("St. Bede's Abbey");
    expect(careerSummary(gone, 'entered_cloister')).toMatch(/You entered St\. Bede's Abbey at \d+, 10 years a priest of the diocese, with your bishop's leave, a novice again\./);
    expect(gone.tenures?.[gone.tenures.length - 1]?.left).toBe('entered the cloister');
    // Turning the car round keeps him a priest of the diocese, and the question does not come again.
    const back = applyChoice(ready, door, pending, 'turn_back', eventById).state;
    expect(back.mode.kind).not.toBe('ended');
    expect(back.flags['cloister:closed']).toBe(true);
    expect(isEligible(eventById('cl_the_question')!, { ...back, flags: { ...back.flags, 'cloister:leave': false } })).toBe(false);
    // Deterministic.
    expect(JSON.stringify(applyChoice(ready, door, pending, 'go_in', eventById).state)).toBe(JSON.stringify(gone));
    void createRng;
  });
});
