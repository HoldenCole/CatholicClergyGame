import { describe, it, expect } from 'vitest';
import { creationContent as content } from '@/content/creation';
import { newGame } from '@/engine/game';
import {
  applyCreation,
  availableCareers,
  careerAvailability,
  careerGain,
  entryAge,
  ordinationAge,
  validateAnswers,
} from '@/systems/creation';
import type { CreationAnswers } from '@/types';

const base: CreationAnswers = {
  firstName: 'Thomas',
  lastName: 'Reilly',
  portrait: 'p1',
  entryYear: 2010,
  origin: 'urban_ethnic',
  tie: 'son',
  path: 'college',
  field: 'philosophy',
  career: null,
  yearsWorked: 0,
  motive: 'priest',
  family: 'supportive',
  past: null,
};

describe('systems/creation', () => {
  it('content is complete', () => {
    expect(content.origins).toHaveLength(6);
    expect(content.ties).toHaveLength(4);
    expect(content.paths).toHaveLength(6);
    expect(content.fields).toHaveLength(8);
    expect(content.careers).toHaveLength(15);
    expect(content.motives).toHaveLength(6);
    expect(content.families).toHaveLength(6);
    expect(content.pasts).toHaveLength(6);
    for (const group of Object.values(content)) {
      for (const o of group) {
        expect(o.outcome.split(' ').length, o.id).toBeGreaterThan(20);
        expect(o.blurb.length, o.id).toBeGreaterThan(20);
      }
    }
  });

  it('entry age follows the seven-year rule', () => {
    expect(entryAge(base, content)).toBe(22);
    expect(entryAge({ ...base, path: 'high_school', field: null }, content)).toBe(18);
    const lawyer = { ...base, path: 'doctoral' as const, field: 'history_law' as const, career: 'attorney' as const, yearsWorked: 8 };
    expect(entryAge(lawyer, content)).toBe(34);
    expect(entryAge({ ...lawyer, yearsWorked: 30 }, content)).toBe(40);
    const { state } = newGame({ seed: 'c' });
    const built = applyCreation(state, lawyer, content);
    expect(ordinationAge(built.character!)).toBe(41);
  });

  it('gates careers by field and by how much degree the path carries', () => {
    const ids = (path: CreationAnswers['path'], field: CreationAnswers['field']) => availableCareers({ path, field }, content).map((c) => c.id);
    // A bachelor's in history or law is not a law degree.
    expect(ids('college', 'history_law')).toEqual(expect.arrayContaining(['journalism', 'teacher', 'military', 'trades']));
    expect(ids('college', 'history_law')).not.toContain('attorney');
    expect(ids('doctoral', 'history_law')).toContain('attorney');
    expect(ids('college', 'history_law')).not.toContain('professor');
    expect(ids('masters_2', 'history_law')).toContain('professor');
    expect(ids('college', 'history_law')).not.toContain('accountant');
    // Without a degree the trades and the jobs that never needed one.
    expect(ids('high_school', null)).toEqual(expect.arrayContaining(['trades', 'police_fire', 'sales', 'farm']));
    expect(ids('high_school', null)).not.toContain('teacher');
    expect(ids('some_college', 'stem')).not.toContain('nurse');
    // Medicine needs the doctorate; nursing needs the degree.
    expect(ids('college', 'stem')).not.toContain('physician');
    expect(ids('doctoral', 'stem')).toContain('physician');
    expect(ids('college', 'nursing')).toContain('nurse');
    expect(ids('college', 'stem')).toContain('management');
    expect(ids('college', 'education')).toContain('teacher');
    // Every career is reachable by some path and field.
    for (const c of content.careers) {
      const reachable = content.paths.some((p) => content.fields.some((f) => availableCareers({ path: p.id, field: f.id }, content).some((x) => x.id === c.id)));
      expect(reachable, c.id).toBe(true);
    }
    const why = careerAvailability({ path: 'college', field: 'history_law' }, content).find((c) => c.option.id === 'attorney')!.why;
    expect(why).toMatch(/professional or doctoral/);
  });

  it('validates answers', () => {
    expect(validateAnswers(base, content)).toEqual([]);
    expect(validateAnswers({ ...base, field: null }, content)).toContain('A field of study is required for this path.');
    expect(validateAnswers({ ...base, path: 'high_school' }, content)).toContain('This path has no field of study.');
    expect(validateAnswers({ ...base, career: 'accountant', yearsWorked: 3 }, content)).toContain('That career is not open to this education.');
    expect(validateAnswers({ ...base, field: 'business', career: 'accountant', yearsWorked: 30 }, content)).toContain('Entry age cannot exceed 40.');
    expect(validateAnswers({ ...base, yearsWorked: 2 }, content)).toContain('Years worked require a career.');
    expect(validateAnswers({ ...base, firstName: ' ' }, content)).toContain('A name is required.');
    expect(() => applyCreation(newGame({ seed: 'x' }).state, { ...base, field: null }, content)).toThrow();
  });

  it('builds a character with stats, flags, hooks, traits, risks, and credentials', () => {
    const { state } = newGame({ seed: 'c' });
    const answers: CreationAnswers = {
      ...base,
      origin: 'latino_immigrant',
      tie: 'transfer',
      field: 'business',
      career: 'accountant',
      yearsWorked: 12,
      motive: 'running',
      family: 'widowed_mother',
      past: 'drinking',
    };
    const built = applyCreation(state, answers, content);
    const c = built.character!;
    expect(c.name).toEqual({ first: 'Thomas', last: 'Reilly' });
    expect(c.background.entryAge).toBe(34);
    expect(built.flags).toMatchObject({
      'origin:latino_immigrant': true,
      'tie:transfer': true,
      'path:college': true,
      'field:business': true,
      'career:accountant': true,
      'motive:running': true,
      'family:widowed_mother': true,
      'past:drinking': true,
      late_vocation: true,
      speaks_spanish: true,
      degree: true,
      sober: true,
    });
    expect(c.credentials).toEqual(expect.arrayContaining(['spanish', 'partial_cpa']));
    expect(c.traits).toContain('the books do not lie to him');
    expect(c.latentRisks.map((r) => r.id).sort()).toEqual(['past_drinking', 'transfer_history', 'what_he_ran_from']);
    expect(c.hooks.map((h) => h.id)).toContain('home_parish');
    // Business ++ and twelve years as an accountant: administration is the strongest stat.
    expect(c.stats.administration).toBeGreaterThan(c.stats.theology + 10);
    expect(c.stats.administration).toBeGreaterThan(50);
    expect(c.stats.administration).toBeLessThan(75);
    expect(c.reputation.chancery).toBeLessThan(0);
  });

  it('a philosophy man out of college reads as theological; a tradesman out of high school does not', () => {
    const { state } = newGame({ seed: 'c' });
    const phil = applyCreation(state, { ...base, motive: 'intellectual' }, content).character!;
    expect(phil.stats.theology).toBeGreaterThan(phil.stats.administration + 10);
    expect(phil.archetypeLeaning.theological).toBeGreaterThan(0);
    const trades = applyCreation(
      state,
      { ...base, path: 'high_school', field: null, career: 'trades', yearsWorked: 6, motive: 'certainty' },
      content,
    ).character!;
    expect(trades.background.entryAge).toBe(24);
    expect(trades.stats.administration).toBeGreaterThan(trades.stats.theology);
  });

  it('career gains diminish after eight years', () => {
    const attorney = content.careers.find((c) => c.id === 'attorney')!;
    expect(careerGain(attorney, 8)).toBe(8);
    expect(careerGain(attorney, 16)).toBe(12);
  });
});
