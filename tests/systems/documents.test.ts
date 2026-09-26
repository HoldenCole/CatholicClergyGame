import { describe, it, expect } from 'vitest';
import { newGame } from '@/engine/game';
import { toDayNumber } from '@/engine/calendar';
import { allEvents } from '@/content';
import { documentHistory, documentPools, policyAxes } from '@/content/rome';
import { draftsBetween, documentsOfHisLife, documentsWeek, dueCascade, generatedDocument, romeAtStart } from '@/systems/rome/documents';
import { docLean, effectiveStance, policiesByDate, policyOf } from '@/systems/rome/policy';
import { recordEndDay, walkRome } from '@/systems/rome/papacy';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { facultyGate } from '@/systems/decor';
import { renderText } from '@/engine/text';
import { parishState } from './week.test';
import type { GameState, Papacy } from '@/types';

const day = (y: number, m: number, d: number) => toDayNumber({ year: y, month: m, day: d });

/** Run only Rome's documents forward, week by week. */
function weeks(state: GameState, n: number): GameState {
  let s = state;
  for (let w = 0; w < n; w++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    const r = documentsWeek(s);
    s = { ...r.state, letters: [...(r.state.letters ?? []), ...r.letters] };
  }
  return s;
}

function until(state: GameState, test: (s: GameState) => boolean, max = 600): GameState {
  let s = state;
  for (let i = 0; i < max && !test(s); i++) s = weeks(s, 1);
  return s;
}

describe('the documents of the record, as data', () => {
  it('run in date order, name real popes, and set only real axis values', () => {
    for (let i = 1; i < documentHistory.length; i++) expect(documentHistory[i - 1]!.date <= documentHistory[i]!.date).toBe(true);
    for (const d of documentHistory) {
      expect(['pius_xii', 'john_xxiii', 'paul_vi', 'john_paul_i', 'john_paul_ii', 'benedict_xvi', 'francis']).toContain(d.pope);
      expect(documentPools.kinds[d.kind]).toBeDefined();
      if (d.axis) expect(policyAxes.find((a) => a.key === d.axis)!.values.map((v) => v.key)).toContain(d.value);
    }
    expect(documentHistory.length).toBeGreaterThanOrEqual(30);
    expect(documentHistory.at(-1)!.date < '2025-04-21').toBe(true);
  });

  it('leave the law where it stood on the day a life begins', () => {
    const at = (y: number, m: number, d: number) => romeAtStart('a', day(y, m, d)).policies!;
    expect(at(1965, 1, 3).older_mass!.value).toBe('free');
    expect(at(1975, 1, 5).older_mass!.value).toBe('closed');
    expect(at(1990, 1, 7).older_mass!.value).toBe('indult');
    const s2010 = at(2010, 8, 22);
    expect(s2010.older_mass).toMatchObject({ value: 'free', by: 'Summorum Pontificum' });
    expect(s2010.missal!.value).toBe('dynamic');
    expect(s2010.remarried_communion!.value).toBe('strict');
    const s2022 = at(2022, 9, 4);
    expect(s2022.older_mass).toMatchObject({ value: 'faculties', by: 'Traditionis Custodes', from: 'free' });
    expect(s2022.missal!.value).toBe('literal');
    expect(s2022.lay_ministries!.value).toBe('open');
    expect(s2022.synodality!.value).toBe('synodal');
    expect(s2022.blessings!.value).toBe('none');
    expect(at(2024, 6, 2).blessings!.value).toBe('spontaneous');
    // Without a Rome in the state, the record alone gives the same law.
    expect(policiesByDate(day(2022, 9, 4)).older_mass!.value).toBe('faculties');
  });
});

describe('the documents a generated pope issues', () => {
  it('are the same in the same world, and never take a real title', () => {
    expect(romeAtStart('same', day(2045, 1, 1))).toEqual(romeAtStart('same', day(2045, 1, 1)));
    const real = new Set([...documentPools.blocked, ...documentHistory.map((d) => d.title)].map((t) => t.toLowerCase()));
    const pope: Papacy = { id: 'gen:1', name: 'Gregory XVII', born: 1960, electedDay: recordEndDay(), temperament: 50, from: 'Brazil', historical: false };
    let n = 0;
    for (let k = 0; k < 4000; k++) {
      const d = generatedDocument(`s${k % 7}`, k, pope, policiesByDate(recordEndDay()));
      if (!d) continue;
      n++;
      expect(real.has(d.title.toLowerCase())).toBe(false);
    }
    // About one and a half a year.
    expect(n / (4000 / 52)).toBeGreaterThan(1.1);
    expect(n / (4000 / 52)).toBeLessThan(2.1);
  });

  it('move an axis one step toward the pope who issues them', () => {
    for (const t of [70, -70]) {
      const pope: Papacy = { id: 'gen:1', name: 'Clement XV', born: 1960, electedDay: recordEndDay(), temperament: t, from: 'Italy', historical: false };
      let moved = 0;
      for (let k = 0; k < 3000; k++) {
        const d = generatedDocument('lean', k, pope, policiesByDate(recordEndDay()));
        if (!d?.axis) continue;
        moved++;
        expect(Math.sign(docLean(d.axis, d.from, d.value!))).toBe(Math.sign(t));
        const axis = policyAxes.find((a) => a.key === d.axis)!;
        expect(axis.generated).toBe(true);
      }
      expect(moved).toBeGreaterThan(10);
    }
  });

  it('are never issued while the see is vacant', () => {
    for (let i = 0; i < 25; i++) {
      const seed = `vacant-${i}`;
      const line = walkRome(seed, day(2070, 1, 1)).popes;
      const { drafts } = draftsBetween(seed, line, recordEndDay() - 1, day(2070, 1, 1), policiesByDate(recordEndDay()));
      for (const d of drafts) {
        const reign = line.find((p) => p.electedDay <= d.day && (p.endDay === undefined || d.day < p.endDay));
        expect(reign?.id).toBe(d.popeId);
      }
    }
  });
});

describe('the cascade', () => {
  it('Traditionis Custodes comes in July 2021: a letter, the law moves, the bishop reads it, and the parish is asked', () => {
    let s = parishState('cascade');
    expect(policyOf(s, 'older_mass')).toBe('free');
    expect(facultyGate(s).why ?? '').toMatch(/Summorum Pontificum|faculties/);
    s = until(s, (x) => policyOf(x, 'older_mass') === 'faculties');
    const doc = s.rome!.issued!.at(-1)!;
    expect(doc).toMatchObject({ title: 'Traditionis Custodes', axis: 'older_mass', value: 'faculties', from: 'free' });
    expect(['enthusiastic', 'faithful', 'minimal', 'slow']).toContain(doc.norm);
    expect(s.letters?.some((l) => l.title === 'From Rome: Traditionis Custodes' && l.body.join(' ').includes('What it changes'))).toBe(true);
    expect(s.rome!.cascade).toBeDefined();
    // The scene is due some weeks on, and one of the cascade's scenes fits him.
    s = until(s, (x) => !!dueCascade(x), 20);
    expect(dueCascade(s)?.title).toBe('Traditionis Custodes');
    const fits = allEvents.filter((e) => e.beat === 'cascade' && evaluateAll(e.requires ?? [], s));
    expect(fits.length).toBeGreaterThan(0);
    expect(renderText('{doc:older_mass}, the {doc_kind:older_mass}. {reading:older_mass}', s)).toMatch(/^Traditionis Custodes, the motu proprio\. .+/);
  });

  it('what he did stays on the record years later', () => {
    let s = until(parishState('record'), (x) => policyOf(x, 'older_mass') === 'faculties');
    s = applyEffects(s, [{ target: 'document', key: 'older_mass', value: 'faithful' }], {}, 'test');
    expect(evaluateAll([{ type: 'document', axis: 'older_mass', value: 'faculties', implemented: false }], s)).toBe(false);
    expect(evaluateAll([{ type: 'document', axis: 'older_mass', implemented: 'faithful' }], s)).toBe(true);
    s = weeks(s, 520);
    const line = documentsOfHisLife(s).find((d) => d.title === 'Traditionis Custodes');
    expect(line?.line).toMatch(/as given/);
    expect(s.career.some((c) => c.text.startsWith('Put Traditionis Custodes into effect as it was given'))).toBe(true);
  });

  it("the bishop's reading sets the diocese's stance, never looser than the law", () => {
    const base = until(parishState('stance'), (x) => policyOf(x, 'older_mass') === 'faculties');
    const withBishop = (alignment: number): GameState => ({ ...base, world: { ...base.world!, diocese: { ...base.world!.diocese, hidden: { ...base.world!.diocese.hidden, bishop: { ...base.world!.diocese.hidden.bishop, alignment } } } } });
    // A reforming bishop welcomes the restriction and closes the faculty; a traditional one keeps it open by leave.
    expect(effectiveStance(withBishop(95), 'older_form_faculty', 'by_permission')).toBe('forbidden');
    expect(effectiveStance(withBishop(-95), 'older_form_faculty', 'forbidden')).toBe('by_permission');
    // Under the restriction no bishop may leave it free.
    expect(effectiveStance(withBishop(-95), 'older_form_faculty', 'free')).toBe('by_permission');
    // Before it, under Summorum Pontificum, a traditional bishop gives the parish Mass freely.
    const before = parishState('stance');
    const trad: GameState = { ...before, world: { ...before.world!, diocese: { ...before.world!.diocese, hidden: { ...before.world!.diocese.hidden, bishop: { ...before.world!.diocese.hidden.bishop, alignment: -95 } } } } };
    expect(effectiveStance(trad, 'latin_mass', 'forbidden')).toBe('free');
    // Topics no axis governs are the bishop's own.
    expect(effectiveStance(trad, 'altar_rail', 'forbidden')).toBe('forbidden');
  });

  it('a save from before the documents is given the law of the week it is opened in', () => {
    const s = newGame({ seed: 'old', start: { year: 2016, month: 5, day: 1 } }).state;
    const { policies: _p, issued: _i, docsThrough: _d, ...bare } = s.rome!;
    const opened = documentsWeek({ ...s, rome: bare });
    expect(opened.letters).toEqual([]);
    expect(opened.state.rome!.policies!.remarried_communion!.value).toBe('discernment');
    expect(opened.state.rome!.issued).toEqual([]);
  });
});
