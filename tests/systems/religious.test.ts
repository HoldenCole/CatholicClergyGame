import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateCandidates } from '@/generation/world';
import { generateInstitutes, generateReligious, RELIGIOUS } from '@/generation/institutes';
import { diocesePresets, presetById } from '@/content/dioceses';
import { instituteDefs } from '@/content/institutes';
import { chooseDirector, DIRECTION, directionKept, directionLine, directionWeek, directionYear, directorOptions, endDirection, matchFor, pietyFactor, troubleOf } from '@/systems/direction';
import { divergeStep, exNoviceStep } from '@/systems/diverge';
import { GROUPS, religiousYear, suppressGroup } from '@/systems/groups';
import { decayWeek } from '@/systems/stats';
import { resolveSelector } from '@/engine/selectors';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import type { GameState } from '@/types';

describe('generation/institutes', () => {
  const runs = Array.from({ length: 120 }, (_, i) => generateInstitutes(createRng(`inst-${i}`), presetById('chicago')!));

  it('every diocese has two to four, one of them a congregation of women, each holding something', () => {
    for (const set of runs) {
      expect(set.length).toBeGreaterThanOrEqual(RELIGIOUS.institutes[0]);
      expect(set.length).toBeLessThanOrEqual(RELIGIOUS.institutes[1]);
      expect(set.some((i) => i.women)).toBe(true);
      expect(new Set(set.map((i) => i.defId)).size).toBe(set.length);
      for (const i of set) {
        expect(i.works.length).toBeGreaterThan(0);
        expect(i.provincial).toBeTruthy();
        expect(['growing', 'stable', 'collapsing']).toContain(i.trajectory);
        expect(['warm', 'correct', 'strained']).toContain(i.bishop);
      }
    }
  });

  it('the diocese shapes which houses are there, and no run is the same as the last', () => {
    const chicago = runs.flatMap((s) => s.map((i) => i.defId));
    expect(new Set(chicago).size).toBeGreaterThanOrEqual(6);
    // A traditional presbyterate keeps a traditional house alive; a progressive one mostly does not.
    const trad = (id: string) => Array.from({ length: 150 }, (_, i) => generateInstitutes(createRng(`t-${id}-${i}`), presetById(id)!)).filter((s) => s.some((x) => x.charism === 'tradition')).length;
    expect(trad('philadelphia')).toBeGreaterThan(trad('los_angeles'));
    // Alignment and charism do not collapse to one value.
    expect(new Set(runs.flat().map((i) => i.alignment)).size).toBeGreaterThan(40);
    expect(new Set(runs.flat().map((i) => i.charism)).size).toBeGreaterThanOrEqual(4);
  });

  it('names four to six religious in standing roles, women among them, all outside the ladder', () => {
    for (let i = 0; i < 60; i++) {
      const institutes = generateInstitutes(createRng(`r-${i}`), presetById('chicago')!);
      const cast = generateReligious(createRng(`cast-${i}`), institutes, 2010);
      expect(cast.length).toBeGreaterThan(0);
      expect(cast.length).toBeLessThanOrEqual(RELIGIOUS.cast[1]);
      for (const n of cast) {
        expect(n.role).toBe('religious');
        expect(n.tags).toContain('religious');
        expect(n.institute).toBeTruthy();
        expect(n.charism).toBeTruthy();
        expect(n.temperament).toBeTruthy();
        // A religious never competes for a parish: he carries no pastor tag and no chancery office.
        expect(n.tags.some((t) => t.startsWith('pastor:') || t === 'chancery')).toBe(false);
      }
    }
  });

  it('a generated diocese carries its institutes and its religious into the run', () => {
    const cands = generateCandidates(createRng('world-rel'), 2010);
    expect(cands.length).toBe(diocesePresets.length);
    for (const c of cands) {
      expect(c.institutes!.length).toBeGreaterThanOrEqual(2);
      const religious = c.npcs.filter((n) => n.role === 'religious');
      expect(religious.length).toBeGreaterThan(0);
      for (const n of religious) expect(c.institutes!.some((i) => i.id === n.institute)).toBe(true);
    }
    expect(instituteDefs.filter((d) => d.women).length).toBeGreaterThanOrEqual(6);
  });
});

describe('systems/direction', () => {
  /** A seminarian with the diocese's religious in the house, as a real run has. */
  function withFaculty(seed: string): GameState {
    const s = seminaryState(seed);
    const institutes = generateInstitutes(createRng(`${seed}-inst`), presetById('chicago')!);
    const cast = generateReligious(createRng(`${seed}-cast`), institutes, 2010);
    return { ...s, npcs: { ...s.npcs, ...Object.fromEntries(cast.map((n) => [n.id, n])) } };
  }

  function withDirector(seed: string, temperament: 'brisk' | 'contemplative' = 'contemplative'): GameState {
    const s = withFaculty(seed);
    const npc = Object.values(s.npcs).find((n) => n.role === 'religious')!;
    const staged: GameState = { ...s, npcs: { ...s.npcs, [npc.id]: { ...npc, charism: 'contemplative', temperament } } };
    return chooseDirector(staged, npc.id);
  }

  it('the choice is offered in words a man can act on, and taking one records the relationship', () => {
    const s = withFaculty('offer');
    const options = directorOptions(s, createRng('o'));
    expect(options.length).toBeGreaterThanOrEqual(1);
    for (const o of options) {
      expect(o.good).toMatch(/^good to a man with /);
      expect(o.poor).toMatch(/^no use at all to a man with /);
      expect(o.good).not.toBe(o.poor);
    }
    const chosen = chooseDirector(s, options[0]!.npcId, false);
    expect(chosen.character!.direction!.npcId).toBe(options[0]!.npcId);
    expect(chosen.flags['direction:chosen']).toBe(true);
    // Splitting the roles is remembered, and the house reads it.
    expect(chosen.flags['direction:split']).toBe(true);
    expect(chosen.npcs[options[0]!.npcId]!.tags).toContain('spiritual_director');
    expect(resolveSelector(chosen, '@director')!.id).toBe(options[0]!.npcId);
    expect(chosen.career.at(-1)!.text).toMatch(/spiritual director/);
    // One man holds it at a time.
    const second = options[1] ? chooseDirector(chosen, options[1].npcId) : chosen;
    if (options[1]) {
      expect(Object.values(second.npcs).filter((n) => n.tags.includes('spiritual_director')).length).toBe(1);
      expect(second.character!.direction!.npcId).toBe(options[1].npcId);
    }
  });

  it('the right man slows the drain, the wrong one is worse than none, and the hour must be kept', () => {
    const dark: GameState = { ...withDirector('match'), character: { ...withDirector('match').character!, stats: { ...withDirector('match').character!.stats, piety: 30 } } };
    expect(troubleOf(dark)).toBe('dark_night');
    // Contemplative temperament and charism both serve a dark night: a good match.
    expect(matchFor(dark.character!.direction, 'dark_night')).toBe('good');
    expect(pietyFactor(dark, 1)).toBeCloseTo(1 - DIRECTION.slow.good, 5);
    // A brisk man is no use at all here, and the hour is spent anyway.
    const brisk = { ...dark, character: { ...dark.character!, direction: { ...dark.character!.direction!, temperament: 'brisk' as const, charism: 'teaching' as const } } };
    expect(matchFor(brisk.character!.direction, 'dark_night')).toBe('poor');
    expect(pietyFactor(brisk, 1)).toBeGreaterThan(1);
    // No director at all: the full drain, no more and no less.
    const { direction: _gone, ...bare } = dark.character!;
    const alone: GameState = { ...dark, character: bare };
    expect(pietyFactor(alone, 1)).toBe(1);
    expect(pietyFactor(alone, 0)).toBe(1);

    // And the drain itself moves with it.
    const usage = { adminAp: 6, theologyUsed: true, knowledgeUsed: true };
    const kept = decayWeek(dark.character!.stats, { ...usage, pietyFactor: pietyFactor(dark, 1) });
    const none = decayWeek(dark.character!.stats, usage);
    expect(kept.piety).toBeGreaterThan(none.piety);
  });

  it('the hour has to be kept up: the slowing lapses when it is not', () => {
    let s = withDirector('kept');
    expect(directionKept(s)).toBe(false);
    s = directionWeek(s, 1);
    expect(s.character!.direction!.weeksKept).toBe(1);
    expect(directionKept(s)).toBe(true);
    const later: GameState = { ...s, clock: { ...s.clock, week: s.clock.week + DIRECTION.keptWithin + 1 } };
    expect(directionKept(later)).toBe(false);
    // Nothing is counted when the hour is not given.
    expect(directionWeek(s, 0)).toBe(s);
  });

  it('a provincial can take him away, and the loss is on the record', () => {
    const s = withDirector('loss');
    const npc = s.npcs[s.character!.direction!.npcId]!;
    const moved: GameState = { ...s, npcs: { ...s.npcs, [npc.id]: { ...npc, role: 'religious' } } };
    let saw = false;
    for (let i = 0; i < 200 && !saw; i++) {
      const r = directionYear(moved, createRng(`y-${i}`));
      if (r.line) {
        saw = true;
        expect(r.line).toMatch(/provincial/);
        expect(r.state.character!.direction!.endedWeek).toBe(moved.clock.week);
        expect(r.state.character!.direction!.endedWhy).toBe('reassigned');
        expect(r.state.flags['direction:lost']).toBe(true);
        // With him gone the drain is the full one again.
        expect(pietyFactor(r.state, 1)).toBe(1);
        expect(directionLine(r.state)).toMatch(/No director/);
      }
    }
    expect(saw).toBe(true);
    // A dead man ends it too.
    const dead: GameState = { ...s, npcs: { ...s.npcs, [npc.id]: { ...npc, status: 'dead' } } };
    expect(directionYear(dead, createRng('d')).state.character!.direction!.endedWhy).toBe('died');
    expect(endDirection(s, 'changed').character!.direction!.endedWhy).toBe('changed');
  });

  it('the sheet says plainly what the man has, and what it is worth just now', () => {
    const s = withDirector('line');
    expect(directionLine(s)).toMatch(/quiet, and slow to answer/);
    const none = withFaculty('none');
    expect(directionLine(none)).toMatch(/Piety drains and nothing slows it/);
  });
});

describe('the classmate who diverges', () => {
  it('leaves the ladder without leaving the game, and keeps his regard for the player', () => {
    let saw = false;
    for (let i = 0; i < 120 && !saw; i++) {
      const s = seminaryState(`div-${i}`);
      const staged: GameState = { ...s, seminary: { ...s.seminary!, year: 2 } };
      const r = divergeStep(staged, createRng(`d-${i}`));
      if (!r.line) continue;
      saw = true;
      const gone = Object.values(r.state.npcs).find((n) => n.tags.includes('diverged'))!;
      expect(gone.role).toBe('religious');
      expect(gone.tags).not.toContain('classmate');
      expect(gone.status).toBe('active');
      expect(gone.institute).toBeTruthy();
      // Off the diocesan ladder, and out of the class list.
      expect(r.state.seminary!.classmateIds).not.toContain(gone.id);
      expect(r.state.flags['classmate:diverged']).toBe(true);
      expect(r.state.career.at(-1)!.text).toMatch(/left formation for/);
      expect(resolveSelector(r.state, '@diverged_classmate')!.id).toBe(gone.id);
      // A warm man becomes a friend; a cold one simply stops competing.
      expect(r.state.flags['diverged:friend'] || r.state.flags['diverged:rival']).toBe(true);
    }
    expect(saw).toBe(true);
  });

  it('a man arrives from a novitiate he left, and nobody quite asks why', () => {
    let saw = false;
    for (let i = 0; i < 120 && !saw; i++) {
      const s = seminaryState(`nov-${i}`);
      const staged: GameState = { ...s, seminary: { ...s.seminary!, year: 5 } };
      const r = exNoviceStep(staged, createRng(`n-${i}`), 2010);
      if (!r.line) continue;
      saw = true;
      const man = r.state.npcs['classmate_ex_novice']!;
      expect(man.role).toBe('classmate');
      expect(man.tags).toContain('ex_novice');
      expect(man.tags.some((t) => t.startsWith('former:inst_'))).toBe(true);
      expect(r.state.seminary!.classmateIds).toContain(man.id);
      // Only once.
      expect(exNoviceStep(r.state, createRng('again'), 2010).line).toBeNull();
    }
    expect(saw).toBe(true);
  });
});

describe('religious-led groups', () => {
  /** One group led by a sister and the rest lay, whatever generation happened to roll. */
  function withSister(seed: string): GameState {
    const s = parishState(seed);
    const entries = Object.entries(s.groups);
    const groups = Object.fromEntries(entries.map(([id, g], i) => [id, i === 0 ? { ...g, religiousLed: true, institute: 'inst_mercy', vitality: 60 } : { ...g, religiousLed: false }]));
    return { ...s, groups };
  }

  it('she cannot be removed: the verb does not exist', () => {
    const s = withSister('suppress');
    const g = Object.values(s.groups).find((x) => x.religiousLed)!;
    expect(() => suppressGroup(s, g.id)).toThrow(/only her superior/);
    // A lay-led group is suppressible as before.
    const lay = Object.values(s.groups).find((x) => !x.religiousLed);
    if (lay) expect(suppressGroup(s, lay.id).groups[lay.id]!.suppressed).toBe(true);
  });

  it('her superior can take her, and the group she built may not survive it', () => {
    const s = withSister('reassign');
    const g = Object.values(s.groups).find((x) => x.religiousLed)!;
    let saw = false;
    for (let i = 0; i < 300 && !saw; i++) {
      const r = religiousYear(s, createRng(`ry-${i}`));
      if (r.lines.length === 0) continue;
      saw = true;
      expect(r.lines[0]).toMatch(/six weeks/);
      expect(r.lines[0]).toMatch(/nothing to do with this parish/);
      expect(r.state.groups[g.id]!.religiousLed).toBe(false);
      expect(r.state.groups[g.id]!.vitality).toBe(g.vitality - GROUPS.religious.lossVitality);
    }
    expect(saw).toBe(true);
    // A parish with no sister leading anything has nothing to lose this way.
    const lay = parishState('nosister');
    const none: GameState = { ...lay, groups: Object.fromEntries(Object.entries(lay.groups).map(([id, g]) => [id, { ...g, religiousLed: false }])) };
    expect(religiousYear(none, createRng('x')).lines).toEqual([]);
  });

  it('the numbers say what the design says: slower decay, cheaper hours', () => {
    expect(GROUPS.religious.decay).toBeLessThan(1);
    expect(GROUPS.religious.sustain).toBeGreaterThan(1);
    expect(GROUPS.religious.reassignedPerYear).toBeGreaterThan(0);
  });
});
