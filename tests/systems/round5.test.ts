import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState, testNpc } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { runClock } from '@/engine/clock';
import { parishWeekHook, type EventDeps } from '@/engine/weekHook';
import { careerYear } from '@/engine/career';
import { acceptOffer } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { yearInReview, deliverLetter, openMail, readLetter } from '@/systems/review';
import { whyOffered } from '@/systems/doors';
import { publicRecord, readingOf } from '@/systems/record';
import { classmateLines, classmatePost } from '@/systems/classmates';
import { bishopLetter, circlesOf, revalue } from '@/systems/succession';
import { TALKS, bandOf, haveAWord, mayTalk, whoIs } from '@/systems/talks';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { talkDefs } from '@/content/parish';
import type { GameState, LiturgicalPolicy } from '@/types';

const noDeps: EventDeps = { pool: [], lookup: () => undefined };

describe('the year in review', () => {
  it('writes a letter on the anniversary that names the parish, the constituencies, and what is ahead', () => {
    let s = parishState('review');
    s = { ...s, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 3 } };
    const { letter, baseline } = yearInReview(s);
    expect(letter.sort).toBe('review');
    expect(letter.title).toMatch(/3 years ordained/);
    expect(letter.body.join(' ')).toMatch(/The people: /);
    expect(letter.body.join(' ')).toMatch(/Ahead: /);
    expect(baseline.week).toBe(s.clock.week);
    const later: GameState = { ...s, reviewBaseline: { ...baseline, reputation: { ...baseline.reputation, parishioners: baseline.reputation.parishioners! - 20 } } };
    expect(yearInReview(later).letter.body.join(' ')).toMatch(/The people: [a-z ]+, (much )?warmer/);
  });

  it('is posted by the career year and opened at the tail of a quiet week, one letter at a time', () => {
    let s = parishState('review-post');
    s = { ...s, flags: { ...s.flags, ordination_week: s.clock.week - 52 } };
    const after = careerYear(s, createRng('cy'));
    expect(after.mode.kind).toBe('clock');
    expect(after.letterQueue!.map((l) => l.sort)).toContain('review');
    expect(after.letters!.length).toBe(after.letterQueue!.length);
    // Only the review is waiting for this test's purposes.
    const review = after.letterQueue!.find((l) => l.sort === 'review')!;
    const after1: GameState = { ...after, letterQueue: [review], letters: [review] };
    const queued = deliverLetter(after1, { sort: 'bishop', title: 'Second', body: ['x'], week: 1 });
    const opened = openMail(queued);
    expect(opened.mode.kind).toBe('letter');
    if (opened.mode.kind !== 'letter') throw new Error();
    expect(opened.mode.letter.sort).toBe('review');
    const second = readLetter(opened);
    expect(second.mode.kind).toBe('letter');
    if (second.mode.kind !== 'letter') throw new Error();
    expect(second.mode.letter.title).toBe('Second');
    expect(readLetter(second).mode.kind).toBe('clock');
    // Not while something else has the man's attention.
    expect(openMail({ ...queued, mode: { kind: 'assignment', assignment: after.assignment! } }).mode.kind).toBe('assignment');
  });

  it('stops the clock through the hook on the anniversary and never eats the arc end', () => {
    let s: GameState = { ...parishState('review-hook'), speed: 'SKIP' };
    s = { ...s, flags: { ...s.flags, ordination_week: s.clock.week } };
    const rng = createRng('rh');
    const r = runClock(s, rng, { maxWeeks: 60, hook: parishWeekHook(noDeps) });
    expect(r.state.mode.kind).toBe('letter');
    expect(r.state.clock.week).toBe(s.clock.week + 52);
    // Arc end and anniversary on the same week: the board comes first, the letter waits.
    const end = s.parish!.arcEndWeek;
    let t: GameState = { ...s, flags: { ...s.flags, ordination_week: end - 52 * 4 } };
    let letters = 0;
    for (let guard = 0; guard < 40 && (t.mode.kind === 'clock' || t.mode.kind === 'letter'); guard++) {
      t = runClock(t, rng, { maxWeeks: 520, hook: parishWeekHook(noDeps) }).state;
      if (t.mode.kind === 'letter') { letters++; t = readLetter(t); }
    }
    expect(letters).toBeGreaterThanOrEqual(1);
    expect(t.mode.kind).toBe('assignment');
    expect(t.clock.week).toBe(end);
  });
});

describe('offers explained in hindsight', () => {
  it('says what an offer came because of, in words', () => {
    let s = parishState('why');
    const def = offerById('pv_seminary_faculty')!;
    s = { ...s, character: { ...s.character!, stats: { ...s.character!.stats, theology: 70 }, reputation: { ...s.character!.reputation, chancery: 30 } }, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 4 } };
    const why = whyOffered(def, s);
    expect(why).toMatch(/^It came because of /);
    expect(why).toMatch(/theology/);
    expect(why).not.toMatch(/\d/);
  });
});

describe('the public record', () => {
  it('lists stands in words and reads each against the bishop in office', () => {
    let s = parishState('record');
    const bishopAlignment = s.world!.diocese.hidden.bishop.alignment;
    const bishop = { ...s.world!.diocese.hidden.bishop, alignment: bishopAlignment >= 0 ? 40 : -40 };
    s = { ...s, world: { ...s.world!, diocese: { ...s.world!.diocese, hidden: { ...s.world!.diocese.hidden, bishop } } } };
    const c = s.character!;
    s = { ...s, character: { ...c, outspokenness: 25, positions: [
      { topic: 'liturgy', value: -50, volume: 'public', week: 3 },
      { topic: 'immigration', value: 30, volume: 'semi_public', week: 9 },
      { topic: 'money', value: -20, volume: 'private', week: 12 },
    ] } };
    const record = publicRecord(s);
    expect(record.rows).toHaveLength(3);
    expect(record.rows[0]!.topic).toBe('money');
    expect(record.rows[0]!.reading).toBe('unread');
    expect(record.rows[2]!.side).toMatch(/hard for the traditional side/);
    expect(record.rows[2]!.volume).toBe('in public');
    expect(record.standing).toMatch(/a man who has said things/);
    const with_ = record.rows.filter((r) => r.reading === 'with').length;
    const against = record.rows.filter((r) => r.reading === 'against').length;
    expect(with_ + against).toBe(2);
    expect(record.bishopLine).toMatch(/bishop/);
    expect(readingOf({ topic: 'liturgy', value: -50, volume: 'public', week: 3 }, -40)).toBe('with');
    expect(readingOf({ topic: 'liturgy', value: -50, volume: 'public', week: 3 }, 40)).toBe('against');
  });
});

describe('classmates as living careers', () => {
  it('reads each man off his tags and status, and knows who is ahead', () => {
    const s: GameState = { ...seminaryState('class'), phase: 'parochial_vicar' };
    const ids = s.seminary?.classmateIds ?? [];
    expect(ids.length).toBeGreaterThan(0);
    const [a, b, c] = ids;
    const npcs = { ...s.npcs };
    npcs[a!] = { ...npcs[a!]!, tags: [...npcs[a!]!.tags, 'chancery'], title: 'Msgr.', relationship: 50 };
    npcs[b!] = { ...npcs[b!]!, status: 'left', relationship: 0 };
    if (c) npcs[c] = { ...npcs[c]!, tags: [...npcs[c]!.tags, 'pastor'], relationship: -30 };
    const lines = classmateLines({ ...s, npcs });
    expect(lines[0]!.npc.id).toBe(a);
    expect(lines[0]!.post).toMatch(/chancery/);
    expect(lines[0]!.ahead).toBe(true);
    expect(lines[0]!.regard).toBe('a friend');
    expect(lines.find((l) => l.npc.id === b)!.post).toBe('left the priesthood');
    expect(lines[lines.length - 1]!.npc.id).toBe(b);
    expect(classmatePost(testNpc('x', { role: 'classmate', tags: ['bishop_elsewhere'] }))).toMatch(/bishop/);
  });
});

describe('succession as a turn', () => {
  it('reads clubs and affiliations, withdraws leave the new bishop forbids, and writes the letter', () => {
    let s = parishState('succ-turn');
    const c = s.character!;
    s = {
      ...s,
      clubs: { memberships: { priests_tlm: { joinedWeek: 0, weeks: 10, fellows: [] } }, left: {} },
      flags: { ...s.flags, 'affiliation:prog_caucus': true, 'permission:latin_mass': true },
      permissions: { latin_mass: { topic: 'latin_mass', status: 'granted', bishopId: 'old', askedWeek: 1, answerWeek: 5 } },
      character: { ...c, outspokenness: 30, positions: [{ topic: 'liturgy', value: -40, volume: 'public', week: 2 }] },
    };
    const prog = testNpc('nb', { role: 'bishop', alignment: 60, title: 'Bishop' });
    const circles = circlesOf(s, prog);
    expect(circles.map((x) => x.agrees)).toEqual([false, true]);
    const before: LiturgicalPolicy = { ad_orientem: 'free', latin_mass: 'by_permission', altar_rail: 'free', tabernacle: 'by_permission', renovation: 'by_permission' };
    const after: LiturgicalPolicy = { ad_orientem: 'by_permission', latin_mass: 'forbidden', altar_rail: 'forbidden', tabernacle: 'free', renovation: 'by_permission' };
    const r = revalue(s, prog, { before, after });
    expect(r.reread.revoked).toEqual(['latin_mass', 'altar_rail']);
    expect(r.reread.tightened).toEqual(['ad_orientem']);
    expect(r.reread.loosened).toEqual(['tabernacle']);
    expect(r.state.permissions.latin_mass!.status).toBe('denied');
    expect(r.state.flags['permission:latin_mass']).toBe(false);
    expect(r.reread.againstHim).toBe(1);
    // The circle he keeps counts: the same man without it is read a little warmer.
    const plain = revalue({ ...s, clubs: { memberships: {}, left: {} }, flags: { ...s.flags, 'affiliation:prog_caucus': false } }, prog, { before, after });
    expect(r.state.npcs.nb!.relationship).toBeLessThan(plain.state.npcs.nb!.relationship + 1);
    const letter = bishopLetter({ ...r.state, npcs: { ...r.state.npcs, nb: prog } }, prog, r.verdict, r.reread);
    expect(letter.sort).toBe('bishop');
    expect(letter.body.join(' ')).toMatch(/withdrawn/);
    expect(letter.rows!.map((x) => x.label)).toContain('Your circles');
  });

  it('the succession scenes exist and read the bishop against the man', () => {
    for (const id of ['succ_other_side_trad_bishop', 'succ_other_side_prog_bishop', 'succ_affiliated_priest']) {
      const e = eventById(id);
      expect(e, id).toBeDefined();
      expect(e!.beat).toBe('succession');
    }
  });
});

describe('having a word', () => {
  it('knows who each person is and which band they are in', () => {
    const s = parishState('talk-who');
    const p = s.parish!;
    const parish = s.world!.parishes.find((x) => x.id === p.parishId)!;
    const pastor = s.npcs[parish.pastorId];
    if (pastor && pastor.id !== 'player') expect(whoIs(s, pastor)).toBe('pastor');
    const bishop = s.npcs[s.world!.diocese.hidden.bishop.npcId]!;
    expect(whoIs(s, bishop)).toBe('bishop');
    for (const id of p.staffIds) expect(['secretary', 'dre', 'music_director', 'maintenance']).toContain(whoIs(s, s.npcs[id]!));
    expect(bandOf({ ...bishop, relationship: 40 })).toBe('warm');
    expect(bandOf({ ...bishop, relationship: -20 })).toBe('cold');
    expect(bandOf({ ...bishop, relationship: 0 })).toBe('neutral');
    expect(talkDefs.length).toBeGreaterThanOrEqual(42);
    expect(new Set(talkDefs.map((d) => d.who)).size).toBe(14);
  });

  it('plays an exchange, moves the relationship, takes a block, and waits eight weeks before the next', () => {
    const s = parishState('talk');
    const bishopId = s.world!.diocese.hidden.bishop.npcId;
    const before = s.npcs[bishopId]!.relationship;
    expect(mayTalk(s, bishopId).ok).toBe(true);
    const r = haveAWord(s, bishopId, createRng('t1'));
    expect(r.text.length).toBeGreaterThan(40);
    expect(r.text).not.toMatch(/\{@?[a-z_]+\}/);
    expect(r.state.npcs[bishopId]!.relationship).toBeGreaterThan(before);
    expect(r.state.parish!.apNextWeek).toBe(s.parish!.apNextWeek - TALKS.blocks);
    expect(r.state.talks!.log[0]!.npcId).toBe(bishopId);
    expect(r.state.digest[r.state.digest.length - 1]!.lines.some((l) => /A word with/.test(l))).toBe(true);
    const again = mayTalk(r.state, bishopId);
    expect(again.ok).toBe(false);
    expect(again.why).toMatch(/would be noticed/);
    expect(mayTalk({ ...r.state, clock: { ...r.state.clock, week: r.state.clock.week + TALKS.cooldownWeeks } }, bishopId).ok).toBe(true);
    expect(() => haveAWord(r.state, bishopId, createRng('t2'))).toThrow();
    // Deterministic under the seed.
    expect(haveAWord(s, bishopId, createRng('t1')).text).toBe(r.text);
  });
});

describe('the chancery tier', () => {
  it('the vicar general is a posting with the chancery for a city and its own week', () => {
    const base = parishState('vg');
    const c = base.character!;
    const bishopId = base.world!.diocese.hidden.bishop.npcId;
    const s: GameState = {
      ...base,
      phase: 'pastor',
      assignment: { ...base.assignment!, role: 'pastor' },
      character: { ...c, stats: { ...c.stats, administration: 65 }, reputation: { ...c.reputation, chancery: 50 } },
      npcs: { ...base.npcs, [bishopId]: { ...base.npcs[bishopId]!, relationship: 40 } },
      offers: [{ offerId: 'pa_vicar_general', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 3, bindings: {} }],
      flags: { ...base.flags, ordination_week: base.clock.week - 52 * 14 },
    };
    const def = offerById('pa_vicar_general')!;
    expect(def.accept.commitment!.away).toBe('vicar_general');
    const away = acceptOffer(s, def, createRng('vg')).state;
    expect(away.phase).toBe('study');
    expect(away.parish).toBeNull();
    expect(away.study!.city).toBe('chancery');
    expect(away.flags['study:chancery']).toBe(true);
    expect(away.flags['office:vicar_general']).toBe(true);
    const ids = studyActivitiesFor(away).map((a) => a.def.id);
    for (const id of ['bishops_door', 'personnel_board', 'closings_list', 'tribunal_desk', 'the_money', 'deanery_visits']) expect(ids).toContain(id);
    expect(ids).not.toContain('thesis');
    expect(eventById('vg_board_friend')).toBeDefined();
  });
});

describe('the ending as a life', () => {
  it('closes a tenure when a post ends and reads the life back', async () => {
    const { closeTenure, allTenures, openTenure } = await import('@/systems/tenures');
    const { lifeOf } = await import('@/systems/life');
    const { die } = await import('@/engine/career');
    const s = parishState('life');
    const open = openTenure(s)!;
    expect(open.kind).toBe('parish');
    expect(open.label).toBe('Parochial vicar');
    const closed = closeTenure(s, 'moved by the board');
    expect(closed.tenures).toHaveLength(1);
    expect(closed.tenures![0]!.left).toBe('moved by the board');
    // The open post is listed once, even after the ending closed it.
    const dead = die({ ...s, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 20 } });
    expect(dead.mode.kind).toBe('ended');
    expect(allTenures(dead)).toHaveLength(1);
    expect(allTenures(dead)[0]!.left).toBe('died in harness');
    const life = lifeOf(dead);
    expect(life.years).toBe(20);
    expect(life.posts[0]!.years).toMatch(/months|year/);
    expect(life.bishops.length).toBeGreaterThanOrEqual(1);
    expect(life.bishops[0]!.reading).toMatch(/ordained you/);
    expect(life.record.standing).toBeTruthy();
  });
});

describe('the digest, read', () => {
  it('sorts lines into lanes and pulls the numbers out of the money line', async () => {
    const { laneOf, numbersOf, readDigest } = await import('@/systems/digest');
    expect(laneOf('Week of 12 May 2024 · Easter')).toBe('header');
    expect(laneOf('Collections $8,889, above the usual $7,665. Attendance 44%.')).toBe('money');
    expect(laneOf('Knights of Columbus Council is fading.')).toBe('people');
    expect(laneOf('The quarterly assessment went to the chancery.')).toBe('money');
    expect(laneOf('You are tired in a way sleep does not fix.')).toBe('you');
    expect(laneOf('Rome has named Bishop X Y to Chicago.')).toBe('diocese');
    expect(numbersOf({ week: 1, lines: ['Collections $8,889, above the usual $7,665. Attendance 44%, up.'] })).toEqual({ collections: 8889, usual: 7665, attendance: 44 });
    const weeks = readDigest([
      { week: 1, lines: ['Week of 1 May 2024 · Easter', 'Collections $7,000, about the usual $7,000. Attendance 44%.'] },
      { week: 2, lines: ['Week of 8 May 2024 · Easter', 'Collections $8,000, above the usual $7,000. Attendance 45%, up.', 'The Trust: Report it to the diocesan finance office and let them tell you what it is.'] },
    ], 5);
    expect(weeks[0]!.week).toBe(2);
    expect(weeks[0]!.moneySign).toBe(1);
    expect(weeks[0]!.pewsSign).toBe(1);
    expect(weeks[0]!.lanes.decided).toHaveLength(1);
    expect(weeks[0]!.eventful).toBe(true);
    expect(weeks[1]!.eventful).toBe(false);
  });
});
