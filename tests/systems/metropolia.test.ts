import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { metropoliaDefs, metropoliaOfSee } from '@/content/metropolias';
import { synthPool } from '@/content/dioceses/synth';
import { smallSees, seeDef } from '@/content/sees';
import { diocesePresets } from '@/content/dioceses';
import { generateMetropolia, metropoliaDefFor, poolSeeFor } from '@/generation/metropolia';
import { ensureMetropolia, fillMetropoliaSee, metropoliaLine, metropoliaSees, metropoliaYear, METROPOLIA_YEAR, metropolitanOf, vacantMetropoliaSees } from '@/systems/metropolia';
import { successionYear } from '@/systems/succession';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { inCircle } from '@/systems/circle';
import { parishState } from './week.test';
import type { GameState, Terna } from '@/types';

describe('E2 R1.0: the province as data', () => {
  it('the file covers every preset, every city of the pool, and every small see, with no see in two provinces', () => {
    for (const p of diocesePresets) expect(metropoliaOfSee(p.see)?.rank, p.see).toBe('metropolitan');
    for (const s of synthPool.sees) expect(metropoliaOfSee(s.see, s.state), `${s.see}, ${s.state}`).toBeDefined();
    for (const s of smallSees) expect(metropoliaOfSee(s.see), s.see).toBeDefined();
    const seen = new Map<string, string>();
    for (const d of metropoliaDefs) for (const s of [d.metropolitan, ...d.suffragans]) {
      const key = `${s.see}|${s.state}`;
      expect(seen.get(key), key).toBeUndefined();
      seen.set(key, d.id);
    }
    // Portland is two sees; the state tells them apart.
    expect(metropoliaOfSee('Portland', 'Maine')?.def.id).toBe('metropolia_boston');
    expect(metropoliaOfSee('Portland', 'Oregon')?.rank).toBe('metropolitan');
    expect(poolSeeFor({ see: 'Baker', state: 'Oregon', aliases: ['Baker City'] })?.id).toBe('synth_baker_oregon');
    // A generated city lands in a province of its region.
    expect(metropoliaDefFor('Nowhere', 'Midwest').rank).toBe('suffragan');
  });

  it('the card says where the diocese sits, and only what is public', () => {
    const s = parishState('card');
    const v = s.world!.diocese.visible.metropolia!;
    expect(v.rank).toBe('metropolitan');
    expect(metropoliaLine(v)).toMatch(/metropolitan see of the Province of/);
    expect(metropoliaLine({ ...v, rank: 'suffragan' })).toMatch(/suffragan see of the Province of .*; the archbishop sits at/);
  });
});

describe('E2 R1.0: the province as bishops', () => {
  it('every see of the province but his own has a bishop, rolled the same twice and never the same across seeds', () => {
    const s = parishState('bishops');
    const m = s.world!.metropolia!;
    expect(m.rank).toBe('metropolitan');
    expect(m.sees.length).toBeGreaterThanOrEqual(1);
    expect(m.sees.every((x) => x.see !== s.world!.diocese.visible.see)).toBe(true);
    for (const see of m.sees) {
      const b = s.npcs[see.bishopId!]!;
      expect(b.role).toBe('bishop');
      expect(b.tags).toContain('province_bishop');
      expect(b.tags).toContain(`see:${see.id}`);
      expect(b.title).toBe(see.rank === 'metropolitan' ? 'Archbishop' : 'Bishop');
      expect(see.installedYear).toBeLessThanOrEqual(2010);
    }
    const again = generateMetropolia(createRng(`${s.seed}:metropolia:${s.world!.diocese.presetId}`), s.world!.diocese, 2010);
    expect(again.metropolia.sees.map((x) => x.id)).toEqual(m.sees.map((x) => x.id));
    expect(again.npcs.map((n) => n.name.last)).toEqual(m.sees.map((x) => s.npcs[x.bishopId!]!.name.last));
    // Across seeds the bishops differ in alignment, age, and name: no collapse.
    const aligns = new Set<number>(); const ages = new Set<number>(); const names = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const g = generateMetropolia(createRng(`spread:${i}`), s.world!.diocese, 2010);
      for (const n of g.npcs) { aligns.add(Math.round(n.alignment / 20)); ages.add(2010 - n.birthYear); names.add(n.name.last); }
    }
    expect(aligns.size).toBeGreaterThanOrEqual(5);
    expect(ages.size).toBeGreaterThanOrEqual(10);
    expect(names.size).toBeGreaterThanOrEqual(20);
    // They are the Church's, not his, until something passes between them.
    for (const see of m.sees) expect(inCircle(s.npcs[see.bishopId!]!, s)).toBe(false);
    expect(metropolitanOf(s)).toBeUndefined();
  });

  it('a suffragan see has an archbishop over it', () => {
    const s0 = parishState('suff');
    const diocese = { ...s0.world!.diocese, visible: { ...s0.world!.diocese.visible, see: 'Peoria', region: 'Midwest' } };
    const g = generateMetropolia(createRng('suff'), diocese, 2010);
    expect(g.metropolia.rank).toBe('suffragan');
    expect(g.metropolia.metropolitanSee).toBe('Chicago');
    expect(g.metropolia.sees.find((x) => x.rank === 'metropolitan')?.name).toBe('Archdiocese of Chicago');
    expect(g.metropolia.sees.some((x) => x.see === 'Peoria')).toBe(false);
    const s = { ...s0, world: { ...s0.world!, diocese, metropolia: g.metropolia }, npcs: { ...s0.npcs, ...Object.fromEntries(g.npcs.map((n) => [n.id, n])) } };
    expect(metropolitanOf(s)?.title).toBe('Archbishop');
  });

  it('the year: an old bishop retires and the see is vacant; Rome fills it after a year when the game opened no terna', () => {
    const s0 = parishState('year');
    const see = s0.world!.metropolia!.sees[0]!;
    const old = { ...s0.npcs[see.bishopId!]!, birthYear: 1930 };
    let s: GameState = { ...s0, npcs: { ...s0.npcs, [old.id]: old }, clock: { ...s0.clock, week: 52 } };
    let vacated = false;
    for (let i = 0; i < 12 && !vacated; i++) {
      const r = metropoliaYear({ ...s, clock: { ...s.clock, week: 52 * (i + 1) } }, createRng(`y${i}`));
      s = r.state;
      if (vacantMetropoliaSees(s).some((x) => x.id === see.id)) { vacated = true; expect(r.lines.some((l) => /retired, and the see is vacant/.test(l))).toBe(true); }
    }
    expect(vacated).toBe(true);
    const v = vacantMetropoliaSees(s);
    expect(v.map((x) => x.id)).toContain(see.id);
    expect(s.npcs[old.id]!.status).toBe('retired');
    expect(s.npcs[old.id]!.tags).toContain('bishop_emeritus');
    const later = { ...s, clock: { ...s.clock, week: s.clock.week + METROPOLIA_YEAR.romeFillsAfter } };
    const filled = metropoliaYear(later, createRng('fill'));
    expect(filled.lines.some((l) => /^Rome names .* to /.test(l))).toBe(true);
    const seated = metropoliaSees(filled.state).find((x) => x.id === see.id)!;
    expect(seated.bishopId).toBeDefined();
    expect(seated.vacantSince).toBeUndefined();
    expect(filled.state.npcs[seated.bishopId!]!.tags).toContain('province_bishop');
  });

  it('the nuncio opens the terna for a vacant see of the province first, and the man named takes its chair', () => {
    const s0 = parishState('terna');
    const see = s0.world!.metropolia!.sees.find((x) => x.poolId)!;
    const emptied = { ...see, vacantSince: 100, vacantWhy: 'died' as const };
    delete (emptied as { bishopId?: string }).bishopId;
    let s: GameState = { ...s0, clock: { ...s0.clock, week: 100 }, world: { ...s0.world!, metropolia: { ...s0.world!.metropolia!, sees: s0.world!.metropolia!.sees.map((x) => (x.id === see.id ? emptied : x)) } } };
    s = nuncioWeek(s).state;
    // Run the weeks until a terna opens; it must be that see's.
    let opened: Terna | undefined;
    for (let i = 0; i < 400 && !opened; i++) {
      s = nuncioWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
      opened = (s.rome?.ternas ?? []).find((t) => !t.done);
    }
    expect(opened?.seeId).toBe(see.id);
    expect(opened?.cause).toBe('died');
    // Named: the winner sits.
    for (let i = 0; i < 120; i++) {
      s = nuncioWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
      if ((s.rome?.ternas ?? []).find((t) => t.id === opened!.id)?.done) break;
    }
    const done = (s.rome?.ternas ?? []).find((t) => t.id === opened!.id)!;
    expect(done.done).toBe(true);
    const seated = metropoliaSees(s).find((x) => x.id === see.id)!;
    expect(seated.bishopId).toBeDefined();
    if (done.winner !== 'player') {
      const b = s.npcs[seated.bishopId!]!;
      expect(`${b.name.first} ${b.name.last}`).toBe(done.winnerName);
    }
    // A pool see is a see a bishop can be named to.
    expect(seeDef(see.id)?.synth?.state).toBe(see.state);
  });

  it('fills a see with a man of the game, and with a new man', () => {
    const s = parishState('fill');
    const see = s.world!.metropolia!.sees[0]!;
    const priest = Object.values(s.npcs).find((n) => n.role === 'priest')!;
    const a = fillMetropoliaSee(s, see.id, priest.id, createRng('a'));
    expect(a.bishop?.id).toBe(priest.id);
    expect(a.state.npcs[priest.id]!.tags).toContain(`see:${see.id}`);
    const b = fillMetropoliaSee(s, see.id, 'new', createRng('b'), { first: 'Ambrose', last: 'Kelly' });
    expect(b.bishop?.name).toEqual({ first: 'Ambrose', last: 'Kelly' });
    expect(metropoliaSees(b.state).find((x) => x.id === see.id)!.bishopId).toBe(b.bishop!.id);
  });

  it('a generated see changes bishops too, and a save without a province gets one on load', () => {
    const s0 = parishState('synth');
    const bishop = { ...s0.npcs[s0.world!.diocese.hidden.bishop.npcId]!, birthYear: 1930 };
    let s: GameState = { ...s0, npcs: { ...s0.npcs, [bishop.id]: bishop }, world: { ...s0.world!, diocese: { ...s0.world!.diocese, presetId: 'synth_peoria_illinois' } } };
    let changed = false;
    for (let i = 0; i < 20 && !changed; i++) { const r = successionYear({ ...s, clock: { ...s.clock, week: 52 * (i + 1) } }, createRng(`s${i}`)); s = r.state; changed = !!r.newBishop; }
    expect(changed).toBe(true);
    const bare = { ...s0, world: { ...s0.world! } };
    delete (bare.world as { metropolia?: unknown }).metropolia;
    const back = deserialize(serialize(buildSave(bare, createRng(bare.seed), null, {})));
    expect(back.state.world!.metropolia?.sees.length).toBe(s0.world!.metropolia!.sees.length);
    expect(back.state.world!.metropolia?.sees.map((x) => x.id)).toEqual(s0.world!.metropolia!.sees.map((x) => x.id));
    expect(ensureMetropolia(back.state)).toBe(back.state);
  });
});
