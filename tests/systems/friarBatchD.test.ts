import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import { allEvents, eventFiles } from '@/content';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { FORMED, formedMenOf, formedMenYear, formingOffice } from '@/systems/religious/formedMen';
import { electorsOf } from '@/systems/religious/electorate';
import { currentHouse, membersOf } from '@/systems/religious/house';
import { askHouseOffice } from '@/systems/religious/requests';
import { lifeOf } from '@/systems/life';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import type { GameState, OrderKey } from '@/types';

/** A solemnly professed priest of forty in the province's novitiate, with the stats the formation offices want. */
function friarAt(seed: string, kind: 'novitiate' | 'studium' | 'priory', order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const house = gen.houses.find((h) => h.kind === kind) ?? gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1992, stats: { administration: 60, charisma: 60, theology: 65, knowledge: 60, piety: 65 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 12 } }, gen, 2010, house.id);
  s = { ...s, phase: 'pastor', clock: { ...s.clock, week: 100 }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 10 } };
  return s;
}

/** Appointed to the office by id, the flag the scenes read set. */
function appointed(s: GameState, id: string): GameState {
  return { ...s, religious: { ...s.religious!, appointment: { id, startWeek: s.clock.week, endWeek: s.clock.week + 4 * 52 } }, flags: { ...s.flags, [`office:${id}`]: s.clock.week } };
}

/** The house has at least one man of the stage, made so if the roll gave none. */
function withStage(s: GameState, tag: 'vows:novice' | 'vows:simple'): GameState {
  const house = currentHouse(s)!;
  const men = membersOf(s, house);
  if (men.some((m) => m.tags.includes(tag))) return s;
  const m = men.find((x) => x.id !== house.priorId)!;
  return { ...s, npcs: { ...s.npcs, [m.id]: { ...m, tags: [...m.tags.filter((t) => !t.startsWith('vows:')), tag] } } };
}

const fits = (id: string, g: GameState) => { const e = allEvents.find((x) => x.id === id)!; return isEligible(e, g) && evaluateAll(e.requires ?? [], g); };

describe('D8: the novice master\'s men', () => {
  it('the offices that form men are data on the order, one for the novices and one for the students in each order', () => {
    for (const key of ['OP', 'OSA'] as const) {
      const offices = religiousOrder(key).offices;
      expect(offices.filter((o) => o.forms === 'novices').length, key).toBe(1);
      expect(offices.filter((o) => o.forms === 'students').length, key).toBe(1);
      expect(offices.find((o) => o.forms === 'novices')!.house).toBe('novitiate');
    }
    const s = friarAt('form', 'novitiate');
    expect(formingOffice(s)).toBeUndefined();
    expect(formingOffice(appointed(s, 'novice_master'))?.forms).toBe('novices');
    expect(formingOffice(appointed(s, 'regent_of_studies'))).toBeUndefined();
  });

  it('the year makes the novices his: warmer, bonded, tagged, noted, and never twice; and the record follows them', () => {
    const s = withStage(appointed(friarAt('men', 'novitiate'), 'novice_master'), 'vows:novice');
    const house = currentHouse(s)!;
    const novices = membersOf(s, house).filter((m) => m.tags.includes('vows:novice'));
    expect(novices.length).toBeGreaterThan(0);
    const y1 = formedMenYear(s);
    expect(formedMenOf(y1).length).toBe(novices.length);
    for (const n of novices) {
      const after = y1.npcs[n.id]!;
      expect(after.relationship).toBe(Math.min(100, n.relationship + FORMED.warmth));
      expect(after.tags).toContain(FORMED.tag);
      expect(after.bonds?.some((b) => /clothed by you/.test(b.who))).toBe(true);
    }
    expect(y1.flags['formed:any']).toBe(true);
    expect(y1.career.some((e) => /^Clothed this year:/.test(e.text))).toBe(true);
    expect(formedMenOf(formedMenYear(y1)).length).toBe(novices.length);
    // The record follows a man to his vows, his ordination, and out of the door.
    const first = novices[0]!;
    const professed = { ...y1, npcs: { ...y1.npcs, [first.id]: { ...y1.npcs[first.id]!, tags: y1.npcs[first.id]!.tags.map((t) => (t === 'vows:novice' ? 'vows:simple' : t)) } } };
    const y2 = formedMenYear({ ...professed, clock: { ...professed.clock, week: professed.clock.week + 52 } });
    expect(y2.career.some((e) => new RegExp(`${first.name.last}, whom you clothed, made simple profession`).test(e.text))).toBe(true);
    expect(formedMenOf(y2).find((f) => f.npcId === first.id)!.stage).toBe('simple');
    const gone = { ...y2, npcs: { ...y2.npcs, [first.id]: { ...y2.npcs[first.id]!, status: 'left' as const } } };
    const y3 = formedMenYear({ ...gone, clock: { ...gone.clock, week: gone.clock.week + 52 } });
    expect(y3.career.some((e) => /whom you clothed, left the order/.test(e.text))).toBe(true);
    // The shelf lists them.
    expect(lifeOf(y3).formed?.some((f) => f.as === 'clothed' && f.stage === 'left the order')).toBe(true);
    // The master of students' men are the students, and taught, not clothed.
    const st = withStage(appointed(friarAt('students', 'studium'), 'master_of_students'), 'vows:simple');
    const ys = formedMenYear(st);
    expect(formedMenOf(ys).length).toBeGreaterThan(0);
    expect(formedMenOf(ys).every((f) => f.as === 'student')).toBe(true);
    expect(ys.career.some((e) => /^Taught this year:/.test(e.text))).toBe(true);
    // Nobody's without the office.
    expect(formedMenYear(friarAt('none', 'novitiate')).religious!.formed).toBeUndefined();
  });

  it('a man he formed votes warmer in the chapter and answers the @formed_man selector', () => {
    const s = withStage(appointed(friarAt('vote', 'novitiate'), 'novice_master'), 'vows:novice');
    const y = formedMenYear(s);
    const house = currentHouse(y)!;
    const formed = formedMenOf(y)[0]!;
    const voter = electorsOf(y, 'house', house.id).find((v) => v.id === formed.npcId);
    if (voter) expect(voter.relationshipWithPlayer).toBe(Math.min(100, y.npcs[formed.npcId]!.relationship + FORMED.voteWarmth));
    expect(resolveSelector(y, '@formed_man')?.tags).toContain(FORMED.tag);
    expect(resolveSelector(s, '@formed_man')).toBeNull();
  });
});

describe('the offices, each with scenes of its own', () => {
  it('every house office has scenes gated on the prior having named him, and the formation offices on the men made his', () => {
    const mine = eventFiles['./events/religious/shared_offices.json']!.events;
    const ho = mine.filter((e) => e.id.startsWith('ho_'));
    const ao = mine.filter((e) => e.id.startsWith('ao_'));
    expect(ho.length).toBeGreaterThanOrEqual(13);
    expect(ao.length).toBeGreaterThanOrEqual(8);
    for (const e of ho) expect(JSON.stringify(e.requires), e.id).toMatch(/house_office:/);
    const covered = new Set(ho.flatMap((e) => JSON.stringify(e.requires).match(/house_office:[a-z_]+/g) ?? []));
    for (const id of ['procurator', 'sacristan', 'infirmarian', 'guest_master', 'librarian', 'cantor', 'local_vocations']) expect(covered.has(`house_office:${id}`), id).toBe(true);
    const s = friarAt('scenes', 'priory');
    const named = askHouseOffice(s, 'procurator', createRng('ask')).state;
    if (named.religious!.houseOffice?.id === 'procurator') {
      expect(fits('ho_procurator_the_bill', named)).toBe(true);
      expect(fits('ho_sacristan_the_triduum', named)).toBe(false);
    }
    expect(fits('ho_procurator_the_bill', { ...s, flags: { ...s.flags, 'house_office:procurator': 1 } })).toBe(true);
    expect(fits('ho_procurator_the_bill', s)).toBe(false);
    // The novice master's scenes need a man he formed: the flag alone, without the man for the selector, is not enough.
    const master = withStage(appointed(friarAt('master', 'novitiate'), 'novice_master'), 'vows:novice');
    expect(fits('ao_novice_master_the_one_who_should_go', master)).toBe(false);
    expect(fits('ao_novice_master_the_one_who_should_go', { ...master, flags: { ...master.flags, 'formed:any': true } })).toBe(false);
    expect(fits('ao_novice_master_the_one_who_should_go', formedMenYear(master))).toBe(true);
    const osa = withStage(appointed(friarAt('osa', 'novitiate', 'OSA'), 'novice_director'), 'vows:novice');
    expect(fits('ao_novice_master_the_one_who_should_go', formedMenYear(osa))).toBe(true);
  });
});
