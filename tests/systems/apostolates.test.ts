import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { clubsWeek, contactOf, joinClub, leaveClub } from '@/systems/clubs';
import { clubDefs } from '@/content/clubs';
import { resolveSelector } from '@/engine/selectors';
import { acceptOffer, dueFlag, isOfferEligible, offersWeek } from '@/engine/offers';
import { offerById, offersForPhase } from '@/content/offers';
import { eventById } from '@/content';
import { formationStanding } from '@/systems/standing';
import { scoreParish } from '@/systems/assignment';
import type { GameState } from '@/types';

const APOSTOLATES = ['respect_life', 'school_teaching', 'nursing_home', 'soup_kitchen'] as const;

function secondYear(seed: string): GameState {
  const s = seminaryState(seed);
  return { ...s, seminary: { ...s.seminary!, year: 2 }, clock: { ...s.clock, week: 60 } };
}

describe('the seminary apostolates', () => {
  it('four apostolates as data: someone who runs each, a term that earns a veteran, and a leadership letter that is promised', () => {
    for (const id of APOSTOLATES) {
      const def = clubDefs.find((c) => c.id === id)!;
      expect(def.kind).toBe('apostolate');
      expect(def.contact).toBeDefined();
      expect(def.credentialAfter?.flag).toBe(`apostolate:${id}:veteran`);
      const lead = offerById(`sem_lead_${id}`)!;
      expect(lead.from).toBe(`@contact:${id}`);
      expect(lead.guarantee?.when.some((c) => c.type === 'flag' && c.key === `apostolate:${id}:veteran`)).toBe(true);
      expect(lead.accept.effects.some((e) => e.target === 'flag' && e.key === `led:${id}`)).toBe(true);
      expect(lead.accept.effects.some((e) => e.target === 'flag' && e.key === 'apostolate_leader')).toBe(true);
    }
  });

  it('joining one makes the layperson who runs it, once, and the scenes can find them', () => {
    const s = secondYear('ap:join');
    const joined = joinClub(s, 'soup_kitchen', createRng('j'));
    const contact = contactOf(joined, 'soup_kitchen')!;
    expect(contact).toBeTruthy();
    expect(contact.role).toBe('lay');
    expect(contact.tags).toContain('contact:soup_kitchen');
    expect(resolveSelector(joined, '@contact:soup_kitchen')?.id).toBe(contact.id);
    expect(joined.flags['club:soup_kitchen']).toBe(true);
    // Deterministic, and kept: the same seed makes the same person, and leaving and coming back finds them again.
    expect(contactOf(joinClub(s, 'soup_kitchen', createRng('j')), 'soup_kitchen')!.name).toEqual(contact.name);
    const back = joinClub({ ...leaveClub(joined, 'soup_kitchen'), clubs: { ...joined.clubs!, memberships: {}, left: {} } }, 'soup_kitchen', createRng('k'));
    expect(contactOf(back, 'soup_kitchen')!.id).toBe(contact.id);
    // A society makes nobody.
    expect(contactOf(joinClub(s, 'thomists', createRng('t')), 'thomists')).toBeNull();
  });

  it('thirty weeks earns the veteran, the leadership letter comes within its window, and leading it is on the record', () => {
    let s = joinClub(secondYear('ap:lead'), 'school_teaching', createRng('j'));
    for (let i = 0; i < 30; i++) s = clubsWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(s.flags['apostolate:school_teaching:veteran']).toBe(true);
    const lead = offerById('sem_lead_school_teaching')!;
    expect(isOfferEligible(lead, s)).toBe(true);
    const defs = offersForPhase('seminary');
    let arrived: number | null = null;
    for (let i = 0; i < 20 && arrived === null; i++) {
      s = offersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`w${i}`), defs, offerById);
      if (i === 0) expect(typeof s.flags[dueFlag(lead)]).toBe('number');
      if (s.offers.some((o) => o.offerId === lead.id)) arrived = i;
    }
    expect(arrived).not.toBeNull();
    expect(arrived!).toBeLessThanOrEqual(lead.guarantee!.withinWeeks);
    const before = formationStanding(s).value;
    const led = acceptOffer(s, lead, createRng('a')).state;
    expect(led.flags['led:school_teaching']).toBe(true);
    expect(led.flags.apostolate_leader).toBe(true);
    expect(formationStanding(led).value).toBeGreaterThan(before);
    expect(formationStanding(led).reasons).toContain('you led something outside the house');
    expect(isOfferEligible(lead, led)).toBe(false);
  });

  it('the board remembers what he led, where the parish has the same work', () => {
    const p = parishState('ap:board');
    const withSchool = p.world!.parishes.find((x) => x.school !== 'none')!;
    const plain = scoreParish({ ...p, flags: { ordained: true, ordination_week: 0 } }, p.world!, withSchool);
    const led = scoreParish({ ...p, flags: { ordained: true, ordination_week: 0, 'led:school_teaching': true } }, p.world!, withSchool);
    expect(led.score).toBeGreaterThan(plain.score);
    expect(led.reasons).toContain('You gave a school its retreat once; this parish has a school');
  });

  it('each apostolate has three scenes of its own, gated on belonging, that turn on a roll', () => {
    const ids = ['ap_rl_vigil', 'ap_rl_the_girl', 'ap_rl_the_speech', 'ap_sch_hard_class', 'ap_sch_the_boy', 'ap_sch_the_play', 'ap_nh_the_man_who_stopped', 'ap_nh_the_death', 'ap_nh_the_bishop_visit', 'ap_sk_the_line', 'ap_sk_the_regular', 'ap_sk_the_city'];
    for (const id of ids) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'flag' && c.key.startsWith('club:')), id).toBe(true);
      expect(e.choices.some((c) => c.roll), id).toBe(true);
    }
    expect(eventById('ap_rl_the_girl')!.flavorPrompt).toBeUndefined();
    expect(eventById('ap_sk_the_regular')!.flavorPrompt).toBeUndefined();
  });
});
