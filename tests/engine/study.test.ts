import { describe, it, expect } from 'vitest';
import { parishState } from '../systems/week.test';
import { createRng } from '@/engine/rng';
import { acceptOffer, offersWeek } from '@/engine/offers';
import { offerById, offersForPhase } from '@/content/offers';
import { eventById, eventsForPhase } from '@/content';
import { studyWeekHook } from '@/engine/weekHook';
import { setStudyActivity, studyActivitiesFor, studyWeek } from '@/systems/studyWeek';
import { startAssignment } from '@/engine/parish';
import { acceptAssignment } from '@/engine/seminary';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { renderText } from '@/engine/text';
import { hoursOf, planWeek, weekBudget } from '@/systems/week';
import type { GameState } from '@/types';

function withRomeOffer(seed: string, theology = 70): GameState {
  const s = parishState(seed);
  const c = s.character!;
  return {
    ...s,
    character: { ...c, stats: { ...c.stats, theology, knowledge: 60 }, reputation: { ...c.reputation, chancery: 40 } },
    offers: [{ offerId: 'pv_rome_study', arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 6, bindings: {} }],
    // rome_track lets the rector's word carry a man the stats would not; the wash-out test needs it.
    flags: { ...s.flags, ordination_week: s.clock.week - 52 * 3, rome_track: true },
  };
}

const deps = { pool: eventsForPhase('study'), lookup: eventById, offers: offersForPhase('study'), offerLookup: offerById };

describe('study away', () => {
  it('accepting Rome moves the man out of the parish and into the study phase', () => {
    const s = withRomeOffer('rome');
    const from = s.parish!.parishId;
    const r = acceptOffer(s, offerById('pv_rome_study')!, createRng('accept'));
    const next = r.state;
    expect(next.phase).toBe('study');
    expect(next.parish).toBeNull();
    expect(next.assignment).toBeNull();
    expect(next.commitments).toEqual([]);
    expect(next.study).toMatchObject({ offerId: 'pv_rome_study', program: 'rome_stl', city: 'rome', school: 'the Gregorian', fromParishId: from, failed: false });
    expect(next.study!.endWeek - next.study!.startWeek).toBe(156);
    expect(next.flags['study:rome']).toBe(true);
    expect(next.flags['role:parochial_vicar']).toBeUndefined();
    expect(next.beats.some((b) => b.kind === 'assignment' && b.week === next.study!.endWeek)).toBe(true);
    expect(next.career[next.career.length - 1]!.text).toMatch(/Left for Rome/);
    expect(renderText('{school} in {city}, at {residence}', next)).toBe('the Gregorian in Rome, at the North American College');
  });

  it('the hours build what they say, a language becomes a credential, and the Curia is gated', () => {
    let s = acceptOffer(withRomeOffer('hours'), offerById('pv_rome_study')!, createRng('accept')).state;
    const avail = studyActivitiesFor(s);
    expect(avail.map((a) => a.def.id)).toContain('confessions');
    expect(avail.map((a) => a.def.id)).not.toContain('shrine_confessions');
    const curia = avail.find((a) => a.def.id === 'curia')!;
    const cold: GameState = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, chancery: 0 } } };
    expect(studyActivitiesFor(cold).find((a) => a.def.id === 'curia')!.available).toBe(false);
    expect(() => setStudyActivity(cold, 'curia', 1)).toThrow(/chancery/);
    expect(curia.available).toBe(true);
    s = setStudyActivity(s, 'thesis', 3);
    s = setStudyActivity(s, 'italian', 2);
    s = setStudyActivity(s, 'curia', 1);
    expect(() => setStudyActivity(s, 'hospital', 2)).not.toThrow();
    expect(Object.values(setStudyActivity(s, 'hospital', 2).study!.routine).reduce((a, b) => a + b, 0)).toBe(6);
    const before = s.character!.stats;
    for (let i = 0; i < 25; i++) s = studyWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`sw:${i}`)).state;
    expect(s.character!.stats.theology).toBeGreaterThan(before.theology + 2);
    expect(s.character!.credentials).toContain('italian');
    expect(s.flags.speaks_italian).toBe(true);
    expect(s.flags.worked_at_the_holy_see).toBe(true);
    expect(s.character!.reputation.rome).toBeGreaterThan(withRomeOffer('hours').character!.reputation.rome);
    const line = studyWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng('line')).line;
    expect(line).toMatch(/Lectures at the Gregorian/);
  });

  it('when the years are up he graduates and the board sends him somewhere', () => {
    let s = acceptOffer(withRomeOffer('grad'), offerById('pv_rome_study')!, createRng('accept')).state;
    const hook = studyWeekHook(deps);
    s = { ...s, clock: { ...s.clock, week: s.study!.endWeek } };
    const home = hook(s, createRng('end'), []);
    expect(home.study).toBeNull();
    expect(home.character!.credentials).toContain('STL');
    expect(home.flags.rome_alumnus).toBe(true);
    expect(home.mode.kind).toBe('assignment');
    expect(home.assignment).not.toBeNull();
    expect(home.offerHistory.some((h) => h.offerId === 'pv_rome_study' && h.decision === 'completed')).toBe(true);
    expect(home.digest[home.digest.length - 1]!.lines.join(' ')).toMatch(/plane home/);
    const started = startAssignment(acceptAssignment(home), createRng('start'));
    expect(started.phase).toBe(started.assignment!.role);
    expect(started.parish).not.toBeNull();
  });

  it('a man sent underqualified may wash out, and comes home without the degree', () => {
    const def = offerById('pv_rome_study')!;
    let washed: GameState | null = null;
    for (let i = 0; i < 40 && !washed; i++) {
      const r = acceptOffer(withRomeOffer(`wash-${i}`, 30), def, createRng(`wash:${i}`));
      if (r.failed) washed = r.state;
    }
    expect(washed).not.toBeNull();
    expect(washed!.study!.failed).toBe(true);
    const home = studyWeekHook(deps)({ ...washed!, clock: { ...washed!.clock, week: washed!.study!.endWeek } }, createRng('end'), []);
    expect(home.character!.credentials).not.toContain('STL');
    expect(home.offerHistory.some((h) => h.offerId === 'pv_rome_study' && h.decision === 'failed')).toBe(true);
    expect(home.career.some((e) => /without the degree/.test(e.text))).toBe(true);
    expect(home.mode.kind).toBe('assignment');
  });

  it('the study state survives a save, and a v3 save loads with none', () => {
    const s = acceptOffer(withRomeOffer('save'), offerById('pv_rome_study')!, createRng('accept')).state;
    const rng = createRng(s.seed);
    const back = deserialize(serialize(buildSave(s, rng, null, {})));
    expect(back.state.study).toEqual(s.study);
    const v3 = JSON.parse(serialize(buildSave({ ...s, study: null, phase: 'parochial_vicar' }, rng, null, {})));
    delete v3.state.study;
    v3.version = 3;
    expect(deserialize(JSON.stringify(v3)).state.study).toBeNull();
  });
});

describe('jobs and the week', () => {
  it("the bishop's secretary is a posting: he moves into the residence and the board has a parish for him after", () => {
    const base = parishState('sec');
    const c = base.character!;
    const bishopId = base.world!.diocese.hidden.bishop.npcId;
    const s: GameState = {
      ...base,
      character: { ...c, reputation: { ...c.reputation, chancery: 40 } },
      npcs: { ...base.npcs, [bishopId]: { ...base.npcs[bishopId]!, relationship: 40 } },
      offers: [{ offerId: 'pv_bishops_secretary', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }],
      flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3 },
    };
    const away = acceptOffer(s, offerById('pv_bishops_secretary')!, createRng('sec')).state;
    expect(away.phase).toBe('study');
    expect(away.parish).toBeNull();
    expect(away.study).toMatchObject({ city: 'residence', program: 'bishops_secretary' });
    expect(away.flags['office:bishops_secretary']).toBe(true);
    expect(away.career[away.career.length - 1]!.text).toMatch(/Moved into the bishop's residence/);
    const ids = studyActivitiesFor(away).map((a) => a.def.id);
    expect(ids).toEqual(expect.arrayContaining(['calendar', 'driving', 'mc', 'residence_chapel', 'phone', 'weekend_supply']));
    expect(ids).not.toContain('thesis');
    let w = setStudyActivity(away, 'driving', 2);
    const rel = w.npcs[bishopId]!.relationship;
    w = studyWeek({ ...w, clock: { ...w.clock, week: w.clock.week + 1 } }, createRng('sw')).state;
    expect(w.npcs[bishopId]!.relationship).toBeGreaterThan(rel);
    expect(w.flags.knows_the_bishops_car).toBe(true);
    const home = studyWeekHook(deps)({ ...w, clock: { ...w.clock, week: w.study!.endWeek } }, createRng('end'), []);
    expect(home.study).toBeNull();
    expect(home.mode.kind).toBe('assignment');
    expect(home.character!.traits.some((t) => /how the bishop thinks/.test(t))).toBe(true);
  });

  it('a job alongside the parish does something every week it is held', () => {
    const base = parishState('job');
    const def = offerById('pv_communications')!;
    const s: GameState = {
      ...base,
      character: { ...base.character!, stats: { ...base.character!.stats, charisma: 65 }, reputation: { ...base.character!.reputation, chancery: 40 } },
      offers: [{ offerId: def.id, arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }],
      flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3 },
    };
    const held = acceptOffer(s, def, createRng('job')).state;
    expect(held.commitments.length).toBe(1);
    expect(def.accept.commitment!.weekly!.length).toBeGreaterThan(0);
    const before = held.character!.reputation.public;
    const after = offersWeek({ ...held, clock: { ...held.clock, week: held.clock.week + 1 } }, createRng('ow'), offersForPhase('parochial_vicar'), offerById);
    expect(after.character!.reputation.public).toBeGreaterThan(before);
    // Every commitment in the parish pool that keeps the parish has a weekly effect, so no job is inert.
    for (const o of offersForPhase('parochial_vicar')) {
      const cm = o.accept.commitment;
      if (cm && !cm.away) expect(cm.weekly?.length ?? 0, o.id).toBeGreaterThan(0);
    }
  });

  it('the week is twelve blocks of four hours, and a sacrifice adds a block', () => {
    const s = parishState('hours');
    expect(weekBudget(s)).toBe(12);
    expect(hoursOf(weekBudget(s))).toBe(48);
    const cut: GameState = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, sacrifices: ['sleep'] } } };
    expect(hoursOf(weekBudget(cut))).toBe(52);
    // The routine asks for what it asks for; the extra block shows up as room to spend.
    expect(planWeek(cut).slack).toBe(planWeek(s).slack + 1);
  });
});
