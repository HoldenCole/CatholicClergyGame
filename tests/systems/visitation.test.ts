import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { sundayOf } from '@/engine/time';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { allEvents } from '@/content';
import { axisDef } from '@/content/rome';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { dueCascade, generatedDocument, issueDocument, type Draft } from '@/systems/rome/documents';
import { readerOf, readingLine } from '@/systems/rome/policy';
import { papacyWeek } from '@/systems/rome/papacy';
import { AXIS, VISITATION, applyDecree, closeVisitationScene, dueVisitationScene, findingsOf, openVisitation, outcomeOf, visitationCauses, visitationTokens, visitationWeek } from '@/systems/religious/visitation';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import type { GameState, OrderKey, Papacy, VisitationOutcome } from '@/types';

/** A solemnly professed friar of fifty in a priory, with Rome seeded. */
function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 70, charisma: 65, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20 } }, gen, 2010, priory.id);
  const c = s.character!;
  s = { ...s, phase: 'pastor', clock: { ...s.clock, week: 40 }, character: { ...c, reputation: { ...c.reputation, order: 50, province: 50, rome: 30 } }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 5, legibility: 60, termsServed: [] } };
  return papacyWeek(s).state;
}

/** The same man as provincial of the province. */
function provincial(seed: string): GameState {
  const s = friar(seed);
  return { ...s, flags: { ...s.flags, 'office:provincial': 1 }, province: { ...s.province!, provincialId: PLAYER_ID }, religious: { ...s.religious!, office: { office: 'provincial', bodyId: s.province!.id, startWeek: 1, endWeek: 300, consecutive: 1 } } };
}

function draft(s: GameState, value: string, from = 'constitutions'): Draft {
  const pope = s.rome!.popes[s.rome!.popes.length - 1]!;
  return { id: `gen:test:${value}`, kind: 'motu_proprio', title: 'Vitae Communis Forma', gist: axisDef(AXIS)!.values.find((v) => v.key === value)!.gist, day: sundayOf(s.clock), popeId: pope.id, axis: AXIS, value, from };
}

function at(s: GameState, week: number): GameState {
  return { ...s, clock: { ...s.clock, week } };
}

/** Run the visitation's week from `s` until the stage changes or `max` weeks pass. */
function untilStage(s: GameState, stage: string, max = 200): GameState {
  let n = s;
  for (let i = 0; i < max && n.province?.visitation?.stage !== stage; i++) {
    n = visitationWeek(at(n, n.clock.week + 1), createRng(`w:${n.clock.week + 1}`)).state;
  }
  return n;
}

const yes: Rng = { ...createRng('yes'), chance: () => true };

describe('Rome speaks to religious life (E3 §16D)', () => {
  it('the axis is data: read by the provincial, three values from the habit to the mission, a reading for every norm', () => {
    const a = axisDef(AXIS)!;
    expect(a.reader).toBe('provincial');
    expect(a.generated).toBe(true);
    expect(a.initial).toBe('constitutions');
    expect(a.values.map((v) => v.key)).toEqual(['observant', 'constitutions', 'adapted']);
    expect(a.values.map((v) => v.lean)).toEqual([-1, 0, 1]);
    for (const v of a.values) for (const norm of ['enthusiastic', 'faithful', 'minimal', 'slow'] as const) expect(a.readings?.[v.key]?.[norm]).toContain('{provincial}');
  });

  it('a generated pope moves it: a traditional pope toward the habit, a progressive one toward the mission', () => {
    const pope = (t: number): Papacy => ({ id: 'gen:1', name: 'Test', born: 1950, electedDay: 0, temperament: t, from: 'Italy', line: '', historical: false } as unknown as Papacy);
    const policies = { [AXIS]: { value: 'constitutions', by: null, day: 0 } };
    const seen = { observant: 0, adapted: 0 };
    for (let k = 0; k < 4000; k++) {
      const d = generatedDocument('seed', k, pope(-60), policies);
      if (d?.axis === AXIS) { expect(d.value).toBe('observant'); seen.observant++; }
      const e = generatedDocument('seed', k, pope(60), policies);
      if (e?.axis === AXIS) { expect(e.value).toBe('adapted'); seen.adapted++; }
    }
    expect(seen.observant).toBeGreaterThan(0);
    expect(seen.adapted).toBeGreaterThan(0);
  });

  it("the provincial reads it for a friar, in his own name; a friar who is provincial reads it himself", () => {
    const s = friar('reader');
    expect(readerOf(s, AXIS)!.id).toBe(s.province!.provincialId);
    expect(readerOf(s, 'older_mass')!.id).toBe(s.world!.diocese.hidden.bishop.npcId);
    const out = issueDocument(s, draft(s, 'observant'));
    const doc = out.state.rome!.issued!.at(-1)!;
    expect(doc.bishopId).toBe(s.province!.provincialId);
    expect(doc.norm).toBeDefined();
    const prov = s.npcs[s.province!.provincialId]!;
    expect(readingLine(out.state, doc)).toContain(prov.name.last);
    expect(out.letter!.body[2]).toContain(prov.name.last);
    expect(out.letter!.body.at(-1)).toContain('read aloud at table in the house');
    const p = provincial('reader');
    const mine = issueDocument(p, draft(p, 'observant'));
    expect(mine.state.rome!.issued!.at(-1)!.norm).toBeUndefined();
    expect(mine.letter!.body[2]).toContain('yours to give');
  });

  it("the house asks him: the cascade's scenes for each value, and the provincial's own letter", () => {
    const cascades = allEvents.filter((e) => e.beat === 'cascade' && e.campaign === 'religious');
    expect(cascades.map((e) => e.id).sort()).toEqual(['hc_choir_again', 'hc_constitutions', 'hc_formation_opened', 'hc_habit_again', 'hc_habit_set_aside', 'hc_provincial_adapted', 'hc_provincial_observant']);
    const fits = (s: GameState) => cascades.filter((e) => isEligible(e, s) && evaluateAll(e.requires, s)).map((e) => e.id).sort();
    for (const [value, friarScenes, provincialScenes] of [
      ['observant', ['hc_choir_again', 'hc_habit_again'], ['hc_provincial_observant']],
      ['adapted', ['hc_formation_opened', 'hc_habit_set_aside'], ['hc_provincial_adapted']],
      ['constitutions', ['hc_constitutions'], ['hc_constitutions']],
    ] as const) {
      const s = issueDocument(friar('cascade'), draft(friar('cascade'), value, value === 'constitutions' ? 'observant' : 'constitutions')).state;
      const due = at(s, s.rome!.cascade!.dueWeek);
      expect(dueCascade(due)!.value).toBe(value);
      expect(fits(due)).toEqual([...friarScenes]);
      const p = issueDocument(provincial('cascade'), draft(provincial('cascade'), value, value === 'constitutions' ? 'observant' : 'constitutions')).state;
      expect(fits(at(p, p.rome!.cascade!.dueWeek))).toEqual([...provincialScenes]);
    }
  });

  it('Rome comes for a cause: a divided province, a shrinking one, a complaint, or a document slow-walked; not twice within twelve years', () => {
    const s = friar('cause');
    const sound = { ...s, province: { ...s.province!, finances: { ...s.province!.finances, balance: 100 }, factions: { ...s.province!.factions, hostility: 10 }, trajectory: 'growing' as const } };
    expect(visitationCauses(sound)).toEqual([]);
    expect(visitationCauses({ ...sound, province: { ...sound.province, factions: { ...sound.province.factions, hostility: 80 } } }).map((c) => c.cause)).toEqual(['division']);
    expect(visitationCauses({ ...sound, province: { ...sound.province, trajectory: 'shrinking' } }).map((c) => c.cause)).toEqual(['decline']);
    expect(visitationCauses({ ...sound, flags: { ...sound.flags, 'visitation:complaint': true } }).map((c) => c.cause)).toEqual(['complaint']);
    const slow = issueDocument(sound, draft(sound, 'observant')).state;
    const issued = slow.rome!.issued!.map((d) => (d.axis === AXIS ? { ...d, norm: 'slow' as const } : d));
    expect(visitationCauses({ ...slow, rome: { ...slow.rome!, issued } }).map((c) => c.cause)).toEqual(['document']);
    // The week's roll, said yes to: it opens; not on the heels of the last one.
    const opened = visitationWeek(sound, yes);
    expect(opened.state.province!.visitation).toBeDefined();
    expect(opened.letter?.title).toBe('An Apostolic Visitation');
    expect(opened.state.npcs[opened.state.province!.visitation!.visitorId]!.tags).toContain('visitor');
    const recent = { ...sound, province: { ...sound.province, lastVisitationWeek: sound.clock.week - 52 } };
    expect(visitationWeek(recent, yes).state.province!.visitation).toBeUndefined();
  });

  it('the arc runs announced, visiting, report, decree, on its weeks, setting the scenes due; and the file closes after', () => {
    const s = friar('arc');
    const opened = openVisitation(s, 'division', createRng('open')).state;
    const v = opened.province!.visitation!;
    expect(v.stage).toBe('announced');
    expect(v.scenes.map((x) => x.kind)).toEqual(['announced']);
    expect(dueVisitationScene(at(opened, v.scenes[0]!.dueWeek))).toBe('announced');
    expect(dueVisitationScene(closeVisitationScene(at(opened, v.scenes[0]!.dueWeek)))).toBeNull();
    const visiting = untilStage(opened, 'visiting');
    expect(visiting.clock.week - s.clock.week).toBeGreaterThanOrEqual(VISITATION.weeks.toVisiting[0]);
    expect(visiting.province!.visitation!.scenes.map((x) => x.kind)).toEqual(expect.arrayContaining(['house', 'interview']));
    const report = untilStage(visiting, 'report');
    expect(report.province!.visitation!.scenes.map((x) => x.kind)).toContain('report');
    const decree = untilStage(report, 'decree');
    const d = decree.province!.visitation!;
    expect(d.outcome).toBeDefined();
    expect(d.findings).toBeDefined();
    expect(d.scenes.map((x) => x.kind)).toContain('decree');
    expect(decree.letters?.some((l) => l.title === 'The Decree of the Visitation') || decree.career.some((c) => c.text.startsWith('The decree of the visitation'))).toBe(true);
    // Left unasked, the decree's scene lapses and the file closes with the outcome on the flags.
    const closed = untilStage(decree, 'gone', 60);
    expect(closed.province!.visitation).toBeUndefined();
    expect(closed.province!.lastVisitationWeek).toBeDefined();
    expect(closed.flags['visitation:outcome']).toBe(d.outcome);
    expect(closed.clock.week - s.clock.week).toBeGreaterThan(80);
  });

  it('the decree is table-driven from the findings, and the findings read the province, its answer to Rome, and what he said', () => {
    expect(outcomeOf(0)).toBe('clean');
    expect(outcomeOf(VISITATION.thresholds.norms)).toBe('norms');
    expect(outcomeOf(VISITATION.thresholds.closure)).toBe('closure');
    expect(outcomeOf(VISITATION.thresholds.commissary)).toBe('commissary');
    const s = friar('findings');
    const sound = { ...s, province: { ...s.province!, finances: { ...s.province!.finances, balance: 100 }, factions: { ...s.province!.factions, hostility: 10 }, trajectory: 'growing' as const } };
    const v = openVisitation(sound, 'decline', createRng('o')).state.province!.visitation!;
    const base = findingsOf(sound, v);
    const divided = { ...sound, province: { ...sound.province, factions: { ...sound.province.factions, hostility: 90 } } };
    expect(findingsOf(divided, v)).toBeGreaterThan(base);
    expect(findingsOf({ ...divided, flags: { ...divided.flags, 'visitation:spoke': 'plain' } }, v)).toBeGreaterThan(findingsOf(divided, v));
    expect(findingsOf({ ...divided, flags: { ...divided.flags, 'visitation:spoke': 'loyal' } }, v)).toBeLessThan(findingsOf(divided, v));
    const defied = issueDocument(divided, draft(divided, 'observant')).state;
    const issued = defied.rome!.issued!.map((d) => (d.axis === AXIS ? { ...d, implemented: 'defiant' as const } : d));
    expect(findingsOf({ ...defied, rome: { ...defied.rome!, issued } }, v)).toBeGreaterThan(findingsOf(divided, v));
  });

  it("norms raise every house's observance; a closure closes the smallest house; a commissary removes the provincial and calls a chapter", () => {
    const s = friar('decree');
    const opened = openVisitation(s, 'division', createRng('o')).state;
    const v = opened.province!.visitation!;
    const with_ = (outcome: VisitationOutcome) => applyDecree(opened, { ...v, outcome }, createRng('d'));
    const houses = (g: GameState) => Object.values(g.orderHouses!).filter((h) => h.provinceId === g.province!.id);
    const norms = with_('norms');
    for (const h of houses(norms.state)) expect(h.observance).toBe(Math.min(100, opened.orderHouses![h.id]!.observance + VISITATION.normsObservance));
    expect(norms.state.flags['visitation:norms']).toBe(opened.clock.week);
    const closure = with_('closure');
    expect(houses(closure.state).length).toBe(houses(opened).length - 1);
    expect(closure.v.closedHouseId).toBeDefined();
    expect(visitationTokens(closure.state).closed_house).toBeDefined();
    const commissary = with_('commissary');
    expect(commissary.state.province!.provincialId).toBe(v.visitorId);
    expect(commissary.state.npcs[v.visitorId]!.tags).toContain('commissary');
    expect(commissary.state.npcs[opened.province!.provincialId]!.tags).not.toContain('provincial');
    expect(commissary.state.flags['chapter:provincial:called']).toBe(opened.clock.week + VISITATION.chapterAfter);
    expect(visitationTokens(commissary.state).removed_provincial).toContain(opened.npcs[opened.province!.provincialId]!.name.last);
    // The player as provincial: his office is laid down and the province writes it.
    const p = openVisitation(provincial('decree'), 'complaint', createRng('o')).state;
    const removed = applyDecree(p, { ...p.province!.visitation!, outcome: 'commissary' }, createRng('d')).state;
    expect(removed.religious!.office).toBeUndefined();
    expect(removed.flags['office:provincial']).toBeUndefined();
    expect(removed.flags['visitation:removed']).toBe(true);
    expect(removed.religious!.termsServed.at(-1)!.office).toBe('provincial');
    expect(removed.province!.provincialId).toBe(p.province!.visitation!.visitorId);
  });

  it("the visitation's scenes are in the pool, gated on its condition, the provincial's apart", () => {
    const scenes = allEvents.filter((e) => e.beat === 'apostolic_visitation');
    expect(scenes.length).toBe(12);
    const fits = (g: GameState) => scenes.filter((e) => isEligible(e, g) && evaluateAll(e.requires, g)).map((e) => e.id).sort();
    const s = openVisitation(friar('scenes'), 'division', createRng('o')).state;
    const due = at(s, s.province!.visitation!.scenes[0]!.dueWeek);
    expect(fits(due)).toEqual(['av_announced']);
    const p = openVisitation(provincial('scenes'), 'division', createRng('o')).state;
    expect(fits(at(p, p.province!.visitation!.scenes[0]!.dueWeek))).toEqual(['av_announced_provincial']);
    const decree = applyDecree(s, { ...s.province!.visitation!, stage: 'decree', outcome: 'commissary', scenes: [{ kind: 'decree', dueWeek: s.clock.week }] }, createRng('d')).state;
    expect(fits(decree)).toEqual(['av_decree_commissary']);
    const mine = applyDecree(p, { ...p.province!.visitation!, stage: 'decree', outcome: 'commissary', scenes: [{ kind: 'decree', dueWeek: p.clock.week }] }, createRng('d')).state;
    expect(fits(mine)).toEqual(['av_decree_commissary_provincial']);
    expect(visitationTokens(mine).removed_provincial).toBe('you');
  });

  it('the arc survives save and load mid-visitation', () => {
    const s = friar('save');
    const mid = untilStage(openVisitation(s, 'decline', createRng('o')).state, 'visiting');
    const back = deserialize(serialize(buildSave(mid, createRng(mid.seed), null, {}))).state;
    expect(back.province!.visitation).toEqual(mid.province!.visitation);
    const a = untilStage(mid, 'decree');
    const b = untilStage(back, 'decree');
    expect(b.province!.visitation).toEqual(a.province!.visitation);
    expect(b.clock.week).toBe(a.clock.week);
  });
});
