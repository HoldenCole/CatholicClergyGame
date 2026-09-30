import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState, testNpc } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { dueFlag, isOfferEligible, offersWeek } from '@/engine/offers';
import { offerById, offersForPhase } from '@/content/offers';
import { eventById } from '@/content';
import { assignFirstParish, scoreParish } from '@/systems/assignment';
import { parishPrestige } from '@/systems/standing';
import type { GameState } from '@/types';

const defs = offersForPhase('parochial_vicar');

/** A vicar two years ordained, carrying one of the seminary's promises, with the classmates the letters mention. */
function promised(seed: string, flags: Record<string, boolean>, stats: Partial<Record<'theology' | 'knowledge', number>> = {}): GameState {
  const s = parishState(seed);
  const sem = seminaryState(seed);
  return {
    ...s,
    // The vocation director came with the seminary; the parish fixture skips those years.
    npcs: { ...s.npcs, ...sem.npcs, vocation_director: testNpc('vocation_director', { role: 'formator', tags: ['vocation_director'] }) },
    seminary: sem.seminary,
    clock: { ...s.clock, week: s.clock.week + 52 * 2 + 1 },
    flags: { ...s.flags, ...flags },
    character: { ...s.character!, stats: { ...s.character!.stats, theology: 45, knowledge: 45, ...stats } },
  };
}

function arrivalOf(start: GameState, id: string, weeks: number): { arrived: number | null; dueAtOnce: boolean; state: GameState } {
  let s = start;
  let arrived: number | null = null;
  let dueAtOnce = false;
  for (let i = 0; i < weeks && arrived === null; i++) {
    s = offersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`${id}:${i}`), defs, offerById);
    if (i === 0) dueAtOnce = typeof s.flags[dueFlag(offerById(id)!)] === 'number';
    // Counted from the week the promise was written down: the letter is due `withinWeeks` after it.
    if (s.offers.some((o) => o.offerId === id)) arrived = i;
  }
  return { arrived, dueAtOnce, state: s };
}

describe("the seminary's promises are kept", () => {
  it.each([
    ['mentor:chancery', 'pv_chancery_mentor'],
    ['patron:prominent_priest', 'pv_assist_prominent_priest'],
    ['vocations_helper', 'pv_vocations_office'],
    ['sem_cathedral_mc', 'pv_bishops_secretary'],
    ['rome_track', 'pv_italian_lessons'],
    ['canon_law_track', 'pv_canon_law_licentiate'],
  ])('%s: the letter it was a promise of (%s) comes within its window, whatever the dice say', (flag, id) => {
    const def = offerById(id)!;
    expect(def.guarantee).toBeDefined();
    const s = promised(`promise:${flag}`, { [flag]: true });
    expect(isOfferEligible(def, s)).toBe(true);
    const r = arrivalOf(s, id, def.guarantee!.withinWeeks + 4);
    expect(r.dueAtOnce).toBe(true);
    expect(r.arrived).not.toBeNull();
    expect(r.arrived!).toBeLessThanOrEqual(def.guarantee!.withinWeeks);
    // Without the promise there is no due date: only the dice.
    const plain = offersWeek(promised(`plain:${flag}`, {}), createRng('p'), defs, offerById);
    expect(plain.flags[dueFlag(def)]).toBeUndefined();
  });

  it("the rector's plan: after the two years, Rome for a theologian, the tribunal for a reader, the chancery for the rest, never two at once", () => {
    const rome = offersWeek(promised('plan:rome', { rector_plan: true }, { theology: 65, knowledge: 65 }), createRng('r'), defs, offerById);
    expect(typeof rome.flags[dueFlag(offerById('pv_rome_study')!)]).toBe('number');
    expect(rome.flags[dueFlag(offerById('pv_canon_law_licentiate')!)]).toBeUndefined();
    expect(rome.flags[dueFlag(offerById('pv_chancery_mentor')!)]).toBeUndefined();
    const law = offersWeek(promised('plan:law', { rector_plan: true }, { theology: 40, knowledge: 65 }), createRng('l'), defs, offerById);
    expect(law.flags[dueFlag(offerById('pv_rome_study')!)]).toBeUndefined();
    expect(typeof law.flags[dueFlag(offerById('pv_canon_law_licentiate')!)]).toBe('number');
    expect(law.flags[dueFlag(offerById('pv_chancery_mentor')!)]).toBeUndefined();
    const rest = offersWeek(promised('plan:rest', { rector_plan: true }), createRng('c'), defs, offerById);
    expect(rest.flags[dueFlag(offerById('pv_rome_study')!)]).toBeUndefined();
    expect(rest.flags[dueFlag(offerById('pv_canon_law_licentiate')!)]).toBeUndefined();
    expect(typeof rest.flags[dueFlag(offerById('pv_chancery_mentor')!)]).toBe('number');
    // Not before the two years are served.
    const early = promised('plan:early', { rector_plan: true }, { theology: 65 });
    const soon = offersWeek({ ...early, clock: { ...early.clock, week: early.flags.ordination_week as number + 30 } }, createRng('e'), defs, offerById);
    expect(soon.flags[dueFlag(offerById('pv_rome_study')!)]).toBeUndefined();
  });

  it("the rector's plan shapes the first posting, and the pastor he named is a man who forms priests", () => {
    const base = parishState('plan:post');
    const seminary: GameState = { ...base, flags: { ordained: true, ordination_week: 0, rector_plan: true } };
    const fits = base.world!.parishes.filter((p) => p.kind !== 'rural' && parishPrestige(p) >= 0.3 && parishPrestige(p) <= 0.7);
    expect(fits.length).toBeGreaterThan(0);
    const scored = scoreParish(seminary, base.world!, fits[0]!);
    expect(scored.reasons).toContain("The rector's plan: two years under a pastor who forms priests well and is not easy");
    const without = scoreParish({ ...seminary, flags: { ordained: true, ordination_week: 0 } }, base.world!, fits[0]!);
    expect(scored.score).toBeGreaterThan(without.score);
    expect(assignFirstParish(seminary, createRng('a')).reasons.length).toBeGreaterThan(0);
    // The first pastor is the mentor the plan promised, and the promise is spent on him.
    const placed = parishState('plan:boss', { flags: { ordained: true, ordination_week: 0, rector_plan: true } }, true);
    expect(placed.flags['boss:mentor']).toBe(true);
    expect(placed.flags['rector_plan:placed']).toBe(true);
  });

  it("the vocation director's interest and the famous pastor's friends speak at the board", () => {
    const base = parishState('promise:board');
    const flagship = base.world!.parishes.find((p) => p.kind === 'flagship_suburban')!;
    const mentor = scoreParish({ ...base, flags: { ordained: true, ordination_week: 0, 'mentor:chancery': true } }, base.world!, flagship);
    expect(mentor.reasons).toContain("The vocation director's word in the right ear, as he said there would be");
    const cooled = scoreParish({ ...base, flags: { ordained: true, ordination_week: 0, 'mentor:chancery': true, 'mentor:cooling': true } }, base.world!, flagship);
    expect(cooled.reasons).not.toContain("The vocation director's word in the right ear, as he said there would be");
    const patron = scoreParish({ ...base, flags: { ordained: true, ordination_week: 0, 'patron:prominent_priest': true } }, base.world!, flagship);
    expect(patron.reasons.some((r) => r.startsWith("The famous pastor's friends"))).toBe(true);
  });

  it('each promise has a scene of its own in the seminary, and the scene turns on a roll', () => {
    for (const [flag, id] of [
      ['mentor:chancery', 'semc_mentor_errand'],
      ['patron:prominent_priest', 'semc_patron_enemy'],
      ['rector_plan', 'semc_rector_letter'],
      ['vocations_helper', 'semc_back_row'],
      ['rome_track', 'semc_rome_italian'],
      ['canon_law_track', 'semc_tribunal_hearing'],
    ] as const) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'flag' && c.key === flag)).toBe(true);
      expect(e.choices.some((c) => c.roll)).toBe(true);
    }
  });
});
