import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { generateTown } from '@/generation/town';
import { applyTownEffect, ensureTown, fillTown, isTownLine, placeWord, townCondition, townLine, townOf, townRegard, townReviewLine, townTokens, townYear, TOWN } from '@/systems/town';
import { renderText } from '@/engine/text';
import { laneOf } from '@/systems/digest';
import { applyEffects } from '@/engine/effects';
import { evaluateCondition } from '@/engine/conditions';
import { careerYear } from '@/engine/career';
import { townContent } from '@/content/town';
import { TOWN_PLACE_KINDS, type GameState, type TownPlaceKind } from '@/types';

describe('the town as a place', () => {
  it('rolls five to seven places of distinct kinds, named and owned, and no two towns alike', () => {
    const s = parishState('town-gen');
    const parish = s.world!.parishes.find((p) => p.id === s.assignment!.parishId)!;
    const kindSets = new Set<string>();
    const names = new Set<string>();
    const kindCount: Record<string, number> = {};
    const stateCount: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const t = generateTown(createRng(`t${i}`), parish, s.world!.diocese.presetId, 0);
      expect(t.places.length).toBeGreaterThanOrEqual(townContent.count.min);
      expect(t.places.length).toBeLessThanOrEqual(townContent.count.max);
      const kinds = t.places.map((p) => p.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(kinds).toContain('employer');
      expect(kinds).toContain('funeral_home');
      kindSets.add(kinds.join(','));
      for (const p of t.places) {
        names.add(p.name);
        kindCount[p.kind] = (kindCount[p.kind] ?? 0) + 1;
        stateCount[p.state] = (stateCount[p.state] ?? 0) + 1;
        expect(p.name).not.toMatch(/\{\w+\}/);
        expect(p.blurb.length).toBeGreaterThan(10);
        if (p.kind === 'diner' || p.kind === 'funeral_home') expect(p.owner).toBeTruthy();
        if (p.owner && /'s$|& Sons|Funeral Home|Chapel/.test(p.name) && !/^the |^La Cocina|Panader/.test(p.name)) expect(p.name).toContain(p.owner);
      }
    }
    expect(kindSets.size).toBeGreaterThan(100);
    expect(names.size).toBeGreaterThan(200);
    expect(Object.keys(kindCount).length).toBeGreaterThan(8);
    expect(stateCount.thriving ?? 0).toBeGreaterThan(200);
    expect(stateCount.failing ?? 0).toBeGreaterThan(200);
    expect(stateCount.open ?? 0).toBeGreaterThan(3000);
  });

  it('an assignment rolls the town once and keeps it; tokens and lines name its places', () => {
    const s = parishState('town-start');
    const town = townOf(s)!;
    expect(town).toBeTruthy();
    expect(town.parishId).toBe(s.assignment!.parishId);
    expect(ensureTown(s, createRng('again')).towns).toBe(s.towns);
    const diner = town.places.find((p) => p.kind === 'diner');
    expect(placeWord(s, 'diner')).toBe(diner ? diner.name : 'the diner');
    expect(renderText('At {town:diner} in {town}.', s)).toBe(`At ${placeWord(s, 'diner')} in ${town.name}.`);
    for (const k of TOWN_PLACE_KINDS) expect(townTokens(s)[`town:${k}`]).toBeTruthy();
    let lines = 0;
    for (let i = 0; i < 80; i++) {
      const line = townLine(s, createRng(`l${i}`));
      if (!line) continue;
      lines++;
      expect(isTownLine(line)).toBe(true);
      expect(laneOf(line)).toBe('around');
      expect(line).not.toMatch(/\{\w+\}/);
    }
    expect(lines).toBeGreaterThan(8);
    expect(lines).toBeLessThan(40);
    expect(isTownLine('The parking lot was full at the 10:30 and empty at the 7:30, as usual.')).toBe(false);
    expect(fillTown('{name} and {owner} in {town}', town.places[0]!, town, s)).not.toMatch(/\{/);
  });

  it('the year moves the places, closures cost households, a closed place is replaced in time, and the review says so', () => {
    const s = parishState('town-years');
    let next: GameState = s;
    const before = s.world!.parishes.find((p) => p.id === s.assignment!.parishId)!.households;
    const seen = new Set<string>();
    let allLines: string[] = [];
    let carried = false;
    for (let y = 1; y <= 60; y++) {
      const at: GameState = { ...next, clock: { ...next.clock, week: s.clock.week + y * 52 } };
      const r = townYear(at, createRng(`y${y}`));
      next = r.state;
      expect(r.changes.length).toBeLessThanOrEqual(TOWN.changesPerYear);
      for (const c of r.changes) { seen.add(`${c.from}>${c.to}`); if ((c.to === 'closed' || c.to === 'new') && townContent.archetypes.find((a) => a.kind === c.place.kind)?.households) carried = true; }
      for (const line of r.lines) { expect(line).not.toMatch(/\{\w+\}/); expect(laneOf(line)).toBe('parish'); }
      allLines = allLines.concat(r.lines);
    }
    expect(seen.has('open>failing')).toBe(true);
    expect([...seen].some((k) => k.endsWith('>closed'))).toBe(true);
    expect([...seen].some((k) => k === 'closed>new')).toBe(true);
    expect(allLines.length).toBeGreaterThan(5);
    const after = next.world!.parishes.find((p) => p.id === s.assignment!.parishId)!.households;
    if (carried) expect(after).not.toBe(before); else expect(after).toBe(before);
    // Deterministic.
    const a = townYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'));
    expect(townYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'))).toEqual(a);
    // The review names what moved this year.
    const moved = next.towns![s.assignment!.parishId]!.places.some((p) => p.sinceWeek > next.clock.week - 52 && p.state !== 'open');
    const line = townReviewLine({ ...next, clock: { ...next.clock, week: s.clock.week + 60 * 52 } }, s.clock.week + 59 * 52);
    if (moved) expect(line).toMatch(/The town is/); else expect(line).toBeNull();
    // The career year carries it.
    const yr = careerYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 }, flags: { ...s.flags, ordination_week: s.clock.week } }, createRng('cy'));
    expect(yr.towns![s.assignment!.parishId]).toBeTruthy();
  });

  it('effects move a place’s regard and write the town’s memory, and conditions read state and regard', () => {
    const s = parishState('town-effects');
    const town = townOf(s)!;
    const diner = town.places.find((p) => p.kind === 'diner')!;
    const bumped = applyTownEffect(s, { target: 'town', key: 'diner', delta: 14, value: 'He sat at the counter at {name}.' });
    const t2 = townOf(bumped)!;
    expect(t2.places.find((p) => p.kind === 'diner')!.regard).toBe(diner.regard + 14);
    expect(t2.memory[0]!.text).toBe(`He sat at the counter at ${diner.name}.`);
    expect(t2.memory[0]!.week).toBe(s.clock.week);
    const all = applyEffects(s, [{ target: 'town', key: 'any', delta: -5 }], {}, 'test');
    expect(townRegard(townOf(all)!)).toBeCloseTo(townRegard(town) - 5, 5);
    expect(applyTownEffect({ ...s, towns: {} }, { target: 'town', key: 'diner', delta: 1 }).towns).toEqual({});
    expect(evaluateCondition({ type: 'town', key: 'diner', value: diner.state }, s, {})).toBe(true);
    expect(evaluateCondition({ type: 'town', key: 'diner', value: 'closed' }, s, {})).toBe(false);
    expect(evaluateCondition({ type: 'town_regard', key: 'diner', op: '>=', value: diner.regard + 14 }, bumped, {})).toBe(true);
    expect(evaluateCondition({ type: 'town_regard', key: 'diner', op: '>=', value: diner.regard + 14 }, s, {})).toBe(false);
    const missing = TOWN_PLACE_KINDS.find((k) => !town.places.some((p) => p.kind === k)) as TownPlaceKind;
    expect(townCondition(s, { type: 'town', key: missing, value: 'open' })).toBe(false);
    expect(evaluateCondition({ type: 'town', key: 'any', value: diner.state }, s, {})).toBe(true);
  });
});
