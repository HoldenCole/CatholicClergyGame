import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { runClock } from '@/engine/clock';
import { parishWeekHook, type EventDeps } from '@/engine/weekHook';
import { boardDecision, careerYear, isCareerYear, nextAssignment, playerAge, careerSummary } from '@/engine/career';
import { startAssignment } from '@/engine/parish';
import { advanceTrajectories, rollTrajectory, rollTrajectories } from '@/systems/trajectories';
import { refreshOpenings, playerCandidate } from '@/systems/openings';
import { revalue, successionYear } from '@/systems/succession';
import { availableProjects, projectWeek, startProject } from '@/systems/projects';
import { parishState } from './week.test';
import { testNpc } from '../helpers/fixtures';
import type { GameState } from '@/types';

const noDeps: EventDeps = { pool: [], lookup: () => undefined };

describe('systems/trajectories', () => {
  it('rolls varied futures, seeded from ambition and talent', () => {
    const kinds = new Set<string>();
    let earlyPastors = 0;
    let latePastors = 0;
    for (let i = 0; i < 400; i++) {
      const rng = createRng(`t-${i}`);
      const ambitious = testNpc('a', { ambition: 90, stats: { administration: 70, charisma: 70, theology: 40, knowledge: 40, piety: 40 } });
      const modest = testNpc('m', { ambition: 10, stats: { administration: 30, charisma: 30, theology: 40, knowledge: 40, piety: 60 } });
      const ta = rollTrajectory(rng, ambitious);
      const tm = rollTrajectory(createRng(`t2-${i}`), modest);
      for (const m of [...ta, ...tm]) kinds.add(m.kind);
      const pa = ta.find((m) => m.kind === 'pastor');
      const pm = tm.find((m) => m.kind === 'pastor');
      if (pa && pm) {
        if (pa.yearsOrdained < pm.yearsOrdained) earlyPastors++;
        else latePastors++;
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(earlyPastors).toBeGreaterThan(latePastors * 2);
  });

  it('advancing applies milestones once and reports classmate news', () => {
    let s = parishState('traj');
    s = { ...s, npcs: { ...s.npcs, c9: testNpc('c9', { role: 'classmate' }) } };
    s = rollTrajectories(s, createRng('r'));
    const t = s.npcs.c9!.trajectory!;
    expect(t.length).toBeGreaterThan(0);
    const first = t[0]!;
    const r = advanceTrajectories(s, first.yearsOrdained);
    expect(r.lines.length).toBeGreaterThanOrEqual(1);
    expect(r.state.npcs.c9!.trajectory![0]!.done).toBe(true);
    const again = advanceTrajectories(r.state, first.yearsOrdained);
    expect(again.lines).toHaveLength(0);
  });
});

describe('systems/openings and the board', () => {
  it('pastors retire, die, or move over the years and their parishes open', () => {
    let s = parishState('open');
    const rng = createRng('o');
    let sawOpening = false;
    for (let y = 0; y < 15 && !sawOpening; y++) {
      s = { ...s, clock: { ...s.clock, week: s.clock.week + 52 } };
      const r = refreshOpenings(s, rng);
      s = r.state;
      if (s.openings.some((o) => o.parishId)) sawOpening = true;
    }
    expect(sawOpening).toBe(true);
    expect(s.openings.length).toBeLessThanOrEqual(8);
  });

  it('the player candidate reflects his record; the board can pass him over or choose him', () => {
    let s = parishState('board');
    s = { ...s, flags: { ...s.flags, ordination_week: 0 }, clock: { ...s.clock, week: 52 * 6 } };
    const me = playerCandidate(s);
    expect(me.yearsOrdained).toBe(6);
    expect(me.isPlayer).toBe(true);
    s = refreshOpenings({ ...s, world: { ...s.world!, diocese: { ...s.world!.diocese, hidden: { ...s.world!.diocese.hidden, shortage: 5 } } } }, createRng('force')).state;
    if (s.openings.length === 0) s = { ...s, openings: [{ id: 'x', kind: 'pastor', parishId: null, urgency: 80, needsSpanish: false, needsAdmin: false, alignment: 0, week: s.clock.week, label: 'A parish' }] };
    let wins = 0;
    for (let i = 0; i < 60; i++) {
      const d = boardDecision(s, createRng(`b-${i}`));
      expect(d.decisions.length).toBeGreaterThan(0);
      for (const dec of d.decisions) expect(dec.ranked.length).toBeGreaterThanOrEqual(3);
      if (d.won) wins++;
    }
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(60);
  });

  it('a man who took the hard parish is sent to the difficult one', () => {
    let s = parishState('hard');
    const current = s.parish!.parishId;
    const difficult = s.world!.parishes.find((p) => p.kind === 'difficult')!;
    if (difficult.id === current) return;
    s = { ...s, flags: { ...s.flags, ordination_week: 0, took_the_hard_parish: true }, clock: { ...s.clock, week: 52 * 2 }, openings: [] };
    const r = nextAssignment(s, createRng('h'));
    expect(r.state.assignment!.parishId).toBe(difficult.id);
    expect(r.state.flags.hard_parish_honored).toBe(true);
  });

  it('nextAssignment produces a traceable letter either way', () => {
    let s = parishState('next');
    s = { ...s, flags: { ...s.flags, ordination_week: 0 }, clock: { ...s.clock, week: 52 * 8 }, openings: [{ id: 'x', kind: 'pastor', parishId: 'parish_2', urgency: 90, needsSpanish: false, needsAdmin: false, alignment: 0, week: 400, label: 'Pastor of St. X' }] };
    const r = nextAssignment(s, createRng('n'));
    expect(r.state.mode.kind).toBe('assignment');
    expect(r.state.assignment!.reasons.length).toBeGreaterThan(0);
    expect(r.state.assignment!.letter).toMatch(/Dear Father/);
    expect(['pastor', 'parochial_vicar']).toContain(r.state.assignment!.role);
    expect(r.state.career.some((e) => e.kind === 'promotion' || e.kind === 'passed_over')).toBe(true);
  });
});

describe('systems/succession', () => {
  it('revaluation rewards the loud man aligned with the new bishop and buries the loud man opposed', () => {
    const s = parishState('reval');
    const loudTrad: GameState = {
      ...s,
      character: { ...s.character!, alignment: -60, outspokenness: 70, reputation: { ...s.character!.reputation, chancery: 40 }, positions: [{ topic: 'tlm', value: -70, volume: 'public', week: 1 }, { topic: 'liturgy', value: -50, volume: 'public', week: 2 }] },
    };
    const tradBishop = testNpc('nb', { role: 'bishop', alignment: -50 });
    const progBishop = testNpc('nb', { role: 'bishop', alignment: 60 });
    const underTrad = revalue(loudTrad, tradBishop);
    const underProg = revalue(loudTrad, progBishop);
    expect(underTrad.state.character!.reputation.chancery).toBeGreaterThan(underProg.state.character!.reputation.chancery + 20);
    expect(underProg.verdict).toMatch(/That is the problem/);
    expect(underTrad.verdict).toMatch(/approves/);
    const quiet: GameState = { ...loudTrad, character: { ...loudTrad.character!, outspokenness: 0, positions: [] } };
    const q1 = revalue(quiet, tradBishop).state.character!.reputation.chancery;
    const q2 = revalue(quiet, progBishop).state.character!.reputation.chancery;
    expect(Math.abs(q1 - q2)).toBeLessThan(Math.abs(underTrad.state.character!.reputation.chancery - underProg.state.character!.reputation.chancery));
  });

  it('an old bishop eventually goes and the see changes hands with a new card', () => {
    let s = parishState('succ');
    const bishopId = s.world!.diocese.hidden.bishop.npcId;
    s = { ...s, npcs: { ...s.npcs, [bishopId]: { ...s.npcs[bishopId]!, birthYear: 1940 } } };
    let changed = false;
    for (let i = 0; i < 40 && !changed; i++) {
      const r = successionYear(s, createRng(`s-${i}`));
      if (r.newBishop) {
        changed = true;
        expect(r.state.world!.diocese.hidden.bishop.npcId).toBe(r.newBishop.id);
        expect(r.state.world!.diocese.visible.bishop.yearsInOffice).toBe(0);
        expect(r.state.npcs[bishopId]!.status).not.toBe('active');
        expect(r.lines[0]).toMatch(/Rome has named/);
        expect(r.state.flags.successions).toBe(1);
      }
    }
    expect(changed).toBe(true);
  });
});

describe('systems/projects', () => {
  it('only a pastor starts projects; they cost money weekly and complete with effects', () => {
    const vicar = parishState('proj');
    expect(availableProjects(vicar).every((p) => !p.available)).toBe(true);
    let s: GameState = { ...vicar, assignment: { ...vicar.assignment!, role: 'pastor' } };
    s = { ...s, parish: { ...s.parish!, finance: { ...s.parish!.finance, cash: 900_000 } } };
    const options = availableProjects(s);
    expect(options.find((p) => p.def.type === 'renovation')?.available).toBe(true);
    s = startProject(s, 'renovation');
    expect(() => startProject(s, 'capital_campaign')).toThrow(/One project/);
    const cash0 = s.parish!.finance.cash;
    const parishBefore = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    for (let w = 0; w < 101; w++) {
      s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
      s = projectWeek(s).state;
    }
    expect(s.project).toBeNull();
    expect(s.parish!.finance.cash).toBeLessThan(cash0);
    const parishAfter = s.world!.parishes.find((p) => p.id === s.parish!.parishId)!;
    expect(parishAfter.buildings.church).toBeGreaterThan(parishBefore.buildings.church);
    expect(s.character!.reputation.parishioners).toBeGreaterThan(vicar.character!.reputation.parishioners);
    expect(s.career.filter((e) => e.kind === 'project')).toHaveLength(2);
  });
});

describe('engine/career', () => {
  it('a career year ticks on ordination anniversaries and ages the player; retirement ends the run', () => {
    let s = parishState('life');
    s = { ...s, flags: { ...s.flags, ordination_week: s.clock.week } };
    expect(isCareerYear(s)).toBe(false);
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 52 } };
    expect(isCareerYear(s)).toBe(true);
    const age0 = playerAge(s);
    s = careerYear(s, createRng('cy'));
    expect(s.romeTemperament).toBeDefined();
    const old: GameState = { ...s, character: { ...s.character!, entryYear: 1950, background: { ...s.character!.background, entryAge: 22 } } };
    expect(playerAge(old)).toBeGreaterThan(75);
    let ended = false;
    for (let i = 0; i < 20 && !ended; i++) {
      const r = careerYear(old, createRng(`ret-${i}`));
      if (r.mode.kind === 'ended') {
        ended = true;
        expect(['retired', 'died']).toContain(r.mode.ending);
        expect(r.mode.summary).toMatch(/years a priest/);
      }
    }
    expect(ended).toBe(true);
    expect(age0).toBeGreaterThan(20);
  });

  it('forty years pass through the hook with arcs, boards, and successions, deterministically', () => {
    const play = (seed: string) => {
      let s: GameState = { ...parishState(seed), speed: 'SKIP' };
      s = { ...s, flags: { ...s.flags, ordination_week: s.clock.week } };
      const rng = createRng(seed);
      let boards = 0;
      for (let guard = 0; guard < 400 && s.mode.kind !== 'ended' && s.clock.week < s.parish!.arcStartWeek + 52 * 40; guard++) {
        const r = runClock(s, rng, { maxWeeks: 520, hook: parishWeekHook(noDeps) });
        s = r.state;
        if (s.mode.kind === 'assignment') {
          boards++;
          s = startAssignment({ ...s, mode: { kind: 'clock' } }, rng);
        } else if (s.pending.length) {
          s = { ...s, pending: [] };
        }
      }
      return { s, boards };
    };
    const a = play('forty');
    const b = play('forty');
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(a.boards).toBeGreaterThanOrEqual(3);
    expect(a.s.career.length).toBeGreaterThan(3);
    const roles = new Set(a.s.career.filter((e) => e.kind === 'promotion').map((e) => e.text));
    expect(a.s.mode.kind === 'ended' || a.s.clock.week >= 52 * 39).toBe(true);
    expect(careerSummary(a.s, 'retired')).toMatch(/years a priest/);
    // Something happened in forty years: a promotion or a succession or both.
    expect(roles.size + a.s.career.filter((e) => e.kind === 'succession').length).toBeGreaterThan(0);
  });
});
