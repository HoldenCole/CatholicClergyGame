import { describe, it, expect } from 'vitest';
import { parishState } from '../systems/week.test';
import { createRng } from '@/engine/rng';
import { acceptOffer } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { eventById, eventsForPhase } from '@/content';
import { parishWeekHook, resolvePending, type EventDeps } from '@/engine/weekHook';
import { APPOINTMENT, APPOINTMENT_BEAT, appointmentStep, pendingAppointment, releaseChance } from '@/engine/appointment';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { renderText } from '@/engine/text';
import type { GameState } from '@/types';

function withOffer(seed: string, offerId: string, extra: Partial<GameState['flags']> = {}, relationship = 0, need: 'stretched' | 'critically_short' = 'stretched'): GameState {
  const base = parishState(seed);
  const c = base.character!;
  const bishopId = base.world!.diocese.hidden.bishop.npcId;
  return {
    ...base,
    character: { ...c, stats: { ...c.stats, theology: 75, knowledge: 65, piety: 60 }, reputation: { ...c.reputation, chancery: 40 } },
    npcs: { ...base.npcs, [bishopId]: { ...base.npcs[bishopId]!, relationship } },
    world: { ...base.world!, diocese: { ...base.world!.diocese, visible: { ...base.world!.diocese.visible, clergyNeed: need } } },
    offers: [{ offerId, arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }],
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3, rome_track: true, 'summer:hospital': true, ...extra },
  };
}

const deps: EventDeps = { pool: eventsForPhase('parochial_vicar'), lookup: eventById, offerLookup: offerById };

describe("a post that moves you is the bishop's letter", () => {
  it('saying yes does not move him: the request is pending, with a beat for the letter', () => {
    const s = withOffer('yes', 'pv_rome_study');
    const r = acceptOffer(s, offerById('pv_rome_study')!, createRng('accept'));
    const next = r.state;
    expect(next.phase).toBe('parochial_vicar');
    expect(next.parish).not.toBeNull();
    expect(next.study).toBeNull();
    const p = pendingAppointment(next)!;
    expect(p.offerId).toBe('pv_rome_study');
    expect(p.week - next.clock.week).toBeGreaterThanOrEqual(APPOINTMENT.waitWeeks[0]);
    expect(p.week - next.clock.week).toBeLessThanOrEqual(APPOINTMENT.waitWeeks[1]);
    expect(next.beats.some((b) => b.kind === 'assignment' && b.label === APPOINTMENT_BEAT && b.week === p.week)).toBe(true);
    expect(next.career[next.career.length - 1]!.text).toMatch(/Said yes/);
    expect(renderText('{appointment} at {appointment_residence}, from {appointment_from}', next)).toMatch(/licentiate in theology at the North American College, from /);
    // Before the week, nothing happens.
    expect(appointmentStep(next, createRng('early'), offerById).letter).toBeNull();
  });

  it("the bishop's own ask is certain, and the letter moves him with the letter over the scene", () => {
    const s = withOffer('go', 'pv_rome_study');
    expect(releaseChance(s, offerById('pv_rome_study')!)).toBe(1);
    let next = acceptOffer(s, offerById('pv_rome_study')!, createRng('accept')).state;
    const p = pendingAppointment(next)!;
    next = { ...next, clock: { ...next.clock, week: p.week } };
    next = parishWeekHook(deps)(next, createRng('week'), []);
    expect(next.phase).toBe('study');
    expect(next.study).toMatchObject({ program: 'rome_stl', city: 'rome' });
    expect(pendingAppointment(next)).toBeNull();
    expect(next.beats.some((b) => b.label === APPOINTMENT_BEAT)).toBe(false);
    expect(next.pending.map((e) => e.eventId)).toContain('ap_letter_go');
    expect(next.flags['appointment:letter:go']).toBeUndefined();
    const read = resolvePending(next, next.pending.find((e) => e.eventId === 'ap_letter_go')!, 'so_be_it', createRng('read'), deps);
    expect(read.flags.appointed_by_letter).toBe(true);
  });

  it("someone else's ask can be refused: a short diocese and a cool bishop keep him, and it is written down", () => {
    const def = offerById('pv_hospital_chaplain')!;
    const warm = withOffer('warm', 'pv_hospital_chaplain', {}, 40, 'stretched');
    const cold = withOffer('cold', 'pv_hospital_chaplain', {}, -30, 'critically_short');
    expect(releaseChance(warm, def)).toBeGreaterThan(releaseChance(cold, def));
    expect(releaseChance(cold, def)).toBeLessThanOrEqual(0.5);
    let kept: GameState | null = null;
    for (let i = 0; i < 30 && !kept; i++) {
      const s = withOffer(`kept-${i}`, 'pv_hospital_chaplain', {}, -30, 'critically_short');
      let next = acceptOffer(s, def, createRng(`accept-${i}`)).state;
      next = { ...next, clock: { ...next.clock, week: pendingAppointment(next)!.week } };
      next = parishWeekHook(deps)(next, createRng(`week-${i}`), []);
      if (!next.study) kept = next;
    }
    expect(kept).not.toBeNull();
    expect(kept!.phase).toBe('parochial_vicar');
    expect(kept!.parish).not.toBeNull();
    expect(kept!.flags['kept:hospital_chaplain']).toBe(true);
    expect(kept!.offerHistory.some((h) => h.offerId === def.id && h.decision === 'kept')).toBe(true);
    expect(kept!.pending.map((e) => e.eventId)).toContain('ap_letter_kept');
    expect(kept!.career.some((e) => /kept you/.test(e.text))).toBe(true);
    expect(pendingAppointment(kept!)).toBeNull();
    const pressed = resolvePending(kept!, kept!.pending.find((e) => e.eventId === 'ap_letter_kept')!, 'press', createRng('press'), deps);
    expect(pressed.flags.pressed_the_bishop).toBe(true);
  });

  it('a pending letter survives a save and load', () => {
    const s = withOffer('save', 'pv_rome_study');
    const next = acceptOffer(s, offerById('pv_rome_study')!, createRng('accept')).state;
    const back = deserialize(serialize(buildSave(next, createRng(next.seed), null, {}))).state;
    expect(pendingAppointment(back)).toEqual(pendingAppointment(next));
    expect(back.beats.find((b) => b.label === APPOINTMENT_BEAT)).toEqual(next.beats.find((b) => b.label === APPOINTMENT_BEAT));
  });

  it('the letters name the post and the parish', () => {
    for (const id of ['ap_letter_go', 'ap_letter_kept']) {
      const e = eventById(id)!;
      expect(e.body).toMatch(/\{appointment\}/);
      expect(e.body).toMatch(/\{appointment_from\}/);
      expect(e.severity).toBe('MAJOR');
    }
  });
});

describe('investment management as a career', () => {
  it('is a career with a trait, and opens the finance council and the investment committee', async () => {
    const { creationContent } = await import('@/content/creation');
    const career = creationContent.careers.find((c) => c.id === 'investment')!;
    expect(career.label).toBe('Investment management');
    expect(career.minDegree).toBe('college');
    expect(offerById('pv_investment_committee')!.accept.commitment!.away).toBeUndefined();
    expect(JSON.stringify(offerById('pv_finance_council')!.requires)).toContain('career:investment');
    expect(JSON.stringify(offerById('pv_investment_committee')!.requires)).toContain('career:investment');
  });
});
