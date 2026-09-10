import { describe, it, expect } from 'vitest';
import { achievements, ambientFor, currentDecor, defaultChurchDecor, furnish, mayFurnish, optionsFor, slotsFor } from '@/systems/decor';
import { parishState } from './week.test';
import type { GameState } from '@/types';

describe('systems/decor', () => {
  it('content covers every church slot with a free default and priced alternatives', () => {
    for (const slot of slotsFor('church')) {
      const opts = optionsFor('church', slot);
      expect(opts.length, slot).toBeGreaterThanOrEqual(2);
      expect(opts.some((o) => o.cost === 0), slot).toBe(true);
    }
    expect(slotsFor('office').length).toBeGreaterThanOrEqual(3);
    expect(slotsFor('rectory').length).toBeGreaterThanOrEqual(2);
  });

  it('a traditional parish gets a rail and booths; a progressive one does not', () => {
    const s = parishState('decor');
    const parish = s.world!.parishes[0]!;
    const trad = defaultChurchDecor({ ...parish, alignment: -50, wealth: 2 });
    const prog = defaultChurchDecor({ ...parish, alignment: 50, wealth: 4 });
    expect(trad.altar_rail).toBe('rail_wood');
    expect(trad.sanctuary).toBe('sanct_high_altar');
    expect(prog.altar_rail).toBe('rail_none');
    expect(prog.choir).toBe('choir_front');
    expect(currentDecor(s, 'church').sanctuary).toBeTruthy();
  });

  it('only a pastor furnishes the church; anyone furnishes his office', () => {
    const vicar = parishState('auth');
    expect(mayFurnish(vicar, 'church').ok).toBe(false);
    expect(mayFurnish(vicar, 'office').ok).toBe(true);
    expect(() => furnish(vicar, 'church', 'rail_wood')).toThrow(/pastor/);
    const r = furnish(vicar, 'office', 'ocorner_plant');
    expect(currentDecor(r.state, 'office').corner).toBe('ocorner_plant');
    expect(r.state.parish!.finance.cash).toBe(vicar.parish!.finance.cash);
  });

  it('a church change costs cash and provokes a reaction sized by the gap', () => {
    const base = parishState('react');
    const pastor: GameState = { ...base, assignment: { ...base.assignment!, role: 'pastor' }, parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 200000 } } };
    const parishId = pastor.parish!.parishId;
    const trad: GameState = { ...pastor, world: { ...pastor.world!, parishes: pastor.world!.parishes.map((p) => (p.id === parishId ? { ...p, alignment: -60 } : p)) } };
    const prog: GameState = { ...pastor, world: { ...pastor.world!, parishes: pastor.world!.parishes.map((p) => (p.id === parishId ? { ...p, alignment: 60 } : p)) } };
    const a = furnish(trad, 'church', 'rail_marble');
    const b = furnish(prog, 'church', 'rail_marble');
    expect(a.state.parish!.finance.cash).toBe(200000 - 42000);
    expect(a.state.character!.reputation.parishioners).toBeGreaterThan(b.state.character!.reputation.parishioners);
    expect(a.state.character!.reputation.traditional_bloc).toBeGreaterThan(0);
    expect(b.line).toMatch(/Letters/);
    expect(b.state.world!.parishes.find((p) => p.id === parishId)!.alignment).toBeLessThan(60);
    expect(a.state.career.some((e) => /Changed the church/.test(e.text))).toBe(true);
    const broke: GameState = { ...trad, parish: { ...trad.parish!, finance: { ...trad.parish!.finance, cash: 100 } } };
    expect(() => furnish(broke, 'church', 'rail_marble')).toThrow(/cannot pay/);
    const o = furnish(trad, 'church', 'orient_orientem');
    expect(o.state.character!.outspokenness).toBeGreaterThan(trad.character!.outspokenness);
  });

  it('the room reacts to the man: books, prayer, clippings, family, archetype, achievements', () => {
    const s = parishState('ambient');
    const c = s.character!;
    const learned: GameState = { ...s, character: { ...c, stats: { ...c.stats, theology: 80, knowledge: 80, piety: 70, administration: 70 }, outspokenness: 60, archetype: 'missionary', credentials: ['STL'] }, flags: { ...s.flags, ordained: true, published: true } };
    const items = ambientFor(learned, 'office');
    const layers = Object.fromEntries(items.map((i) => [i.layer, i.variant]));
    expect(layers.books).toBe('wall');
    expect(layers.prayer).toBe('candle');
    expect(layers.clippings).toBe('pinned');
    expect(layers.desk_state).toBe('tidy');
    expect(layers.archetype).toBe('map');
    expect(layers.diploma).toBe('framed');
    expect(items.some((i) => i.layer === 'achievement:frame' && i.variant === 'published')).toBe(true);
    expect(achievements(learned).map((a) => a.id)).toEqual(expect.arrayContaining(['ordained', 'published']));
    const dull: GameState = { ...s, character: { ...c, stats: { ...c.stats, theology: 30, knowledge: 30, piety: 20, administration: 30 } } };
    const d = Object.fromEntries(ambientFor(dull, 'office').map((i) => [i.layer, i.variant]));
    expect(d.books).toBe('few');
    expect(d.prayer).toBe('cold');
    expect(d.desk_state).toBe('piles');
  });
});
