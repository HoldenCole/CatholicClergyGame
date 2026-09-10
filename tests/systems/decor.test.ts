import { describe, it, expect } from 'vitest';
import { achievements, ambientFor, currentDecor, decorOptions, defaultChurchDecor, furnish, gateFor, grantChance, mayFurnish, optionsFor, PERMISSION, petition, previewState, resolvePermissions, slotsFor } from '@/systems/decor';
import { rollLiturgicalPolicy } from '@/generation/bishop';
import { createRng } from '@/engine/rng';
import { LITURGICAL_TOPICS, type LiturgicalPolicy } from '@/types';
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

describe('systems/decor liturgical policy', () => {
  function pastor(seed: string, liturgy: Partial<LiturgicalPolicy> = {}): GameState {
    const base = parishState(seed);
    const world = base.world!;
    const bishop = { ...world.diocese.hidden.bishop, liturgy: { ...world.diocese.hidden.bishop.liturgy, ...liturgy } };
    return {
      ...base,
      assignment: { ...base.assignment!, role: 'pastor' },
      parish: { ...base.parish!, finance: { ...base.parish!.finance, cash: 500000 } },
      world: { ...world, diocese: { ...world.diocese, hidden: { ...world.diocese.hidden, bishop } } },
    };
  }

  it('every bishop rolls a full policy and the population is not uniform', () => {
    const seen: Record<string, Set<string>> = {};
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`policy:${i}`);
      const p = rollLiturgicalPolicy(rng, rng.int(-90, 90), ['finances', 'liturgy'], 'delegator');
      for (const t of LITURGICAL_TOPICS) (seen[t] ??= new Set()).add(p[t]);
    }
    for (const t of LITURGICAL_TOPICS) expect(seen[t]!.size, t).toBeGreaterThanOrEqual(2);
    const prog = rollLiturgicalPolicy(createRng('p'), 80, ['liturgy', 'education'], 'micromanager');
    expect(prog.latin_mass).not.toBe('free');
  });

  it('a forbidden topic cannot be installed or asked for; a free one just happens', () => {
    const closed = pastor('closed', { ad_orientem: 'forbidden', altar_rail: 'free' });
    const orientem = decorOptions.find((o) => o.id === 'orient_orientem')!;
    expect(gateFor(closed, orientem).ok).toBe(false);
    expect(gateFor(closed, orientem).canAsk).toBe(false);
    expect(() => furnish(closed, 'church', 'orient_orientem')).toThrow(/does not permit/);
    expect(() => petition(closed, 'ad_orientem', createRng('x'))).toThrow(/does not permit/);
    expect(furnish(closed, 'church', 'rail_wood').state.decor).toBeTruthy();
  });

  it('a by-permission topic needs a letter, an answer, and then goes through', () => {
    const s = pastor('ask', { ad_orientem: 'by_permission' });
    const orientem = decorOptions.find((o) => o.id === 'orient_orientem')!;
    const gate = gateFor(s, orientem);
    expect(gate.ok).toBe(false);
    expect(gate.canAsk).toBe(true);
    expect(() => furnish(s, 'church', 'orient_orientem')).toThrow(/leave/);
    const asked = petition(s, 'ad_orientem', createRng('ask:rng')).state;
    expect(asked.permissions.ad_orientem?.status).toBe('pending');
    expect(() => petition(asked, 'ad_orientem', createRng('again'))).toThrow(/already written/);
    expect(gateFor(asked, orientem).why).toMatch(/No answer yet/);
    // Nothing answers before the week arrives.
    expect(resolvePermissions(asked, createRng('early')).lines).toHaveLength(0);
    const due: GameState = { ...asked, clock: { ...asked.clock, week: asked.permissions.ad_orientem!.answerWeek } };
    // Force a warm bishop so the roll is a yes at this seed, then a cold one for a no.
    const warm: GameState = { ...due, character: { ...due.character!, reputation: { ...due.character!.reputation, chancery: 100 } }, npcs: { ...due.npcs, [due.world!.diocese.hidden.bishop.npcId]: { ...due.npcs[due.world!.diocese.hidden.bishop.npcId]!, relationship: 100 } } };
    expect(grantChance(warm, 'ad_orientem')).toBeGreaterThan(0.8);
    const yes = resolvePermissions(warm, createRng('yes'));
    expect(yes.lines[0]).toMatch(/grants leave/);
    expect(yes.state.permissions.ad_orientem?.status).toBe('granted');
    expect(yes.state.flags['permission:ad_orientem']).toBe(true);
    const done = furnish(yes.state, 'church', 'orient_orientem');
    expect(currentDecor(done.state, 'church').orientation).toBe('orient_orientem');
    const cold: GameState = { ...due, character: { ...due.character!, reputation: { ...due.character!.reputation, chancery: -100 } }, npcs: { ...due.npcs, [due.world!.diocese.hidden.bishop.npcId]: { ...due.npcs[due.world!.diocese.hidden.bishop.npcId]!, relationship: -100 } } };
    expect(grantChance(cold, 'ad_orientem')).toBeLessThan(0.2);
    let no = resolvePermissions(cold, createRng('no'));
    for (let i = 0; no.state.permissions.ad_orientem?.status !== 'denied' && i < 20; i++) no = resolvePermissions(cold, createRng(`no:${i}`));
    expect(no.state.permissions.ad_orientem?.status).toBe('denied');
    expect(gateFor(no.state, orientem).canAsk).toBe(false);
    expect(() => petition(no.state, 'ad_orientem', createRng('z'))).toThrow(/answered/);
    const later: GameState = { ...no.state, clock: { ...no.state.clock, week: no.state.clock.week + PERMISSION.denialWeeks } };
    expect(gateFor(later, orientem).canAsk).toBe(true);
  });

  it('the Mass form is a slot with a free default and a gated older form', () => {
    const s = pastor('mass', { latin_mass: 'by_permission' });
    expect(currentDecor(s, 'church').mass_form).toBe('mass_vernacular');
    const tlm = decorOptions.find((o) => o.id === 'mass_tlm')!;
    expect(tlm.policy).toBe('latin_mass');
    expect(gateFor(s, tlm).canAsk).toBe(true);
    const latinNo = furnish(s, 'church', 'mass_latin_novus');
    expect(currentDecor(latinNo.state, 'church').mass_form).toBe('mass_latin_novus');
    const preview = previewState(s, 'church', 'mass_tlm');
    expect(currentDecor(preview, 'church').mass_form).toBe('mass_tlm');
    expect(s.decor).toEqual({});
  });
});
