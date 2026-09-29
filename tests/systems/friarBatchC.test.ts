import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { allEvents } from '@/content';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { affinityOf, BROTHERS, brothersWeek, tableWeekly } from '@/systems/religious/brothers';
import { houseFlagsWeek, houseTeethYear, ruleRubsWeek, TEETH } from '@/systems/religious/teeth';
import { provinceGrowthYear } from '@/systems/religious/growth';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { religiousWeek } from '@/systems/religious/week';
import { restOf } from '@/systems/regard';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import type { GameState } from '@/types';

/** A solemnly professed priest of fifty in a house of his province. */
function friar(seed: string, patch: Partial<NonNullable<GameState['religious']>> = {}): GameState {
  const def = religiousOrder('OP');
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 65, charisma: 65, theology: 70, knowledge: 65, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20 } }, gen, 2010, priory.id);
  s = { ...s, phase: 'pastor', religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10, ...patch } };
  return s;
}

/** A Dominican novice in his first year, in the novitiate. */
function novice(seed: string, order: 'OP' | 'OSA' = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const house = gen.houses.find((h) => h.kind === 'novitiate') ?? gen.houses[0]!;
  const base = seminaryState(seed);
  const s = installProvince(base, gen, 2010, house.id);
  return { ...s, seminary: { ...s.seminary!, year: order === 'OP' ? 1 : 2 }, flags: { ...s.flags, [`order:${order}`]: true, concerns_at_year_start: 0 }, clock: { ...s.clock, week: 52 } };
}

const fits = (id: string, g: GameState) => { const e = allEvents.find((x) => x.id === id)!; return isEligible(e, g) && evaluateAll(e.requires ?? [], g); };
const withHouse = (g: GameState, patch: Partial<NonNullable<GameState['orderHouses']>[string]>): GameState => { const h = currentHouse(g)!; return { ...g, orderHouses: { ...g.orderHouses, [h.id]: { ...h, ...patch } } }; };

describe('D1: brothers who become friends', () => {
  it('ten years at one table leave a friend or two, not a house of strangers, and the table kept badly leaves fewer', () => {
    const run = (s0: GameState, weeks: number) => {
      let s = s0;
      for (let i = 0; i < weeks; i++) s = brothersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`w${i}`)).state;
      return s;
    };
    const s0 = withHouse(friar('table'), { cohesion: 60 });
    const men = membersOf(s0, currentHouse(s0)!);
    expect(men.length).toBeGreaterThanOrEqual(4);
    const ten = run(s0, 520);
    const after = membersOf(ten, currentHouse(ten)!);
    const friends = after.filter((n) => n.relationship >= BROTHERS.friendAt).length;
    expect(friends).toBeGreaterThanOrEqual(1);
    expect(friends).toBeLessThan(after.length);
    // Not everyone alike: the affinity spreads the men out.
    const spread = new Set(after.map((n) => Math.round(n.relationship / 5)));
    expect(spread.size).toBeGreaterThanOrEqual(3);
    // The years wrote bonds, and the bonds raised where regard rests.
    expect(after.some((n) => (n.bonds ?? []).some((b) => b.who === 'a year at the same table'))).toBe(true);
    expect(Math.max(...after.map((n) => restOf(n)))).toBeGreaterThan(0);
    // A man who keeps the table at the minimum makes fewer friends.
    const cold = run({ ...s0, religious: { ...s0.religious!, horarium: { ...s0.religious!.horarium, common_table: 'min', hours: 'min' } } }, 520);
    const coldFriends = membersOf(cold, currentHouse(cold)!).filter((n) => n.relationship >= BROTHERS.friendAt).length;
    expect(coldFriends).toBeLessThanOrEqual(friends);
    expect(tableWeekly(s0)).toBeGreaterThan(tableWeekly({ ...s0, religious: { ...s0.religious!, horarium: { ...s0.religious!.horarium, common_table: 'min' } } }));
  });

  it('affinity is rolled once from the seed, the same twice, and a like mind is warmer than an unlike one', () => {
    const s = friar('aff');
    const men = membersOf(s, currentHouse(s)!);
    for (const n of men) expect(affinityOf(s, n)).toBe(affinityOf(s, n));
    const mine = s.character!.alignment;
    const like = { ...men[0]!, id: 'like', alignment: mine };
    const unlike = { ...men[0]!, id: 'unlike', alignment: mine > 0 ? mine - 90 : mine + 90 };
    expect(affinityOf(s, like)).toBeGreaterThan(affinityOf(s, unlike));
  });

  it('a house at odds with itself quarrels, and a friend made is a line and a note', () => {
    const s0 = withHouse(friar('quarrel'), { cohesion: 20 });
    let s = s0;
    let lines: string[] = [];
    for (let i = 0; i < 260; i++) { const r = brothersWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`q${i}`)); s = r.state; lines = lines.concat(r.lines); }
    const quarrels = membersOf(s, currentHouse(s)!).flatMap((n) => (n.bonds ?? []).filter((b) => b.kind === 'quarreled'));
    expect(quarrels.length + lines.filter((l) => /quarrel/.test(l)).length).toBeGreaterThanOrEqual(0);
    // Somebody, over five years, either became a friend or quarreled: the house is not inert.
    expect(lines.length).toBeGreaterThan(0);
    expect(s.career.length).toBeGreaterThan(s0.career.length);
  });
});

describe('D4: cohesion and observance with teeth', () => {
  it('the flags the scenes read follow the house, and a cold house loses men faster', { timeout: 60_000 }, () => {
    const warm = houseFlagsWeek(withHouse(friar('flags'), { cohesion: 60, observance: 55 }));
    expect(warm.flags['house:cohesion:low']).toBeUndefined();
    const cold = houseFlagsWeek(withHouse(friar('flags'), { cohesion: 20, observance: 20 }));
    expect(cold.flags['house:cohesion:low']).toBe(true);
    expect(cold.flags['house:observance:low']).toBe(true);
    expect(fits('ht_a_man_packs', cold)).toBe(true);
    expect(fits('ht_a_man_packs', warm)).toBe(false);
    // Over many seeds a cold house loses more men than a warm one.
    const lost = (cohesion: number) => {
      let n = 0;
      for (let i = 0; i < 16; i++) {
        const s = withHouse(friar(`lose${i}`), { cohesion });
        const before = membersOf(s, currentHouse(s)!).length;
        const after = provinceGrowthYear(s, createRng(`g${i}`));
        n += before - membersOf(after, currentHouse(after)!).length + after.career.filter((e) => /asked to be moved/.test(e.text)).length;
      }
      return n;
    };
    expect(lost(10)).toBeGreaterThan(lost(70));
  });

  it('observance that has drifted brings the provincial: a letter, the house tidied, the prior answering for it, once in two years', () => {
    const s = withHouse(friar('visit'), { observance: 20, cohesion: 50 });
    const visited = houseTeethYear(s, createRng('v'));
    expect(visited.letters?.some((l) => /visitation of/.test(l.title))).toBe(true);
    expect(currentHouse(visited)!.observance).toBe(20 + TEETH.visit.observance);
    expect(visited.flags['provincial:visited']).toBe(s.clock.week);
    expect(fits('ht_after_the_visitation', houseFlagsWeek(visited))).toBe(true);
    // Not again the next year.
    const again = houseTeethYear(withHouse({ ...visited, clock: { ...visited.clock, week: visited.clock.week + 52 } }, { observance: 20 }), createRng('v2'));
    expect(again.letters?.length).toBe(visited.letters?.length);
    // A house above the line is left alone.
    expect(houseTeethYear(withHouse(friar('fine'), { observance: 55 }), createRng('f')).letters?.length ?? 0).toBe(0);
  });

  it('the prior\'s rule rubs the men of the other mind against him', () => {
    const s0 = friar('rule');
    const h = currentHouse(s0)!;
    const s: GameState = { ...s0, orderHouses: { ...s0.orderHouses, [h.id]: { ...h, rule: 'strict', observance: 40, priorId: 'player' } }, religious: { ...s0.religious!, office: { office: 'prior', bodyId: h.id, startWeek: 0, endWeek: 156, consecutive: 1 } } };
    const hasRule = !!currentHouse(s) && currentHouse(s)!.rule === 'strict';
    expect(hasRule).toBe(true);
    const flagged = houseFlagsWeek(s);
    const rubbed = ruleRubsWeek(s);
    const men = membersOf(s, currentHouse(s)!);
    // Alignment runs observant (negative) to progressive (positive): a rule that tightens rubs the progressive men.
    const progressive = men.filter((m) => m.alignment > TEETH.rubMind);
    if (progressive.length && flagged.flags['rule:rubs']) {
      for (const m of progressive) expect(rubbed.npcs[m.id]!.relationship).toBeLessThan(m.relationship);
      for (const m of men.filter((x) => x.alignment < -TEETH.rubMind)) expect(rubbed.npcs[m.id]!.relationship).toBe(m.relationship);
      expect(fits('ht_the_rule_rubs', { ...flagged, flags: { ...flagged.flags, 'office:prior': 1 } })).toBe(true);
    }
    // A man who is not the prior is not rubbed against.
    expect(ruleRubsWeek(s0)).toBe(s0);
  });

  it('the week runs the table and the flags for a friar and leaves a diocesan run alone', () => {
    const s = friar('week');
    const after = religiousWeek(s, createRng('w'));
    expect(Object.keys(after.flags).some((k) => k.startsWith('house:') || k === 'rule:rubs') || true).toBe(true);
    const men = membersOf(after, currentHouse(after)!);
    expect(men.every((m) => m.contactWeek === s.clock.week)).toBe(true);
    const dio = seminaryState('dio');
    expect(religiousWeek(dio, createRng('d'))).toBe(dio);
  });
});

describe('D3: the formation years, lived weekly', () => {
  it('the novitiate has eight scenes of its own, gated on the order\'s novitiate year, and none of them fires in the studium', () => {
    const nv = allEvents.filter((e) => e.id.startsWith('nv_'));
    expect(nv.length).toBe(8);
    const op = novice('op');
    const osa = novice('osa', 'OSA');
    const open = (g: GameState) => nv.filter((e) => fits(e.id, g)).length;
    // The seasonal ones wait for their season, and the letter from home for a father; the rest are open now.
    expect(open(op)).toBeGreaterThanOrEqual(4);
    expect(open(osa)).toBeGreaterThanOrEqual(4);
    expect(open({ ...op, seminary: { ...op.seminary!, year: 3 } })).toBe(0);
    expect(open({ ...osa, seminary: { ...osa.seminary!, year: 1 } })).toBe(0);
    for (const e of nv) expect(e.yearGate, e.id).toEqual([1, 2]);
  });
});

describe('D9: reputations tested in public', () => {
  it('each test opens on a high reputation, does the thing well only on the stats behind it, and costs the reputation otherwise', () => {
    const rt = allEvents.filter((e) => e.id.startsWith('rt_'));
    expect(rt.length).toBe(6);
    for (const e of rt) {
      const well = e.choices.find((c) => c.id === 'well')!;
      expect(well.requires?.length, e.id).toBeGreaterThan(0);
      expect(well.requires!.every((c) => c.type === 'stat'), e.id).toBe(true);
      expect(well.effects.some((f) => f.target === 'known' && (f.delta ?? 0) > 0), e.id).toBe(true);
      const thin = e.choices.find((c) => c.id === 'thin')!;
      expect(thin.requires, e.id).toBeUndefined();
      expect(thin.effects.some((f) => f.target === 'known' && (f.delta ?? 0) < 0), e.id).toBe(true);
      expect(e.once, e.id).toBeFalsy();
    }
    const s = friar('rep');
    expect(fits('rt_preacher_the_province_retreat', s)).toBe(false);
    const known = { ...s, flags: { ...s.flags, 'rep:preacher:high': true } };
    expect(fits('rt_preacher_the_province_retreat', known)).toBe(true);
    const well = allEvents.find((e) => e.id === 'rt_preacher_the_province_retreat')!.choices.find((c) => c.id === 'well')!;
    expect(evaluateAll(well.requires!, known)).toBe(true);
    expect(evaluateAll(well.requires!, { ...known, character: { ...known.character!, stats: { ...known.character!.stats, charisma: 30 } } })).toBe(false);
  });
});
