import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { fillLife, lifeDefs, lifeLabel, lifeOf, LIVES, livesReviewLine, livesYear, openLives, orbit } from '@/systems/lives';
import { evaluateCondition } from '@/engine/conditions';
import { resolveSelector } from '@/engine/selectors';
import { renderText } from '@/engine/text';
import { vacanciesOf } from '@/systems/staff';
import type { GameState, Npc } from '@/types';

function peopled(s: GameState): GameState {
  const base = Object.values(s.npcs).find((n) => n.role === 'lay')!;
  const mk = (id: string, role: Npc['role'], tags: string[], title = ''): Npc => ({ ...base, id, role, status: 'active', title, tags, relationship: 20, bonds: [], birthYear: 1975 });
  return { ...s, npcs: { ...s.npcs, cm1: mk('cm1', 'classmate', ['pastor'], 'Fr.'), cm2: mk('cm2', 'classmate', [], 'Fr.'), mom: { ...mk('mom', 'family', ['mother']), birthYear: 1948, name: { first: 'Anne', last: base.name.last } }, sib: { ...mk('sib', 'family', ['sibling', 'married']), birthYear: 1982 } } };
}

describe('lives that move without you', () => {
  it('the content is sound: every life fits someone, has years and endings that sum, and leaves no holes', () => {
    expect(lifeDefs.length).toBeGreaterThanOrEqual(12);
    const s = peopled(parishState('lives-content'));
    const entry = orbit(s).find((e) => e.who === 'staff')!;
    for (const d of lifeDefs) {
      expect(d.who.length).toBeGreaterThan(0);
      expect(d.years[0]).toBeGreaterThanOrEqual(1);
      expect(d.years[1]).toBeGreaterThanOrEqual(d.years[0]);
      expect(d.resolve.reduce((a, o) => a + o.weight, 0)).toBeGreaterThan(0);
      for (const t of [d.line, d.line_man ?? d.line, d.label, ...d.resolve.map((o) => o.line)]) expect(fillLife(t, entry)).not.toMatch(/\{\w+\}/);
    }
  });

  it('the orbit is the staff, the clergy around him, classmates, family, the director; no lay parishioners', () => {
    const s = peopled(parishState('lives-orbit'));
    const o = orbit(s);
    const whos = new Set(o.map((e) => e.who));
    expect(whos.has('staff')).toBe(true);
    expect(whos.has('classmate')).toBe(true);
    expect(whos.has('family')).toBe(true);
    expect(o.some((e) => e.npc.tags.includes('parishioner'))).toBe(false);
    expect(new Set(o.map((e) => e.npc.id)).size).toBe(o.length);
  });

  it('over the years lives begin, run, and end; deaths and departures change status; a dead staff member leaves a desk empty', () => {
    const s = peopled(parishState('lives-years'));
    let next: GameState = s;
    let begun = 0;
    let ended = 0;
    const kinds = new Set<string>();
    for (let y = 1; y <= 50; y++) {
      const at: GameState = { ...next, clock: { ...next.clock, week: s.clock.week + y * 52 } };
      const before = openLives(at).map((e) => e.npc.id);
      const r = livesYear(at, createRng(`ly${y}`));
      next = r.state;
      for (const line of r.lines) expect(line).not.toMatch(/\{\w+\}/);
      const after = openLives(next).map((e) => e.npc.id);
      begun += after.filter((id) => !before.includes(id)).length;
      ended += before.filter((id) => !after.includes(id)).length;
      expect(after.filter((id) => !before.includes(id)).length).toBeLessThanOrEqual(LIVES.startsPerYear);
      for (const e of openLives(next)) kinds.add(lifeOf(e.npc)!.id);
    }
    expect(begun).toBeGreaterThan(8);
    expect(ended).toBeGreaterThan(4);
    expect(kinds.size).toBeGreaterThan(3);
    const changed = Object.values(next.npcs).filter((n) => n.status !== 'active' && n.status !== s.npcs[n.id]?.status && !n.tags.includes('parishioner'));
    expect(changed.length).toBeGreaterThan(0);
    // Once a life is lived it is not lived again by the same person.
    for (const n of Object.values(next.npcs)) {
      const lived = n.tags.filter((t) => t.startsWith('lived:'));
      expect(new Set(lived).size).toBe(lived.length);
    }
    // Deterministic.
    const a = livesYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'));
    expect(livesYear({ ...s, clock: { ...s.clock, week: s.clock.week + 52 } }, createRng('same'))).toEqual(a);
    // A member of staff who dies of it leaves the desk empty.
    const staff = orbit(s).find((e) => e.who === 'staff' && e.tag !== 'deacon')!;
    const week = s.clock.week + 52;
    const dying: GameState = { ...s, clock: { ...s.clock, week }, npcs: { ...s.npcs, [staff.npc.id]: { ...staff.npc, tags: [...staff.npc.tags, 'life:own_illness', `life:since:${week - 52}`, `life:until:${week}`] } } };
    let dead = false;
    for (let i = 0; i < 40 && !dead; i++) {
      const r = livesYear(dying, createRng(`d${i}`));
      if (r.state.npcs[staff.npc.id]!.status === 'dead') { dead = true; expect(vacanciesOf(r.state)).toContain(staff.tag); expect(r.state.career.at(-1)?.text).toMatch(/died\.$/); }
    }
    expect(dead).toBe(true);
  });

  it('the condition, the selector, the sheet label, and the review row read the open life', () => {
    const s = peopled(parishState('lives-cond'));
    const staff = orbit(s).find((e) => e.tag === 'secretary') ?? orbit(s).find((e) => e.who === 'staff')!;
    const week = s.clock.week;
    const withLife: GameState = { ...s, npcs: { ...s.npcs, [staff.npc.id]: { ...staff.npc, tags: [...staff.npc.tags, 'married', 'life:ill_spouse', `life:since:${week - 60}`, `life:until:${week + 40}`] } } };
    expect(evaluateCondition({ type: 'npc_life', key: 'ill_spouse' }, withLife, {})).toBe(true);
    expect(evaluateCondition({ type: 'npc_life', key: 'ill_spouse', who: 'staff' }, withLife, {})).toBe(true);
    expect(evaluateCondition({ type: 'npc_life', key: 'ill_spouse', who: 'clergy' }, withLife, {})).toBe(false);
    expect(evaluateCondition({ type: 'npc_life', key: 'ill_spouse' }, s, {})).toBe(false);
    expect(resolveSelector(withLife, '@life:ill_spouse')?.id).toBe(staff.npc.id);
    expect(resolveSelector(withLife, '@life:drinking')).toBeNull();
    expect(renderText('{@life:ill_spouse} is out.', withLife)).toBe(`${staff.npc.name.first} is out.`);
    const label = lifeLabel(withLife, withLife.npcs[staff.npc.id]!)!;
    expect(label).toMatch(/(husband|wife) ill, a year now$/);
    expect(lifeLabel(s, staff.npc)).toBeNull();
    expect(livesReviewLine(withLife)).toMatch(/ill/);
    expect(livesReviewLine(s)).toBeNull();
  });
});
