import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { evaluateAll } from '@/engine/conditions';
import { renderText } from '@/engine/text';
import { seeYear } from '@/engine/see';
import { deserialize, serialize, buildSave } from '@/engine/save';
import { councilCold, councilOf, councilRegard, nameToCouncil, PRESBYTERATE, presbyterateYear } from '@/systems/bishop/presbyterate';
import { beginAct, signAct } from '@/systems/bishop/desk';
import { parishOf, priestsOfSee } from '@/systems/bishop/directions';
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
const year = (s: GameState, n = 1): GameState => ({ ...s, clock: { ...s.clock, week: s.clock.week + 52 * n } });
const withRegard = (s: GameState, r: number): GameState => ({ ...s, npcs: Object.fromEntries(Object.entries(s.npcs).map(([id, n]) => [id, priestsOfSee(s).some((p) => p.id === id) ? { ...n, relationship: r } : n])) });

describe('the presbyterate as people (E4 R1.5)', () => {
  it('the chair finds a council of priests: elected men and the vicar general; the bishop names a man to it', () => {
    const s = bishop('pres-council');
    const c = s.see!.council!;
    expect(c.electedIds.length).toBe(PRESBYTERATE.council.elected);
    expect(councilOf(s).length).toBe(c.electedIds.length + c.namedIds.length);
    for (const n of councilOf(s)) expect(priestsOfSee(s).some((p) => p.id === n.id)).toBe(true);
    const vg = priestsOfSee(s).find((n) => n.tags.includes('vicar_general'))!;
    expect([...c.electedIds, ...c.namedIds]).toContain(vg.id);
    const man = priestsOfSee(s).find((n) => !c.electedIds.includes(n.id) && !c.namedIds.includes(n.id))!;
    const named = nameToCouncil(s, man.id);
    expect(named.see!.council!.namedIds).toContain(man.id);
    expect(named.see!.council!.namedIds.length).toBeLessThanOrEqual(PRESBYTERATE.council.named);
    expect(nameToCouncil(named, man.id)).toEqual(named);
  });

  it('the year: old men die and retire and leave their parishes vacant; the council is renewed on its term; the losses are kept', () => {
    const s = bishop('pres-year');
    const old = priestsOfSee(s).filter((n) => parishOf(s, n)).slice(0, 3);
    const aged: GameState = { ...s, npcs: { ...s.npcs, ...Object.fromEntries(old.map((n) => [n.id, { ...n, birthYear: 1935 }])) } };
    let out = presbyterateYear(year(aged), createRng('py'));
    for (let i = 0; i < 20 && !(out.state.see!.losses?.length); i++) out = presbyterateYear(year(aged), createRng(`py${i}`));
    expect(out.state.see!.losses!.length).toBeGreaterThan(0);
    for (const l of out.state.see!.losses!) {
      const n = out.state.npcs[l.npcId]!;
      expect(['dead', 'retired']).toContain(n.status);
      expect(n.tags.some((t) => t.startsWith('pastor:'))).toBe(false);
      const p = parishOf(aged, aged.npcs[l.npcId]!)!;
      expect(out.state.world!.parishes.find((x) => x.id === p.id)!.pastorId).toBe('');
    }
    expect(out.lines.length).toBeGreaterThan(0);
    const scene = out.state.flags['presbyterate:died'] ? 'bp_pres_funeral' : 'bp_pres_retirement';
    expect(evaluateAll(eventById(scene)!.requires, out.state)).toBe(true);
    expect(renderText(eventById(scene)!.body, out.state)).toContain(out.state.flags['presbyterate:man'] as string);
    // The council's term: five years on, the presbyterate elects again.
    const later = presbyterateYear(year(s, 6), createRng('term'));
    expect(later.state.see!.council!.electedWeek).toBe(s.clock.week + 52 * 6);
    expect(later.state.flags['presbyterate:council']).toBe(true);
    expect(evaluateAll(eventById('bp_pres_council')!.requires, later.state)).toBe(true);
  });

  it('the dial follows the men, and a wing that has had enough writes to the nuncio', () => {
    const s = bishop('pres-dial');
    const warm = presbyterateYear(year(withRegard(s, 80)), createRng('w'));
    expect(warm.state.see!.presbyterate).toBeGreaterThan(s.see!.presbyterate);
    const cold = presbyterateYear(year(withRegard(s, -80)), createRng('c'));
    expect(cold.state.see!.presbyterate).toBeLessThan(s.see!.presbyterate);
    let wrote: GameState | null = null;
    const low = { ...withRegard(s, -90), see: { ...s.see!, presbyterate: -60 } };
    for (let i = 0; i < 20 && !wrote; i++) {
      const o = presbyterateYear(year(low, i + 1), createRng(`n${i}`));
      if (o.state.flags['presbyterate:nuncio']) wrote = o.state;
    }
    expect(wrote).not.toBeNull();
    expect(wrote!.see!.rome).toBe(s.see!.rome + PRESBYTERATE.nuncio.rome);
    expect(evaluateAll(eventById('bp_pres_nuncio')!.requires, wrote!)).toBe(true);
    // Through the see's year, the lines reach the letter.
    const sy = seeYear(year(low), createRng('n0'));
    expect(sy.letter.body.join(' ').length).toBeGreaterThan(0);
  });

  it("the council's cold regard makes a decree and a closing cost the presbyterate more", () => {
    const s = bishop('pres-cold');
    const cold = withRegard(s, -60);
    expect(councilCold(cold)).toBe(true);
    expect(councilRegard(cold)).toBe(-60);
    const warm = withRegard(s, 60);
    expect(councilCold(warm)).toBe(false);
    const stance = s.world!.diocese.hidden.bishop.liturgy.latin_mass === 'forbidden' ? 'free' : 'forbidden';
    const a = signAct(beginAct(cold, 'decree_liturgy', { topic: 'latin_mass', stance }))!;
    const b = signAct(beginAct(warm, 'decree_liturgy', { topic: 'latin_mass', stance }))!;
    expect(b.state.see!.presbyterate - warm.see!.presbyterate - (a.state.see!.presbyterate - cold.see!.presbyterate)).toBe(PRESBYTERATE.coldCost.decree);
  });

  it('the council survives a save', () => {
    const s = bishop('pres-save');
    const back = deserialize(serialize(buildSave(s, createRng(s.seed), null, {}))).state;
    expect(back.see!.council).toEqual(s.see!.council);
  });
});
