import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { sundayOf } from '@/engine/time';
import { electorsOn } from '@/systems/rome/conclave';
import { papacyWeek, reigning } from '@/systems/rome/papacy';
import { documentsWeek } from '@/systems/rome/documents';
import { collegeWeek } from '@/systems/rome/college';
import { duePopeScene, endPontificate, pontificateWeek, pontificateYear } from '@/systems/rome/pontificate';
import { beginDraft, draftSubjects, promulgate } from '@/systems/rome/papalDesk';
import { ACTS, callConsistory, consistoryOpen, holdPapalConsistory, journeyOpen, planJourney } from '@/systems/rome/papalActs';
import { evaluateCondition } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { elected } from '../helpers/pope';
import type { GameState } from '@/types';

function tick(s: GameState): GameState {
  return { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
}

describe('the pontificate begins', () => {
  it('makes the man the reigning pope, ends the vacancy, and gives him the Palace as his posting', () => {
    const s = elected('pont-begin');
    expect(reigning(s)?.id).toBe('player');
    expect(reigning(s)?.name).toBe('Innocent XIV');
    expect(s.rome!.vacancy).toBeUndefined();
    expect(s.study?.city).toBe('holy_see');
    expect(s.flags.pope).toBe(true);
    expect(s.flags.cardinal).toBeUndefined();
    expect(Object.values(s.npcs).some((n) => n.tags.includes('secretary_of_state'))).toBe(true);
    expect(s.study!.place!.strength).toBeLessThanOrEqual(60);
    expect(evaluateCondition({ type: 'papacy', key: 'reigning', value: true }, s)).toBe(true);
    expect(duePopeScene(tick(s))).toBe('first');
    expect(renderText('{pope_name} of {pope_from}', s)).toBe('Innocent XIV of Bishop of Chicago'.replace('Bishop of Chicago', s.rome!.pontificate!.from));
  });

  it('stops the seed writing his documents, calling his consistories, and ending his reign', () => {
    let s = elected('pont-quiet');
    const since = s.rome!.pontificate!.electedDay;
    const made = s.rome!.cardinalsMade;
    for (let i = 0; i < 52 * 6; i++) {
      s = tick(s);
      s = papacyWeek(s).state;
      s = documentsWeek(s).state;
      s = collegeWeek(s).state;
    }
    expect(reigning(s)?.id).toBe('player');
    expect(s.rome!.vacancy).toBeUndefined();
    // The record's own documents may still arrive on their dates; nothing is generated in his name or after his election.
    expect((s.rome!.issued ?? []).filter((d) => !d.id.startsWith('hist:') && d.day >= since)).toEqual([]);
    expect(s.rome!.cardinalsMade).toBe(made);
  });
});

describe('the desk', () => {
  it('offers a step either way on the axes and three topics, and promulgates through the documents machinery', () => {
    let s = elected('pont-desk');
    const subjects = draftSubjects(s);
    expect(subjects.filter((x) => x.lean === 0)).toHaveLength(3);
    const move = subjects.find((x) => x.axis)!;
    s = beginDraft(s, 'motu_proprio', move.id);
    expect(s.rome!.pontificate!.draft!.need).toBe(15);
    s = { ...s, study: { ...s.study!, routine: { pope_writing: 6 } } };
    const letters = [];
    for (let i = 0; i < 4 && s.rome!.pontificate!.draft; i++) {
      const w = pontificateWeek(tick(s));
      s = w.state;
      letters.push(...w.letters);
    }
    expect(s.rome!.pontificate!.draft).toBeUndefined();
    expect(s.rome!.pontificate!.written).toHaveLength(1);
    const doc = s.rome!.issued!.at(-1)!;
    expect(doc.popeId).toBe('player');
    expect(s.rome!.policies![move.axis!]!.value).toBe(move.value);
    expect(s.rome!.cascade).toBeUndefined();
    expect(s.study!.record!.documents).toBe(1);
    const letter = letters.find((l) => l.title.startsWith('Promulgated'))!;
    expect(letter.body.join(' ')).toMatch(/cardinal electors/);
  });

  it('moves no law with a teaching topic, and the Church hears it', () => {
    let s = elected('pont-topic');
    const topic = draftSubjects(s).find((x) => x.lean === 0)!;
    const before = JSON.stringify(s.rome!.policies);
    s = beginDraft(s, 'encyclical', topic.id);
    const church = s.study!.place!.church!;
    const out = promulgate(s);
    expect(JSON.stringify(out.state.rome!.policies)).toBe(before);
    expect(out.state.study!.place!.church).toBeGreaterThan(church);
    expect(out.state.study!.place!.world).toBeGreaterThan(s.study!.place!.world!);
  });
});

describe('the consistory', () => {
  it('waits a year, offers sixteen men whose reading is not his, and his choice fills the College', () => {
    let s = elected('pont-consistory', 60);
    expect(consistoryOpen(s).open).toBe(false);
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 52 } };
    // Make room: a College that has aged.
    const day = sundayOf(s.clock);
    s = { ...s, rome: { ...s.rome!, college: electorsOn(s.rome!.college!, day).slice(20) } };
    expect(consistoryOpen(s).open).toBe(true);
    s = callConsistory(s);
    const offered = s.rome!.pontificate!.candidates!;
    expect(offered).toHaveLength(ACTS.candidates);
    // The men offered are the same whatever the pope's reading: the choice is his, not the roll's.
    const other = callConsistory({ ...s, rome: { ...s.rome!, pontificate: { ...s.rome!.pontificate!, candidates: undefined } as never }, character: { ...s.character!, alignment: -60 } });
    expect(other.rome!.pontificate!.candidates!.map((c) => c.temperament)).toEqual(offered.map((c) => c.temperament));
    expect(Math.max(...offered.map((c) => c.temperament)) - Math.min(...offered.map((c) => c.temperament))).toBeGreaterThan(60);
    const reformers = offered.filter((c) => c.temperament > 0).map((c) => c.id);
    const out = holdPapalConsistory(s, reformers);
    expect(out.letter).not.toBeNull();
    const mine = out.state.rome!.college!.filter((c) => c.createdBy === 'player');
    expect(mine.map((c) => c.id).sort()).toEqual(reformers.sort());
    expect(out.state.study!.record!.cardinals).toBe(reformers.length);
    expect(out.state.rome!.pontificate!.candidates).toBeUndefined();
    expect(consistoryOpen(out.state).open).toBe(false);
  });
});

describe('journeys', () => {
  it('are prepared for weeks, cost strength, and are counted', () => {
    let s = elected('pont-journey');
    s = planJourney(s, 'Kenya');
    expect(journeyOpen(s).open).toBe(false);
    const due = s.rome!.pontificate!.journey!.dueWeek;
    const strength = s.study!.place!.strength!;
    while (s.clock.week < due) s = pontificateWeek(tick(s)).state;
    expect(s.rome!.pontificate!.journey).toBeUndefined();
    expect(s.rome!.pontificate!.journeys.map((j) => j.where)).toEqual(['Kenya']);
    expect(s.study!.place!.strength!).toBeLessThan(strength);
    expect(s.study!.record!.journeys).toBe(1);
    expect(duePopeScene(s)).toBe('journey');
    expect(renderText('{pope_journey}', s)).toBe('Kenya');
  });
});

describe('the end', () => {
  it('by renunciation: the College he made elects one of its own, and the shelf page says so', () => {
    let s = elected('pont-end', 50);
    const day = sundayOf(s.clock);
    // A College entirely of his making, reading as he does.
    s = { ...s, rome: { ...s.rome!, college: electorsOn(s.rome!.college!, day).map((c) => ({ ...c, createdBy: 'player', temperament: 50 })) } };
    const out = endPontificate(s, 'resigned');
    expect(out.mode.kind).toBe('ended');
    if (out.mode.kind !== 'ended') return;
    expect(out.mode.ending).toBe('pope_renounced');
    expect(out.mode.summary).toMatch(/one of your own creations/);
    expect(out.mode.summary).toMatch(/years a priest/);
    expect(out.rome!.popes.at(-1)!.end).toBe('resigned');
  });

  it('by death: an old pope whose strength is gone dies within a few years, the same way from the same seed', () => {
    const run = () => {
      let s = elected('pont-death');
      s = { ...s, character: { ...s.character!, entryYear: 1960 }, study: { ...s.study!, place: { ...s.study!.place!, strength: -100 } } };
      for (let y = 0; y < 30; y++) {
        s = { ...s, clock: { ...s.clock, week: s.clock.week + 52 } };
        s = pontificateYear(s, createRng(`pont-death:${y}`));
        if (s.mode.kind === 'ended') return { y, ending: s.mode.ending };
      }
      return null;
    };
    const a = run();
    expect(a?.ending).toBe('pope_died');
    expect(run()).toEqual(a);
  });
});
