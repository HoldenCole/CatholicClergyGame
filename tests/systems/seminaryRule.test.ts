import { describe, it, expect } from 'vitest';
import { seminaryState, testNpc } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { devotionDefs, recreationDefs, seminaryHorariumDefs } from '@/content/seminary';
import { RULE, horariumHourShift, horariumOf, observanceTarget, ruleWeek, setRecreation, setSeminaryHorarium, toggleDevotion } from '@/systems/seminaryRule';
import { seminaryBudget } from '@/systems/seminaryWeek';
import { formationStanding } from '@/systems/standing';
import { eventById } from '@/content';
import type { GameState } from '@/types';

function house(seed: string, temper: 'enforcer' | 'confidant' = 'enforcer'): GameState {
  const s = seminaryState(seed);
  return { ...s, seminary: { ...s.seminary!, year: 3 }, npcs: { ...s.npcs, vice_rector: testNpc('vice_rector', { role: 'formator', tags: ['vice_rector', `vice_rector:${temper}`], relationship: 0 }) }, flags: { ...s.flags, [`vice_rector:${temper}`]: true } };
}

describe('the seminary as a house with a rule', () => {
  it('the horarium is kept at a level: the minimum frees an hour and costs, the invested level costs an hour and pays; the flags follow', () => {
    const s = house('rule:h');
    expect(horariumOf(s.seminary!)).toEqual(Object.fromEntries(seminaryHorariumDefs.map((d) => [d.key, 'standard'])));
    const base = seminaryBudget(s);
    const loose = setSeminaryHorarium(s, 'office', 'min');
    expect(horariumHourShift(loose.seminary!)).toBe(1);
    expect(seminaryBudget(loose)).toBe(base + 1);
    expect(loose.flags['horarium:office:min']).toBe(true);
    const full = setSeminaryHorarium(loose, 'office', 'invested');
    expect(seminaryBudget(full)).toBe(base - 1);
    expect(full.flags['horarium:office:min']).toBeUndefined();
    expect(full.flags['horarium:office:invested']).toBe(true);
    const weekLoose = ruleWeek(loose, createRng('w')).state;
    const weekFull = ruleWeek(full, createRng('w')).state;
    expect(weekFull.character!.stats.piety).toBeGreaterThan(weekLoose.character!.stats.piety);
    expect(weekFull.npcs.vice_rector!.relationship).toBeGreaterThan(weekLoose.npcs.vice_rector!.relationship);
    expect(observanceTarget(full.seminary!)).toBeGreaterThan(observanceTarget(loose.seminary!));
  });

  it('a rule of prayer is up to three devotions of his own, and the evening is one habit; both leave flags the scenes read', () => {
    let s = house('rule:r');
    s = toggleDevotion(s, 'rosary');
    s = toggleDevotion(s, 'lectio');
    s = toggleDevotion(s, 'examen');
    expect(s.seminary!.rule).toEqual(['rosary', 'lectio', 'examen']);
    expect(s.flags['rule:rosary']).toBe(true);
    expect(() => toggleDevotion(s, 'night_adoration')).toThrow(/let one go/);
    s = toggleDevotion(s, 'lectio');
    expect(s.seminary!.rule).toEqual(['rosary', 'examen']);
    expect(s.flags['rule:lectio']).toBeUndefined();
    s = setRecreation(s, 'the_walk');
    expect(s.flags['recreation:the_walk']).toBe(true);
    s = setRecreation(s, 'the_garden');
    expect(s.flags['recreation:the_walk']).toBeUndefined();
    expect(s.flags['recreation:the_garden']).toBe(true);
    // The bar is not for a first-year man.
    const first = { ...s, seminary: { ...s.seminary!, year: 1 } };
    expect(() => setRecreation(first, 'the_bar')).toThrow();
    expect(devotionDefs.length).toBeGreaterThanOrEqual(6);
    expect(recreationDefs.length).toBeGreaterThanOrEqual(7);
    // A week of the rule moves piety and the spiritual pillar; the evening eases strain.
    const strained = { ...s, strain: 30 };
    const w = ruleWeek(strained, createRng('x')).state;
    expect(w.character!.stats.piety).toBeGreaterThan(strained.character!.stats.piety);
    expect(w.seminary!.pillarScores.spiritual).toBeGreaterThan(strained.seminary!.pillarScores.spiritual);
    expect(w.strain!).toBeLessThan(30);
  });

  it("the vice-rector's notebook: late mornings are seen more by an enforcer, and enough of them become a concern; a new year wipes the count", () => {
    const loose = setRecreation(setSeminaryHorarium(house('rule:late'), 'office', 'min'), 'the_bar');
    const strict = { ...loose, strain: 60 };
    let enforcer = strict;
    let confidant: GameState = { ...strict, npcs: { ...strict.npcs, vice_rector: { ...strict.npcs.vice_rector!, tags: ['vice_rector', 'vice_rector:confidant'] } }, flags: { ...strict.flags, 'vice_rector:enforcer': false, 'vice_rector:confidant': true } };
    for (let w = 0; w < 40; w++) {
      enforcer = ruleWeek({ ...enforcer, clock: { ...enforcer.clock, week: enforcer.clock.week + 1 } }, createRng(`e${w}`)).state;
      confidant = ruleWeek({ ...confidant, clock: { ...confidant.clock, week: confidant.clock.week + 1 } }, createRng(`e${w}`)).state;
    }
    expect(enforcer.seminary!.lates!).toBeGreaterThan(confidant.seminary!.lates!);
    expect(enforcer.seminary!.lates!).toBeGreaterThanOrEqual(RULE.latesForConcern);
    expect(enforcer.seminary!.concerns).toContain(RULE.concern);
    expect(enforcer.seminary!.observance!).toBeLessThan(RULE.observanceBase);
    // A man who keeps the rule and goes to bed is rarely in the book.
    let kept = setRecreation(toggleDevotion(setSeminaryHorarium(house('rule:kept'), 'office', 'invested'), 'lectio'), 'early_to_bed');
    for (let w = 0; w < 40; w++) kept = ruleWeek({ ...kept, clock: { ...kept.clock, week: kept.clock.week + 1 } }, createRng(`k${w}`)).state;
    expect(kept.seminary!.lates ?? 0).toBeLessThan(RULE.latesForConcern);
    expect(kept.seminary!.observance!).toBeGreaterThan(RULE.observanceBase);
    // Determinism: the same week, the same book.
    expect(ruleWeek(strict, createRng('same')).state.seminary!.lates).toBe(ruleWeek(strict, createRng('same')).state.seminary!.lates);
    // Standing reads the house's view.
    expect(formationStanding(kept).value).toBeGreaterThan(formationStanding(enforcer).value);
    expect(formationStanding({ ...kept, seminary: { ...kept.seminary!, observance: 80 } }).reasons).toContain('a man of the rule, the house says');
  });

  it('the ten scenes of the rule are gated on what the sheet writes, and turn on rolls', () => {
    const gates: Record<string, string> = { hr_classmate_asks: 'rule:rosary', hr_the_key: 'rule:night_adoration', hr_the_bar_night: 'recreation:the_bar', hr_film_committee: 'recreation:film_night', hr_lauds_empty: 'horarium:office:min', hr_the_tray: 'horarium:table:min', hr_the_garden_brother: 'recreation:the_garden', hr_the_music_room: 'recreation:music_room' };
    for (const [id, flag] of Object.entries(gates)) {
      const e = eventById(id)!;
      expect(e.requires?.some((c) => c.type === 'flag' && c.key === flag), id).toBe(true);
      expect(e.choices.some((c) => c.roll), id).toBe(true);
    }
    expect(eventById('hr_dryness')!.flavorPrompt).toBeUndefined();
    expect(eventById('hr_lent_resolution')!.requires?.some((c) => c.type === 'season')).toBe(true);
  });
});
