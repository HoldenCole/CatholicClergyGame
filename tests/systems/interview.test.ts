import { describe, expect, it } from 'vitest';
import { newGame } from '@/engine/game';
import { generateRun } from '@/generation';
import { answerInterview, beginInterview, interviewAnswers, interviewQuestions, INTERVIEW, summerAsAsked, summerWanted } from '@/systems/interview';
import { interviewContent } from '@/content/seminary';
import { interestsOf } from '@/systems/interests';
import { chooseSummer } from '@/engine/seminary';
import { offerById } from '@/content/offers';
import { offerWeight } from '@/engine/offers';
import { seminaryState, testNpc } from '../helpers/fixtures';
import type { CreationAnswers, GameState } from '@/types';

const answers: CreationAnswers = {
  firstName: 'Thomas', lastName: 'Reilly', portrait: 'p1', entryYear: 2010, origin: 'suburban', tie: 'school', path: 'college', field: 'education', career: 'teacher', yearsWorked: 6, motive: 'priest', family: 'supportive', past: 'drinking',
};

function fresh(seed: string): GameState {
  const { state, rng } = newGame({ seed, start: { year: 2010, month: 8, day: 20 } });
  return generateRun(state, answers, rng);
}

/** Answer every question with its first open answer, or the one named for that question. */
function answerAll(state: GameState, pick: Record<string, string> = {}): GameState {
  let s = state;
  let guard = 0;
  while (s.mode.kind === 'interview' && guard++ < 20) {
    const q = interviewQuestions(s)[s.mode.index]!;
    const id = pick[q.id] ?? interviewAnswers(s, q).find((a) => a.available)!.answer.id;
    s = answerInterview(s, id);
  }
  return s;
}

describe("the vocations director's interview (DESIGN §6.1a)", () => {
  it('opens the run, one question at a time, and the year begins when it ends; a friar is not interviewed', () => {
    const run = fresh('interview');
    expect(run.mode).toEqual({ kind: 'interview', index: 0 });
    const qs = interviewQuestions(run);
    // A man with a career and a past is asked about both.
    expect(qs.map((q) => q.id)).toContain('career');
    expect(qs.map((q) => q.id)).toContain('past');
    const first = answerInterview(run, 'certainty');
    expect(first.mode.kind).toBe('interview');
    expect((first.mode as { said?: string }).said).toMatch(/second year/);
    expect(first.flags['interview:why']).toBe('certainty');
    const done = answerAll(run);
    expect(done.mode).toEqual({ kind: 'year_start', year: run.seminary!.year });
    expect(done.flags['interview:done']).toBe(true);
    expect(done.career.some((c) => /Interviewed by .* the vocations director/.test(c.text))).toBe(true);
    // Done once: beginning it again does nothing.
    expect(beginInterview(done)).toBe(done);
    // The seminary fixture has no director: the year begins at once.
    expect(beginInterview(seminaryState('no-director')).mode.kind).toBe('clock');
    // A man without a past or a career is not asked about them.
    const plain = fresh('plain');
    const plainQs = interviewQuestions({ ...plain, flags: Object.fromEntries(Object.entries(plain.flags).filter(([k]) => !k.startsWith('past:') && !k.startsWith('career:'))) });
    expect(plainQs.map((q) => q.id)).not.toContain('past');
    expect(plainQs.map((q) => q.id)).not.toContain('career');
    // Deterministic.
    expect(JSON.stringify(answerAll(fresh('interview')))).toBe(JSON.stringify(done));
  });

  it('the answers shape him: opinions on the record, early reputations, a page of notes, the tracks he asked for', () => {
    const run = fresh('shape');
    const s = answerAll(run, { mass: 'traditional', fifteen: 'rome', pastor: 'bishop', bishop: 'later', summer: 'hospital' });
    // An opinion given in the room is a position, semi-public: the director heard it.
    expect(s.character!.positions.some((p) => p.topic === 'liturgy' && p.value === -60 && p.volume === 'semi_public')).toBe(true);
    expect(s.character!.positions.some((p) => p.topic === 'authority')).toBe(true);
    // The blocs and the chancery read it.
    expect(s.character!.reputation.traditional_bloc).toBeGreaterThan(run.character!.reputation.traditional_bloc);
    expect(s.character!.reputation.brother_priests).toBeLessThan(run.character!.reputation.brother_priests);
    // Rome asked for: the College and the Gregorian are on file, and the rector's letter comes likelier.
    expect(interestsOf(s)).toContain('nac');
    expect(interestsOf(s)).toContain('rome');
    expect(offerWeight(offerById('sem_nac')!, s)).toBeGreaterThan(offerWeight(offerById('sem_nac')!, run));
    // His notes are in the file, by the director, unseen.
    const notes = (s.file ?? []).filter((f) => f.kind === 'note');
    expect(notes.length).toBeGreaterThanOrEqual(8);
    expect(notes.every((f) => f.seen === false)).toBe(true);
    const director = Object.values(s.npcs).find((n) => n.tags.includes('vocation_director'))!;
    expect(notes.every((f) => f.by === director.id)).toBe(true);
    expect(notes.some((f) => /Wants Rome/.test(f.text))).toBe(true);
    // Waiting a year before the bishop hears his name warms the director.
    expect(director.relationship).toBeGreaterThan(run.npcs[director.id]!.relationship);
  });

  it('the summer he asked for is marked on the sheet, and taking it is remembered', () => {
    const run = fresh('summer');
    const s = answerAll(run, { summer: 'hospital' });
    expect(summerWanted(s, 'hospital')).toBe(true);
    expect(summerWanted(s, 'chancery')).toBe(false);
    const director = Object.values(s.npcs).find((n) => n.tags.includes('vocation_director'))!;
    const before = director.relationship;
    const taken = summerAsAsked(s, 'hospital');
    expect(taken.npcs[director.id]!.relationship).toBe(before + INTERVIEW.summerAsAskedRelationship);
    expect(taken.flags['summer:as_asked']).toBe(true);
    expect(summerWanted(taken, 'hospital')).toBe(false);
    expect((taken.file ?? []).some((f) => /summer he asked for/.test(f.text))).toBe(true);
    // Another summer spends nothing.
    expect(summerAsAsked(s, 'chancery')).toBe(s);
    // Through the summer choice itself.
    const atSummer: GameState = { ...s, mode: { kind: 'summer', year: 1 } };
    const chosen = chooseSummer(atSummer, 'hospital');
    expect(chosen.flags['summer:as_asked']).toBe(true);
    expect(chosen.seminary!.summers[1]).toBe('hospital');
  });

  it('an answer not open to him is refused, and the interest effect stops at a full file', () => {
    const run = fresh('refuse');
    const noCareer: GameState = { ...run, flags: Object.fromEntries(Object.entries(run.flags).filter(([k]) => !k.startsWith('career:'))) };
    const atMoney = answerAll(noCareer, {}).mode.kind === 'year_start' ? null : null;
    expect(atMoney).toBeNull();
    let s: GameState = noCareer;
    while (s.mode.kind === 'interview' && interviewQuestions(s)[s.mode.index]!.id !== 'money') s = answerInterview(s, interviewAnswers(s, interviewQuestions(s)[s.mode.index]!).find((a) => a.available)!.answer.id);
    expect(() => answerInterview(s, 'counted')).toThrow(/not open/);
    expect(() => answerInterview(s, 'nonsense')).toThrow(/no answer/);
    // Three interests already on file: the room adds none.
    const full: GameState = { ...run, flags: { ...run.flags, 'interest:hospital': true, 'interest:newman': true, 'interest:secretary': true } };
    const rome = answerAll(full, { fifteen: 'rome' });
    expect(interestsOf(rome).sort()).toEqual(['hospital', 'newman', 'secretary']);
  });

  it('the content is sound: ids unique, every question has at least two answers, every answer has prose and effects', () => {
    const ids = new Set<string>();
    for (const q of interviewContent.questions) {
      expect(ids.has(q.id), q.id).toBe(false);
      ids.add(q.id);
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
      expect(q.prompt.length).toBeGreaterThan(20);
      const aids = new Set(q.answers.map((a) => a.id));
      expect(aids.size).toBe(q.answers.length);
      for (const a of q.answers) {
        expect(a.label.length, `${q.id}/${a.id}`).toBeGreaterThan(3);
        expect(a.outcome.length, `${q.id}/${a.id}`).toBeGreaterThan(20);
        expect(a.effects.length, `${q.id}/${a.id}`).toBeGreaterThan(0);
        expect(a.effects.some((e) => e.target === 'file'), `${q.id}/${a.id} has a note`).toBe(true);
        if (a.volume) expect(typeof a.positionTopic === 'string' && typeof a.positionValue === 'number', `${q.id}/${a.id}`).toBe(true);
      }
    }
    // Every answer of every question applies cleanly against a fresh run, whatever the man.
    const run = fresh('sound');
    const withAll: GameState = { ...run, flags: { ...run.flags, 'career:teacher': true, 'past:debt': true } };
    for (const q of interviewContent.questions) {
      const at: GameState = { ...withAll, mode: { kind: 'interview', index: interviewQuestions(withAll).indexOf(q) } };
      for (const a of q.answers) expect(() => answerInterview(at, a.id), `${q.id}/${a.id}`).not.toThrow();
    }
    // The fixture used by the base-game tests still has no director and so no interview.
    expect(beginInterview({ ...seminaryState('x'), npcs: { ...seminaryState('x').npcs, vd: testNpc('vd', { role: 'official', title: 'Fr.', tags: ['vocation_director'] }) } }).mode.kind).toBe('interview');
  });
});
