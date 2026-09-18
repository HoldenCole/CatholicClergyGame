import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { eventById, eventsForPhase } from '@/content';
import { studyProgram } from '@/content/study';
import { applyEffects } from '@/engine/effects';
import { evaluateAll, evaluateCondition } from '@/engine/conditions';
import { applyInternalForum, InternalForumError } from '@/engine/internalForum';
import { CITY_WORD, endStudy } from '@/engine/study';
import { setStudyActivity, studyActivitiesFor, studyWeek } from '@/systems/studyWeek';
import { MINISTRY } from '@/systems/ministry';
import { REQUESTABLE_POSTS } from '@/systems/request';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { sceneById } from '@/ui/scenes/scenes';
import type { GameState, StudyCity } from '@/types';
import { acceptAndGo } from '../helpers/appointment';

/** DESIGN §7.7: the five posts beside the ladder, each a full posting. */
const POSTS: { offer: string; program: string; city: StudyCity; flag: string; dials: string[]; book: string[]; activities: string[]; scenes: string[] }[] = [
  { offer: 'pa_penitentiary_chaplain', program: 'penitentiary_chaplain', city: 'prison', flag: 'chaplain:penitentiary', dials: ['tiers', 'administration', 'chapel', 'outside'], book: ['confessions', 'baptized', 'received', 'masses', 'walked', 'attended'], activities: ['tiers', 'prison_mass', 'prison_confessions', 'warden', 'death_row', 'gate'], scenes: ['sp_pri_grille', 'sp_pri_walk', 'sp_pri_last_corridor'] },
  { offer: 'pv_mission_loan', program: 'mission_loan', city: 'mission', flag: 'mission:loaned', dials: ['stations', 'language', 'people', 'house'], book: ['masses', 'baptized', 'buried', 'miles', 'confessions'], activities: ['stations', 'mission_language', 'mission_road', 'mission_sacraments', 'mission_house', 'mission_letters'], scenes: ['sp_mis_grandmother', 'sp_mis_backlog', 'sp_mis_river'] },
  { offer: 'pv_deployment', program: 'deployment', city: 'deployment', flag: 'deployed', dials: ['unit', 'command', 'chapel'], book: ['masses', 'confessions', 'attended', 'letters', 'anointed'], activities: ['field_mass', 'flight_line', 'command_tent', 'the_sergeants', 'casualty', 'letters_home'], scenes: ['sp_dep_hood', 'sp_dep_sergeants', 'sp_dep_casualty'] },
  { offer: 'pa_seminary_director', program: 'seminary_director', city: 'formation', flag: 'seminary:director', dials: ['men', 'rector', 'house'], book: ['hours', 'retreats', 'stayed'], activities: ['direction_hours', 'house_chapel', 'the_corridor', 'rector_counsel', 'director_retreats', 'the_one_who_knocks'], scenes: ['sp_for_hour', 'sp_for_rector_asks', 'sp_for_knock'] },
  { offer: 'pa_schools_superintendent', program: 'schools_superintendent', city: 'schools', flag: 'schools:superintendent', dials: ['schools', 'board', 'enrolment', 'teachers'], book: ['saved', 'closed', 'principals', 'opened'], activities: ['principals', 'school_board', 'enrolment', 'the_school_to_close', 'teachers_pay', 'school_visits'], scenes: ['sp_sch_close', 'sp_sch_pay', 'sp_sch_principal'] },
];

/** A pastor of fifteen years who could be asked for any of the five, and is. */
function ready(seed: string): GameState {
  const base = parishState(seed);
  const c = base.character!;
  return {
    ...base,
    character: { ...c, stats: { ...c.stats, piety: 70, administration: 70, charisma: 60 }, reputation: { ...c.reputation, chancery: 50 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 15, 'chaplain:military': true, 'direction:chosen': true, 'chaplain:prison': true, 'summer:mission': true, 'career:teacher': true },
  };
}

function posted(seed: string, offerId: string): GameState {
  const s = ready(seed);
  const withOffer: GameState = { ...s, offers: [{ offerId, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 6, bindings: {} }] };
  return acceptAndGo(withOffer, offerById(offerId)!, createRng(`go-${seed}`)).state;
}

describe('the special assignments (DESIGN §7.7)', () => {
  it('each is a program with its own dials and book, offered with the commitment away to it, and asked for by letter except the deployment', () => {
    for (const p of POSTS) {
      const program = studyProgram(p.program)!;
      expect(program, p.program).toBeDefined();
      expect(program.kind).toBe('post');
      expect(program.city).toBe(p.city);
      expect(program.place!.dials.map((d) => d.id)).toEqual(p.dials);
      expect(program.place!.book!.map((b) => b.id)).toEqual(p.book);
      const offer = offerById(p.offer)!;
      expect(offer.accept.commitment!.away).toBe(p.program);
      expect(MINISTRY.posts[p.program], p.program).toBeDefined();
      expect(CITY_WORD[p.city]).toBeTruthy();
      expect(sceneById('study_city', p.city).hotspots.filter((h) => h.binds.kind === 'study_action').map((h) => (h.binds as { activityId: string }).activityId)).toEqual(p.activities.slice(0, 5));
    }
    expect(REQUESTABLE_POSTS).toEqual(expect.arrayContaining(['pa_penitentiary_chaplain', 'pv_mission_loan', 'pa_seminary_director', 'pa_schools_superintendent']));
    expect(REQUESTABLE_POSTS).not.toContain('pv_deployment');
  });

  it('the offers are gated on who the man is: the deployment needs the commission, the director a director of his own', () => {
    const s = ready('gate');
    for (const p of POSTS) expect(evaluateAll(offerById(p.offer)!.requires, s), p.offer).toBe(true);
    const civilian = { ...s, flags: { ...s.flags, 'chaplain:military': false } };
    expect(evaluateAll(offerById('pv_deployment')!.requires, civilian)).toBe(false);
    const undirected = { ...s, flags: { ...s.flags, 'direction:chosen': false } };
    expect(evaluateAll(offerById('pa_seminary_director')!.requires, undirected)).toBe(false);
    const clerk = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, administration: 40 } } };
    expect(evaluateAll(offerById('pa_schools_superintendent')!.requires, clerk)).toBe(false);
  });

  it('saying yes moves the man into the post: the city, the flag, the dials at zero, the six ways to spend the week, and the scenes gated on it', () => {
    for (const p of POSTS) {
      const s = posted(`post-${p.city}`, p.offer);
      expect(s.phase, p.offer).toBe('study');
      expect(s.study!.city).toBe(p.city);
      expect(s.flags[`study:${p.city}`]).toBe(true);
      expect(s.flags[p.flag]).toBe(true);
      expect(s.study!.place).toEqual(Object.fromEntries(p.dials.map((d) => [d, 0])));
      const ids = studyActivitiesFor(s).map((a) => a.def.id);
      for (const id of p.activities) expect(ids, `${p.city} › ${id}`).toContain(id);
      // Every scene of the post is in the study pool and needs this post; no other post's scene fires here.
      for (const id of p.scenes) {
        const ev = eventById(id)!;
        expect(ev.phase).toBe('study');
        expect(ev.requires!.some((c) => c.type === 'flag' && c.key === `study:${p.city}`), id).toBe(true);
      }
      for (const other of POSTS.filter((o) => o !== p)) {
        for (const id of other.scenes) expect(evaluateAll(eventById(id)!.requires!.filter((c) => c.type === 'flag'), s), `${id} in ${p.city}`).toBe(false);
      }
    }
  });

  it('the hours fill the book deterministically, and a scene writes the dials and the book by their own ids', () => {
    let s = posted('book', 'pa_penitentiary_chaplain');
    s = setStudyActivity(s, 'tiers', 2);
    s = setStudyActivity(s, 'prison_confessions', 2);
    let a: GameState = s;
    let b: GameState = s;
    for (let i = 0; i < 20; i++) {
      a = { ...studyWeek(a, createRng(`w-${i}`)).state, clock: { ...a.clock, week: a.clock.week + 1 } };
      b = { ...studyWeek(b, createRng(`w-${i}`)).state, clock: { ...b.clock, week: b.clock.week + 1 } };
    }
    expect(a.study!.record).toEqual(b.study!.record);
    expect(a.study!.record!.confessions).toBeGreaterThan(0);
    expect(a.study!.place!.tiers).toBeGreaterThan(0);
    // The last corridor waits on the tiers, then counts a death attended and moves the administration.
    const corridor = eventById('sp_pri_last_corridor')!;
    const fresh = posted('corridor', 'pa_penitentiary_chaplain');
    expect(corridor.requires!.every((c) => evaluateCondition(c, fresh))).toBe(false);
    const known: GameState = { ...fresh, study: { ...fresh.study!, place: { ...fresh.study!.place!, tiers: 20 } } };
    expect(corridor.requires!.every((c) => evaluateCondition(c, known))).toBe(true);
    const stood = applyEffects(known, corridor.choices[0]!.effects);
    expect(stood.study!.record!.attended).toBe(1);
    expect(stood.study!.place!.tiers).toBe(32);
    expect(stood.strain).toBeGreaterThan(known.strain ?? 0);
    // The missions' backlog counts in the man's own book as well as the post's.
    const mission = posted('backlog', 'pv_mission_loan');
    const forty = applyEffects(mission, eventById('sp_mis_backlog')!.choices[0]!.effects);
    expect(forty.study!.record!.baptized).toBe(41);
    expect((forty.ministry?.baptisms ?? 0) - (mission.ministry?.baptisms ?? 0)).toBe(41);
    // Every dial and book key a scene writes belongs to its post.
    for (const p of POSTS) {
      for (const id of p.scenes) {
        for (const ch of eventById(id)!.choices) {
          for (const e of ch.effects) {
            if (e.target === 'place') expect(p.dials, `${id} › ${ch.id} › ${e.key}`).toContain(e.key);
            if (e.target === 'record') expect(p.book, `${id} › ${ch.id} › ${e.key}`).toContain(e.key);
          }
          for (const c of [...(eventById(id)!.requires ?? []), ...(ch.requires ?? [])]) {
            if (c.type === 'place') expect(p.dials, `${id} › ${c.key}`).toContain(c.key);
            if (c.type === 'record') expect(p.book, `${id} › ${c.key}`).toContain(c.key);
          }
        }
      }
    }
  });

  it("the director's hours are sealed: they write stat and flag only, and the resolver throws on anything else", () => {
    const s = posted('seal', 'pa_seminary_director');
    for (const id of ['sp_for_hour', 'sp_for_knock']) {
      const ev = eventById(id)!;
      expect(ev.internalForum, id).toBe(true);
      for (const ch of ev.choices) {
        const after = applyInternalForum(s, ch.effects, {}, ev.title);
        expect(after.character!.reputation).toEqual(s.character!.reputation);
        expect(after.study!.place).toEqual(s.study!.place);
        expect(after.study!.record ?? {}).toEqual(s.study!.record ?? {});
      }
    }
    expect(() => applyInternalForum(s, [{ target: 'place', key: 'men', delta: 5 }], {}, 'The Man Who Has Not Prayed')).toThrow(InternalForumError);
    expect(() => applyInternalForum(s, [{ target: 'record', key: 'hours', delta: 1 }], {}, 'The Man Who Has Not Prayed')).toThrow(InternalForumError);
    // The rector's question at table is not sealed, and moves the house.
    const asks = eventById('sp_for_rector_asks')!;
    expect(asks.internalForum).toBeFalsy();
    const refused = applyEffects(s, asks.choices[0]!.effects);
    expect(refused.study!.place!.rector).toBe(-6);
    expect(refused.study!.place!.men).toBe(10);
  });

  it('a post survives save and load mid-commitment, and the book goes into the file when the years end', () => {
    let s = posted('save', 'pa_schools_superintendent');
    s = setStudyActivity(s, 'principals', 2);
    s = { ...studyWeek(s, createRng('w')).state, clock: { ...s.clock, week: s.clock.week + 1 } };
    const back = deserialize(serialize(buildSave(s, createRng(s.seed), null, {}))).state;
    expect(back.study).toEqual(s.study);
    expect(back.commitments).toEqual(s.commitments);
    const counted: GameState = { ...s, study: { ...s.study!, record: { saved: 1, closed: 2, principals: 11, opened: 0 }, endWeek: s.clock.week } };
    const done = endStudy(counted, offerById('pa_schools_superintendent')!, createRng('end'));
    expect(done.study).toBeNull();
    expect(done.flags['study:schools']).toBeUndefined();
    expect(done.career.some((c) => /schools kept open 1, schools closed 2, principals appointed 11/.test(c.text))).toBe(true);
    const pool = eventsForPhase('study').filter((e) => e.id.startsWith('sp_'));
    expect(pool.length).toBe(15);
  });
});
