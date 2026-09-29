import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { beginStudy } from '@/engine/study';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { deathChance } from '@/engine/career';
import { studySceneChance } from '@/engine/weekHook';
import { allEvents } from '@/content';
import { offerById } from '@/content/offers';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { beginGeneralate } from '@/systems/religious/general';
import { awayForRest, STRAIN, strainWeek } from '@/systems/religious/strain';
import { yearInReview } from '@/systems/review';
import { WEEK } from '@/systems/week';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { parishState } from './week.test';
import type { GameState } from '@/types';

/** A solemnly professed priest of fifty in a house of his province, with the Roman credentials. */
function friar(seed: string, patch: Partial<NonNullable<GameState['religious']>> = {}): GameState {
  const def = religiousOrder('OP');
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 65, charisma: 65, theology: 70, knowledge: 65, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20 } }, gen, 2010, priory.id);
  const c = s.character!;
  s = { ...s, phase: 'pastor', character: { ...c, credentials: [...c.credentials, 'italian', 'STL'] }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10, legibility: 80, ...patch } };
  return s;
}

const fits = (id: string, g: GameState) => { const e = allEvents.find((x) => x.id === id)!; return isEligible(e, g) && evaluateAll(e.requires ?? [], g); };
const later = (g: GameState, weeks: number): GameState => ({ ...g, clock: { ...g.clock, week: g.clock.week + weeks } });

describe('Q6: the general\'s years', () => {
  const general = (seed: string) => {
    const s = friar(seed, { office: { office: 'general', bodyId: 'order', startWeek: 0, endWeek: 9 * 52, consecutive: 1 } });
    return beginGeneralate({ ...s, flags: { ...s.flags, 'office:general': true } });
  };

  it('a term at the head of the order has a dozen scenes that come back, not a first year and silence', () => {
    const g = later(general('gen'), 60);
    expect(g.study?.city).toBe('generalate');
    const mine = allEvents.filter((e) => e.id.startsWith('gy_'));
    expect(mine.length).toBeGreaterThanOrEqual(12);
    for (const e of mine) expect(e.once, e.id).toBeFalsy();
    const open = mine.filter((e) => fits(e.id, g));
    expect(open.length).toBeGreaterThanOrEqual(10);
    // Every one of them writes the order's dials or its book, and none fires for a professor.
    for (const e of mine) expect(e.choices.some((c) => c.effects.some((f) => f.target === 'place' || f.target === 'record')), e.id).toBe(true);
    const professor = later(beginStudy(friar('prof'), offerById('fr_roman_faculty')!, false, createRng('f')), 60);
    expect(mine.some((e) => fits(e.id, professor))).toBe(false);
  });

  it('the generalate draws a scene far more often than a student\'s week, and the review counts the order', () => {
    const g = later(general('draw'), 60);
    expect(studySceneChance(g)).toBeGreaterThan(0.2);
    const student = { ...g, study: { ...g.study!, city: 'rome' as const } };
    expect(studySceneChance(student)).toBe(0.1);
    const dio = { ...parishState('dio'), study: g.study };
    expect(studySceneChance(dio)).toBe(0.1);
    const withBook = { ...g, study: { ...g.study!, record: { visitations: 3, letters: 1 } } };
    const rows = yearInReview(withBook).letter.rows!;
    expect(rows.find((r) => r.label === 'The order, so far')?.value).toMatch(/visited|letter/i);
  });
});

describe('Q7: the faculty\'s years', () => {
  it('the chair in Rome has repeatable scenes of its own, and the Curia has the friar\'s', () => {
    const s = friar('fac');
    const faculty = later(beginStudy(s, offerById('fr_roman_faculty')!, false, createRng('f')), 70);
    const curia = later(beginStudy(s, offerById('fr_curia_official')!, false, createRng('c')), 40);
    const fy = allEvents.filter((e) => e.id.startsWith('fy_'));
    const cy = allEvents.filter((e) => e.id.startsWith('cy_'));
    expect(fy.length).toBeGreaterThanOrEqual(7);
    expect(cy.length).toBeGreaterThanOrEqual(3);
    for (const e of [...fy, ...cy]) expect(e.once, e.id).toBeFalsy();
    expect(fy.filter((e) => fits(e.id, faculty)).length).toBeGreaterThanOrEqual(6);
    expect(cy.filter((e) => fits(e.id, curia)).length).toBeGreaterThanOrEqual(3);
    expect(fy.some((e) => fits(e.id, curia))).toBe(false);
    expect(cy.some((e) => fits(e.id, faculty))).toBe(false);
    expect(studySceneChance(faculty)).toBeGreaterThan(0.1);
  });
});

describe('Q8: strain that does something', () => {
  it('past the sick line the week is cut: the free blocks halved, the body rested, and someone named', () => {
    const s0 = friar('sick');
    const s = { ...s0, strain: 90, religious: { ...s0.religious!, spends: { study: 4, hospital: 2 } } };
    const res = strainWeek(s);
    expect(res.state.religious!.spends).toEqual({ study: 2, hospital: 1 });
    expect(res.state.strain).toBeLessThan(90);
    expect(res.line).toMatch(/cut your (own )?week|has cut your week/);
    // Said once, then not again for a while.
    expect(strainWeek(later(res.state, 1)).line).toBeNull();
    expect(strainWeek(later(res.state, STRAIN.cutLineEvery)).line).not.toBeNull();
    // A rested man's week is his own.
    expect(strainWeek({ ...s, strain: 30 }).state.religious!.spends).toEqual({ study: 4, hospital: 2 });
  });

  it('a sabbatical takes him off the work for its weeks, rests him faster, and ends with him home', () => {
    const s0 = friar('sabb');
    const s = { ...s0, strain: 85, flags: { ...s0.flags, 'sabbatical:asked': true }, religious: { ...s0.religious!, spends: { study: 3 } } };
    const begun = strainWeek(s);
    expect(begun.line).toMatch(/sabbatical begins/);
    expect(awayForRest(begun.state)).toEqual({ kind: 'sabbatical', until: s.clock.week + STRAIN.sabbaticalWeeks });
    expect(begun.state.religious!.spends).toEqual({});
    expect(begun.state.flags['sabbatical:asked']).toBeUndefined();
    const mid = strainWeek(later(begun.state, 5));
    expect(mid.state.strain).toBe(85 - STRAIN.awayRecovery);
    const home = strainWeek(later(begun.state, STRAIN.sabbaticalWeeks));
    expect(home.line).toMatch(/Home from the sabbatical/);
    expect(awayForRest(home.state)).toBeNull();
    expect(home.state.career.some((e) => /Back from the sabbatical/.test(e.text))).toBe(true);
    // The prior's permission starts one too, once per grant.
    const granted = strainWeek({ ...s0, flags: { ...s0.flags, 'permission:sabbatical': s0.clock.week } });
    expect(awayForRest(granted.state)?.kind).toBe('sabbatical');
    const again = strainWeek(later({ ...granted.state, flags: { ...granted.state.flags, 'away:until': undefined as never } }, 1));
    expect(awayForRest(again.state)).toBeNull();
    // The infirmary house is a season.
    const inf = strainWeek({ ...s0, flags: { ...s0.flags, 'infirmary:asked': true } });
    expect(awayForRest(inf.state)).toEqual({ kind: 'infirmary', until: s0.clock.week + STRAIN.infirmaryWeeks });
  });

  it('the scenes: the infirmarian, the prior, and past sixty-five the province; and the death roll reads strain', () => {
    const s = { ...friar('scenes'), strain: 90 };
    expect(fits('st_infirmarian_speaks', s)).toBe(true);
    expect(fits('st_prior_cuts_the_week', s)).toBe(true);
    expect(fits('st_province_offers_rest', s)).toBe(false); // fifty, not sixty-five
    const old = { ...s, character: { ...s.character!, entryYear: 1965 } };
    expect(fits('st_province_offers_rest', old)).toBe(true);
    expect(fits('st_infirmarian_speaks', { ...s, strain: 40 })).toBe(false);
    expect(fits('st_infirmarian_speaks', { ...s, flags: { ...s.flags, 'away:until': 999 } })).toBe(false);
    expect(deathChance(70, 100)).toBeGreaterThan(deathChance(70, 0));
    expect(deathChance(70, WEEK.strainWorn)).toBe(deathChance(70, 0));
    expect(deathChance(70, 100) / deathChance(70, 0)).toBeCloseTo(1.75, 5);
  });
});

describe('Q9: the foundation that failed while he was away', () => {
  it('is a scene for the founder who was not its prior, and not for the one who was', () => {
    const s = friar('fail');
    const away = { ...s, flags: { ...s.flags, 'foundation:failed': s.clock.week - 2 } };
    expect(fits('fd_end_closed_while_away', away)).toBe(true);
    expect(fits('fd_end_closed_while_away', { ...away, flags: { ...away.flags, 'foundation:failed:mine': s.clock.week - 2 } })).toBe(false);
    expect(fits('fd_end_closed_while_away', s)).toBe(false);
    const e = allEvents.find((x) => x.id === 'fd_end_closed_while_away')!;
    expect(e.baseWeight).toBeGreaterThanOrEqual(40);
    // The founder's regard moves with every answer.
    for (const c of e.choices) expect(c.effects.some((f) => f.target === 'reputation' || f.target === 'relationship'), c.id).toBe(true);
  });
});

describe('Q10: a friar\'s year in review', () => {
  it('reads the common life, what he is known for, the house and its men, and the obedience; the pastor\'s does not', () => {
    const s0 = friar('review');
    const w = s0.clock.week;
    const s: GameState = {
      ...s0,
      clock: { ...s0.clock, week: w + 52 },
      religious: { ...s0.religious!, horarium: { ...s0.religious!.horarium, hours: 'invested', common_table: 'min' }, reputations: { confessor: 70, professor: 40 }, observance: 80, assignments: [{ houseId: s0.religious!.houseId, dioceseId: 'x', work: 'parish', startWeek: w + 10, grace: 'reluctant' }] },
      career: [...s0.career, { week: w + 20, kind: 'note', text: 'Fr. John Smith left the order, before solemn vows.' }, { week: w + 30, kind: 'note', text: '2 men entered through the house this year, and went to the novitiate.' }],
    };
    const rows = yearInReview(s).letter.rows!;
    const by = (label: string) => rows.find((r) => r.label === label)?.value ?? '';
    expect(by('The common life')).toMatch(/hours.* in full/i);
    expect(by('The common life')).toMatch(/at the minimum/);
    expect(by('Known for')).toMatch(/confessor, well known/);
    expect(by('The house')).toMatch(/2 entered, 1 left/);
    expect(by('Under obedience')).toMatch(/taken badly/);
    expect(rows.some((r) => r.label === 'The province')).toBe(false);
    const dio = yearInReview(parishState('dio')).letter.rows!;
    expect(dio.some((r) => ['The common life', 'Known for', 'Under obedience'].includes(r.label))).toBe(false);
  });

  it('the provincial reads the province\'s books in his review', () => {
    const s = friar('prov');
    const p = { ...s, province: { ...s.province!, provincialId: 'player' }, religious: { ...s.religious!, office: { office: 'provincial' as const, bodyId: s.province!.id, startWeek: 0, endWeek: 208, consecutive: 1 } } };
    const rows = yearInReview(p).letter.rows!;
    expect(rows.find((r) => r.label === 'The province')?.value).toMatch(/sound|tight|in the red|in crisis/);
    expect(rows.find((r) => r.label === 'Under obedience')?.value).toMatch(/prior provincial since/);
  });
});
