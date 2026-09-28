import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { directionDefs } from '@/content/see';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { renderText } from '@/engine/text';
import { seeYear } from '@/engine/see';
import { deserialize, serialize, buildSave } from '@/engine/save';
import { cycleProgress, parishesToVisit, pastorOf, VISITS, visitAvailable, visitParish, visitationYear } from '@/systems/bishop/visits';
import { directionAvailable } from '@/systems/bishop/directions';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

function bishop(seed: string): GameState {
  const base = parishState(seed);
  const c = base.character!;
  const home: GameState = {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, credentials: [...c.credentials, 'JCL'], reputation: { ...c.reputation, chancery: 72, rome: 40 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true, aux_named: true, vg_served: true, 'nuncio:named_see': 'gaylord' },
    offers: [{ offerId: 'ep_diocesan_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }],
  };
  return { ...acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state, mode: { kind: 'clock' } };
}
const at = (s: GameState, week: number): GameState => ({ ...s, clock: { ...s.clock, week } });

describe('visits (E4 R1.3)', () => {
  it('every parish of the see is on the list, never visited, and the cycle starts empty', () => {
    const s = bishop('vis-list');
    const list = parishesToVisit(s);
    expect(list.length).toBe(s.world!.parishes.length);
    expect(list.every((x) => x.lastWeek === null && x.due)).toBe(true);
    expect(cycleProgress(s)).toEqual({ visited: 0, total: list.length });
  });

  it('a visit marks the parish, moves the dials, warms the pastor, letters what it found, and keeps its fortnight', () => {
    const s = bishop('vis-one');
    const { parish } = parishesToVisit(s)[0]!;
    const pastor = pastorOf(s, parish)!;
    const out = visitParish(s, parish.id)!;
    expect(out.state.see!.visits?.[parish.id]).toBe(s.clock.week);
    expect(out.state.see!.lastVisitWeek).toBe(s.clock.week);
    expect(out.state.see!.people).toBe(s.see!.people + VISITS.people);
    expect(out.state.npcs[pastor.id]!.relationship).toBe(pastor.relationship + VISITS.regard);
    expect(out.letter.title).toContain(parish.name);
    expect(out.letter.body.length).toBeGreaterThanOrEqual(3);
    expect(out.letter.body.join(' ')).toContain(parish.name);
    expect(out.state.career.at(-1)!.text).toContain(parish.name);
    expect(out.state.flags['visit:parish']).toBe(parish.id);
    expect(cycleProgress(out.state).visited).toBe(1);
    const other = parishesToVisit(out.state).find((x) => x.parish.id !== parish.id)!.parish;
    expect(visitAvailable(at(out.state, s.clock.week + 1), other.id).why).toBe('A visit a fortnight.');
    expect(visitAvailable(at(out.state, s.clock.week + 2), other.id).ok).toBe(true);
    expect(visitAvailable(at(out.state, s.clock.week + 30), parish.id).why).toBe('Visited this year.');
    expect(visitAvailable(out.state, 'nowhere').ok).toBe(false);
  });

  it('a visit can find what the file did not say: the struggle, then known to the file, and the trait he hides', () => {
    let found: ReturnType<typeof visitParish> = null;
    let seen: ReturnType<typeof visitParish> = null;
    let state: GameState | null = null;
    for (let i = 0; i < 12 && !(found && seen); i++) {
      const s = bishop(`vis-find-${i}`);
      for (const { parish } of parishesToVisit(s)) {
        const pastor = pastorOf(s, parish);
        if (!pastor) continue;
        const out = visitParish(s, parish.id);
        if (!out) continue;
        if (!found && pastor.struggle !== 'none' && out.state.flags[`known:${pastor.id}`]) { found = out; state = s; }
        if (!seen && !pastor.traitKnown && out.state.npcs[pastor.id]!.traitKnown) seen = out;
      }
    }
    expect(found).not.toBeNull();
    expect(seen).not.toBeNull();
    expect(found!.state.flags['visit:found_struggle']).toBe(true);
    expect(found!.state.career.at(-1)!.text).toMatch(/what the file did not say/);
    // The file knows it now: treatment may be asked, where before it could not.
    const pid = found!.state.flags['visit:pastor'] as string;
    const pastor = state!.npcs[pid]!;
    const treatment = directionDefs.find((d) => d.id === 'treatment')!;
    if (['drink', 'anger', 'health'].includes(pastor.struggle)) {
      expect(directionAvailable(state!, treatment, pastor).why).toMatch(/does not know/);
      expect(directionAvailable(at(found!.state, found!.state.clock.week + 5), treatment, found!.state.npcs[pid]!).ok).toBe(true);
    }
    // The scene of it names the man.
    const scene = eventById('bp_visit_found')!;
    expect(isEligible(scene, found!.state) && evaluateAll(scene.requires, found!.state)).toBe(true);
    expect(renderText(scene.body, found!.state)).toContain(pastor.name.last);
  });

  it('a vacant parish is visited as one; a mission church, a school at risk, and a heavy debt set their flags', () => {
    const s = bishop('vis-flags');
    const { parish } = parishesToVisit(s)[0]!;
    const vacant = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, pastorId: '' } : p)) } };
    const out = visitParish(vacant, parish.id)!;
    expect(out.state.flags['visit:vacant']).toBe(true);
    expect(out.letter.body.join(' ')).toMatch(/no pastor/);
    const small = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? { ...p, households: 120, school: 'at_risk' as const, debt: 900_000 } : p)) } };
    const o2 = visitParish(small, parish.id)!;
    expect(o2.state.flags['visit:mission']).toBe(true);
    expect(o2.state.flags['visit:school']).toBe(true);
    expect(o2.state.flags['visit:debt']).toBe(true);
    for (const id of ['bp_visit_mission', 'bp_visit_school', 'bp_visit_debt']) expect(evaluateAll(eventById(id)!.requires, o2.state)).toBe(true);
    expect(renderText(eventById('bp_visit_mission')!.body, o2.state)).toContain(parish.name);
  });

  it('the year reads the cycle: a diocese wholly seen is noticed once, and one half unseen for five years costs the people', () => {
    const s = bishop('vis-year');
    const week = s.clock.week;
    const all = Object.fromEntries(s.world!.parishes.map((p, i) => [p.id, week - i]));
    const done = visitationYear({ ...s, see: { ...s.see!, visits: all } });
    expect(done.line).toMatch(/Every parish/);
    expect(done.state.see!.cyclesDone).toBe(1);
    expect(done.state.see!.people).toBe(s.see!.people + VISITS.cycle.people);
    expect(done.state.see!.rome).toBe(s.see!.rome + VISITS.cycle.rome);
    expect(visitationYear(done.state).line).toBeNull();
    const neglected = visitationYear(at(s, week + 52 * 6));
    expect(neglected.line).toMatch(/have not seen their bishop/);
    expect(neglected.state.see!.people).toBe(s.see!.people + VISITS.neglect.people);
    // Through the year's letter.
    const year = seeYear({ ...s, see: { ...s.see!, visits: all } }, createRng('y'));
    expect(year.letter.body.join(' ')).toMatch(/Every parish/);
    expect(year.state.see!.cyclesDone).toBe(1);
  });

  it('the visits survive a save', () => {
    const s = bishop('vis-save');
    const out = visitParish(s, parishesToVisit(s)[0]!.parish.id)!;
    const back = deserialize(serialize(buildSave(out.state, createRng(out.state.seed), null, {}))).state;
    expect(back.see!.visits).toEqual(out.state.see!.visits);
    expect(cycleProgress(back)).toEqual(cycleProgress(out.state));
  });
});
