import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById, offersForPhase } from '@/content/offers';
import { eventById, eventsForPhase } from '@/content';
import { studyProgram } from '@/content/study';
import { applyEffects } from '@/engine/effects';
import { evaluateCondition } from '@/engine/conditions';
import { resolvePending, studyWeekHook } from '@/engine/weekHook';
import { endStudy } from '@/engine/study';
import { bookLine, bookPhrase, setStudyActivity, studyActivitiesFor, studyWeek } from '@/systems/studyWeek';
import { describeUnmet } from '@/systems/doors';
import { buildSave, deserialize, serialize } from '@/engine/save';
import type { GameState } from '@/types';
import { acceptAndGo } from '../helpers/appointment';

/** A priest three years in, asked for by the hospital, gone. */
function chaplain(seed: string): GameState {
  const base = parishState(seed);
  const c = base.character!;
  const s: GameState = {
    ...base,
    character: { ...c, stats: { ...c.stats, charisma: 60, theology: 60, piety: 60 }, reputation: { ...c.reputation, chancery: 40 } },
    offers: [{ offerId: 'pv_hospital_chaplain', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }],
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3, 'summer:hospital': true },
  };
  return acceptAndGo(s, offerById('pv_hospital_chaplain')!, createRng(`go-${seed}`)).state;
}

const deps = { pool: eventsForPhase('study'), lookup: eventById, offers: offersForPhase('study'), offerLookup: offerById };

describe('the hospital chaplaincy', () => {
  it('has a fourth dial, a book, and a fuller week; the second chaplain waits on the ministry', () => {
    const s = chaplain('hos');
    expect(s.study!.city).toBe('hospital');
    const program = studyProgram('hospital_chaplain')!;
    expect(program.place!.dials.map((d) => d.id)).toEqual(['wards', 'staff', 'families', 'ministry']);
    expect(program.place!.book!.map((b) => b.id)).toEqual(['anointed', 'attended', 'baptized', 'received', 'confessions', 'masses']);
    expect(s.study!.place).toEqual({ wards: 0, staff: 0, families: 0, ministry: 0 });
    const avail = studyActivitiesFor(s);
    const ids = avail.map((a) => a.def.id);
    for (const id of ['wards', 'night_pager', 'hospital_chapel', 'hospital_sunday_mass', 'ward_confessions', 'icu_er', 'bedside_instruction', 'hospice_rounds', 'volunteer_corps', 'chaplains_office', 'second_chaplain']) expect(ids, id).toContain(id);
    // The Spanish Mass needs the language; the second chaplain needs a ministry to run.
    expect(avail.find((a) => a.def.id === 'hospital_spanish_mass')!.available).toBe(false);
    const second = avail.find((a) => a.def.id === 'second_chaplain')!;
    expect(second.available).toBe(false);
    expect(second.why).toMatch(/the chaplaincy/);
    expect(() => setStudyActivity(s, 'second_chaplain', 1)).toThrow(/chaplaincy/);
    const grown: GameState = { ...s, study: { ...s.study!, place: { ...s.study!.place!, ministry: 40 } } };
    expect(studyActivitiesFor(grown).find((a) => a.def.id === 'second_chaplain')!.available).toBe(true);
    const spanish: GameState = { ...s, character: { ...s.character!, credentials: [...s.character!.credentials, 'spanish'] } };
    expect(studyActivitiesFor(spanish).find((a) => a.def.id === 'hospital_spanish_mass')!.available).toBe(true);
  });

  it('the hours fill the book and move the ministry, deterministically, and the digest counts the week', () => {
    let s = chaplain('book');
    s = setStudyActivity(s, 'wards', 2);
    s = setStudyActivity(s, 'ward_confessions', 2);
    s = setStudyActivity(s, 'volunteer_corps', 2);
    let a: GameState = s;
    let b: GameState = s;
    let sawLine = false;
    for (let i = 0; i < 26; i++) {
      const ra = studyWeek(a, createRng(`w-${i}`));
      a = { ...ra.state, clock: { ...ra.state.clock, week: ra.state.clock.week + 1 } };
      if (/In the book this week: /.test(ra.line)) sawLine = true;
      b = { ...studyWeek(b, createRng(`w-${i}`)).state, clock: { ...b.clock, week: b.clock.week + 1 } };
    }
    expect(a.study!.record).toEqual(b.study!.record);
    expect(a.study!.record!.confessions).toBeGreaterThan(100);
    expect(a.study!.record!.anointed).toBeGreaterThan(40);
    expect(a.study!.record!.baptized ?? 0).toBe(0);
    expect(a.study!.place!.ministry).toBeCloseTo(26, 5);
    expect(a.flags['hospital:volunteers']).toBe(true);
    expect(sawLine).toBe(true);
    expect(bookLine(a)).toMatch(/^The book: anointed \d+, deaths attended \d+, (received into the Church \d+, )?confessions heard \d+\.$/);
    expect(bookPhrase({ baptized: 2 }, studyProgram('hospital_chaplain')!.place!.book!)).toBe('baptized at the bedside 2');
    // The record survives a save and comes back equal.
    const back = deserialize(serialize(buildSave(a, createRng(a.seed), null, {})));
    expect(back.state.study!.record).toEqual(a.study!.record);
  });

  it('authored scenes move the dials and count in the book, and read them back', () => {
    const s = chaplain('fx');
    const after = applyEffects(s, [
      { target: 'place', key: 'ministry', delta: 12 },
      { target: 'place', key: 'wards', delta: -150 },
      { target: 'record', key: 'baptized', delta: 1 },
      { target: 'record', key: 'received', delta: 1 },
      { target: 'record', key: 'anointed', delta: -3 },
    ]);
    expect(after.study!.place).toMatchObject({ ministry: 12, wards: -100 });
    expect(after.study!.record).toEqual({ baptized: 1, received: 1, anointed: 0 });
    expect(evaluateCondition({ type: 'place', key: 'ministry', op: '>=', value: 10 }, after)).toBe(true);
    expect(evaluateCondition({ type: 'place', key: 'ministry', op: '>=', value: 10 }, s)).toBe(false);
    expect(evaluateCondition({ type: 'record', key: 'baptized', op: '>=', value: 1 }, after)).toBe(true);
    expect(evaluateCondition({ type: 'record', key: 'anointed', op: '>=', value: 100 }, after)).toBe(false);
    expect(describeUnmet({ type: 'record', key: 'anointed', op: '>=', value: 100 }, after)).toBe('100 in the book: anointed');
    // Outside a posting, nothing happens and nothing is true.
    const home = parishState('home');
    expect(applyEffects(home, [{ target: 'place', key: 'ministry', delta: 5 }, { target: 'record', key: 'anointed', delta: 5 }])).toEqual(home);
    expect(evaluateCondition({ type: 'place', key: 'ministry', op: '<=', value: 0 }, home)).toBe(false);
  });

  it('the hospital pool is deep, its gated scenes open as the ministry grows, and the book goes into the file when the years end', () => {
    const s = chaplain('pool');
    const pool = eventsForPhase('study').filter((e) => e.id.startsWith('po_hos_'));
    expect(pool.length).toBeGreaterThanOrEqual(23);
    const deacon = eventById('po_hos_deacon')!;
    expect(deacon.requires!.every((c) => evaluateCondition(c, s))).toBe(false);
    const grown: GameState = { ...s, study: { ...s.study!, place: { ...s.study!.place!, ministry: 20 } } };
    expect(deacon.requires!.every((c) => evaluateCondition(c, grown))).toBe(true);
    const hired = applyEffects(grown, deacon.choices[0]!.effects);
    expect(hired.flags['hospital:second_chaplain']).toBe(true);
    expect(hired.study!.place!.ministry).toBe(38);
    expect(deacon.requires!.every((c) => evaluateCondition(c, hired))).toBe(false);
    const forty = eventById('po_hos_forty_names')!;
    expect(forty.requires!.every((c) => evaluateCondition(c, hired))).toBe(false);
    expect(forty.requires!.every((c) => evaluateCondition(c, { ...hired, flags: { ...hired.flags, 'hospital:volunteers': true } }))).toBe(true);
    // The bishop's book asks for a hundred anointings.
    const bishop = eventById('po_hos_bishop_walks')!;
    expect(bishop.choices[0]!.requires).toEqual([{ type: 'record', key: 'anointed', op: '>=', value: 100 }]);
    // The years end with the book in the career note.
    const counted: GameState = { ...hired, study: { ...hired.study!, record: { anointed: 212, attended: 140, baptized: 3, received: 5, confessions: 900, masses: 300 }, endWeek: hired.clock.week } };
    const done = endStudy(counted, offerById('pv_hospital_chaplain')!, createRng('end'));
    const note = done.career.find((c) => /years as hospital chaplain/.test(c.text))!;
    expect(note.text).toMatch(/The book: anointed 212, deaths attended 140, baptized at the bedside 3, received into the Church 5, confessions heard 900, masses said 300\./);
  });

  it('a hospital week through the hook keeps the book and can fire a hospital scene', () => {
    let s = chaplain('hook');
    s = setStudyActivity(s, 'wards', 3);
    s = setStudyActivity(s, 'icu_er', 2);
    s = setStudyActivity(s, 'hospital_sunday_mass', 1);
    const hook = studyWeekHook(deps);
    let fired = 0;
    for (let i = 0; i < 80 && s.study; i++) {
      s = hook(s, createRng(`h-${i}`), []);
      while (s.pending.length) {
        const p = s.pending[0]!;
        const ev = eventById(p.eventId)!;
        // Only the hospital's own scenes, or scenes of no posting at all, may reach a chaplain.
        expect(ev.id.startsWith('po_hos_') || !ev.requires?.some((c) => c.type === 'flag' && c.key.startsWith('study:'))).toBe(true);
        if (ev.id.startsWith('po_hos_')) fired++;
        const choice = ev.choices.find((c) => c.default && !c.requires) ?? ev.choices.find((c) => !c.requires) ?? ev.choices[0]!;
        s = resolvePending(s, p, choice.id, createRng(`r-${i}`), deps);
      }
      s = { ...s, mode: { kind: 'clock' }, clock: { ...s.clock, week: s.clock.week + 1 } };
    }
    expect(s.study).not.toBeNull();
    expect(s.study!.record!.anointed).toBeGreaterThan(60);
    expect(s.study!.record!.masses).toBeGreaterThan(30);
    expect(fired).toBeGreaterThan(0);
  });
});
