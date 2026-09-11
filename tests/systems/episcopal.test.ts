import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { acceptOffer } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { evaluateCondition } from '@/engine/conditions';
import { generateSee, seeYear, applySeeHours } from '@/engine/see';
import { seeDefs } from '@/content/sees';
import { studyActivitiesFor, setStudyActivity, studyWeek } from '@/systems/studyWeek';
import { studyWeekHook, type EventDeps } from '@/engine/weekHook';
import { careerYear } from '@/engine/career';
import { allTenures } from '@/systems/tenures';
import type { GameState } from '@/types';

function candidate(seed: string, extra: Partial<GameState> = {}): GameState {
  const base = parishState(seed);
  const c = base.character!;
  const bishopId = base.world!.diocese.hidden.bishop.npcId;
  return {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, reputation: { ...c.reputation, chancery: 72, rome: 40 } },
    npcs: { ...base.npcs, [bishopId]: { ...base.npcs[bishopId]!, relationship: 30 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true },
    ...extra,
  };
}

describe('the episcopal tier', () => {
  it('the age condition reads the calendar against the man', () => {
    const s = candidate('age');
    // Entered at 22 in 1990; the fixture clock starts in 2017, so he is about 49.
    expect(evaluateCondition({ type: 'age', op: '>=', value: 45 }, s)).toBe(true);
    expect(evaluateCondition({ type: 'age', op: '<=', value: 40 }, s)).toBe(false);
  });

  it('the questionnaire scene exists and sets terna_named; both offers require it', () => {
    const e = eventById('ep_questionnaire_about_you')!;
    expect(e).toBeDefined();
    expect(e.choices.every((c) => c.effects.some((x) => x.target === 'flag' && x.key === 'terna_named'))).toBe(true);
    for (const id of ['ep_auxiliary_bishop', 'ep_diocesan_bishop']) {
      const def = offerById(id)!;
      expect(JSON.stringify(def.requires)).toContain('terna_named');
    }
  });

  it('the auxiliary is a six-year posting with its own week', () => {
    const s = candidate('aux', { offers: [{ offerId: 'ep_auxiliary_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }] });
    const away = acceptOffer(s, offerById('ep_auxiliary_bishop')!, createRng('aux')).state;
    expect(away.phase).toBe('study');
    expect(away.study!.city).toBe('auxiliary');
    expect(away.flags.ordained_bishop).toBe(true);
    expect(away.see ?? null).toBeNull();
    const ids = studyActivitiesFor(away).map((a) => a.def.id);
    expect(ids).toContain('confirmation_circuit');
    expect(ids).toContain('the_vicariate');
    expect(ids).not.toContain('see_money');
  });

  it('a see is generated from the pool, never twice the same dials, and the bishop\'s week moves them', () => {
    const s = candidate('see-gen');
    const a = generateSee(s, createRng('a'));
    const b = generateSee(s, createRng('b'));
    expect(seeDefs.map((d) => d.id)).toContain(a.id);
    expect(JSON.stringify([a.presbyterate, a.people, a.money, a.shortage])).not.toBe(JSON.stringify([b.presbyterate, b.people, b.money, b.shortage]));
    expect(a.shortage).toBeGreaterThanOrEqual(1);
    expect(a.shortage).toBeLessThanOrEqual(5);
    const moved = applySeeHours(a, { money: 0.6, people: -0.3 }, 2);
    expect(moved.money).toBe(Math.min(100, a.money + 1.2));
    expect(moved.people).toBe(a.people - 0.6);
  });

  it('naming to a see is the last act: phase bishop, a see of his own, years that ordain and close, and the letter at seventy-five', () => {
    const s = candidate('see', { offers: [{ offerId: 'ep_diocesan_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }] });
    let b = acceptOffer(s, offerById('ep_diocesan_bishop')!, createRng('see')).state;
    expect(b.phase).toBe('bishop');
    expect(b.see).toBeTruthy();
    expect(b.study!.city).toBe('see');
    expect(b.flags['study:see']).toBe(true);
    expect(b.career[b.career.length - 1]!.text).toMatch(/Named Bishop of/);
    expect(allTenures(b)[allTenures(b).length - 1]!.label).toMatch(/^Bishop of/);
    // The years run to seventy-five: he is about 49, so about 26 years.
    expect(b.study!.endWeek - b.clock.week).toBeGreaterThan(52 * 20);
    expect(b.beats.find((x) => x.kind === 'assignment')!.label).toMatch(/seventy-five/);
    // The bishop's week.
    const ids = studyActivitiesFor(b).map((a) => a.def.id);
    for (const id of ['cathedral_and_confirmations', 'see_personnel', 'see_closings', 'see_money', 'see_seminary', 'see_rome']) expect(ids).toContain(id);
    b = setStudyActivity(b, 'see_money', 2);
    b = setStudyActivity(b, 'see_personnel', 2);
    const before = b.see!;
    const w = studyWeek({ ...b, clock: { ...b.clock, week: b.clock.week + 1 } }, createRng('w')).state;
    expect(w.see!.money).toBeGreaterThan(before.money);
    expect(w.see!.presbyterate).toBeGreaterThan(before.presbyterate);
    // A year in the chair: a letter, a line, ordinations counted; no succession at home.
    const year = careerYear({ ...w, clock: { ...w.clock, week: w.clock.week + 52 } }, createRng('cy'));
    expect(year.letterQueue!.some((l) => /year 1/.test(l.title))).toBe(true);
    expect(year.see!.years).toHaveLength(1);
    expect(year.see!.years[0]).toMatch(/^Year 1:/);
    expect(year.world!.diocese.hidden.bishop.npcId).toBe(s.world!.diocese.hidden.bishop.npcId);
    // The letter at seventy-five retires him rather than sending him home to a parish.
    const deps: EventDeps = { pool: [], lookup: () => undefined, offerLookup: (id) => offerById(id) };
    const end = studyWeekHook(deps)({ ...year, mode: { kind: 'clock' }, letterQueue: [], clock: { ...year.clock, week: year.study!.endWeek } }, createRng('end'), []);
    expect(end.mode.kind).toBe('ended');
    if (end.mode.kind === 'ended') {
      expect(end.mode.ending).toBe('retired');
      expect(end.mode.summary).toMatch(/Bishop of/);
    }
  });

  it('the year in the chair forces a closing when the bench is empty and nobody has begun', () => {
    const s = candidate('force');
    const see = { ...generateSee(s, createRng('f')), shortage: 5 };
    const r = seeYear({ ...s, see, flags: { ...s.flags, bp_began_closings: false } }, createRng('fy'));
    expect(r.state.see!.closings).toBe(1);
    expect(r.letter.body.join(' ')).toMatch(/closed this year/);
    const begun = seeYear({ ...s, see, flags: { ...s.flags, bp_began_closings: true } }, createRng('fy'));
    expect(begun.state.see!.closings).toBe(0);
  });
});
