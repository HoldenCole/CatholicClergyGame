import { describe, it, expect } from 'vitest';
import { nuncioWeek, dueNuncioScene, NUNCIO, makeNuncio } from '@/systems/rome/nuncio';
import { nuncioView } from '@/systems/rome/nuncioView';
import { resolveSelector } from '@/engine/selectors';
import { isOfferEligible, offerWeight, romeTrust } from '@/engine/offers';
import { offerById, allOffers } from '@/content/offers';
import { renderText } from '@/engine/text';
import { allEvents } from '@/content';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { sundayOf } from '@/engine/time';
import { parishState } from './week.test';
import type { GameState, IssuedDocument } from '@/types';

function run(state: GameState, weeks: number, stop?: (s: GameState) => boolean): GameState {
  let s = state;
  for (let i = 0; i < weeks; i++) {
    s = { ...s, clock: { ...s.clock, week: s.clock.week + 1 } };
    s = nuncioWeek(s).state;
    if (stop?.(s)) break;
  }
  return s;
}

/** A pastor of seventeen years with a good name at the chancery and in Rome, a canon lawyer who served as vicar general. */
function veteran(seed: string): GameState {
  const base = nuncioWeek(parishState(seed)).state;
  const c = base.character!;
  return {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    // A Roman alumnus and a vicar general: the credits that keep a pastor's reading at the terna's threshold once Rome's regard has rested.
    flags: { ...base.flags, ordination_week: base.clock.week - 17 * 52, vg_served: true, rome_alumnus: true },
    character: { ...c, entryYear: 2000, background: { ...c.background, entryAge: 22 }, credentials: [...c.credentials, 'JCL'], reputation: { ...c.reputation, rome: 50, chancery: 60 }, outspokenness: 20, positions: [] },
  };
}

const doc = (title: string, implemented: IssuedDocument['implemented']): IssuedDocument => ({ id: `hist:${title}`, kind: 'motu_proprio', title, gist: '', day: 0, week: 0, popeId: 'hist:francis', axis: 'older_mass', value: 'faculties', from: 'free', ...(implemented ? { implemented } : {}) });

/** The same man with a different record: he would not put Rome's documents into effect, and said so, loudly, against the nuncio's reading. */
function withRecord(s: GameState, faithful: boolean): GameState {
  const temper = s.rome!.nuncio!.temperament;
  const issued = [doc('Traditionis Custodes', faithful ? 'faithful' : 'defiant'), doc('Fiducia Supplicans', faithful ? 'faithful' : 'defiant')];
  const c = s.character!;
  const positions = faithful ? [] : [1, 2, 3].map((w) => ({ topic: 'authority', value: temper >= 0 ? -85 : 85, volume: 'public' as const, week: w }));
  return { ...s, rome: { ...s.rome!, issued }, character: { ...c, positions, outspokenness: faithful ? 20 : 75 } };
}

describe('the nuncio', () => {
  it('is a generated archbishop in Washington from the first week, and the same in the same world', () => {
    const s = nuncioWeek(parishState('nuncio')).state;
    const n = s.rome!.nuncio!;
    const npc = resolveSelector(s, '@nuncio')!;
    expect(npc.id).toBe(n.npcId);
    expect(npc.title).toBe('Archbishop');
    expect(npc.tags).toContain('nuncio');
    expect(nuncioWeek(parishState('nuncio')).state.rome!.nuncio).toEqual(n);
    // His reading follows the pope who sent him, with a man's own variance.
    const made = makeNuncio('x', 2, sundayOf(s.clock), 60);
    expect(Math.abs(made.nuncio.temperament - 60)).toBeLessThan(80);
    expect(made.nuncio.leavesDay - made.nuncio.arrivedDay).toBeGreaterThanOrEqual(NUNCIO.termYears[0] * 365);
  });

  it('is recalled after his years, and sooner when a new pope wants his own man', () => {
    let s = nuncioWeek(parishState('rotate')).state;
    const first = s.rome!.nuncio!;
    s = run(s, 52 * 8, (x) => x.rome!.nuncio!.npcId !== first.npcId);
    expect(s.rome!.nuncio!.npcId).not.toBe(first.npcId);
    expect(s.npcs[first.npcId]!.status).toBe('retired');
    expect(s.rome!.nuncios).toBe(2);
    // A pope elected after he came recalls him within a little over a year.
    const pope = { ...s.rome!.popes.at(-1)!, id: 'gen:new', electedDay: sundayOf(s.clock) };
    const t: GameState = { ...s, rome: { ...s.rome!, popes: [...s.rome!.popes, pope], nuncio: { ...s.rome!.nuncio!, arrivedDay: sundayOf(s.clock) - 30, leavesDay: sundayOf(s.clock) + 5 * 365 } } };
    // Half of new popes do; across popes, some recall him and some leave him his years.
    const outcomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => {
      const p = { ...pope, id: `gen:${k}` };
      const u: GameState = { ...t, rome: { ...t.rome!, popes: [...s.rome!.popes, p] } };
      return nuncioWeek(u).state.rome!.nuncio!.leavesDay <= p.electedDay + NUNCIO.newPopeDays[1];
    });
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });
});

describe("the nuncio's reading of a man", () => {
  it('two men with the same stats and different records read differently, and for reasons', () => {
    const s = veteran('view');
    const good = nuncioView(withRecord(s, true));
    const bad = nuncioView(withRecord(s, false));
    expect(good.value).toBeGreaterThanOrEqual(NUNCIO.candidate.view);
    expect(bad.value).toBeLessThan(NUNCIO.consult.view);
    expect(good.good).toContain('you put Traditionis Custodes into effect');
    expect(bad.bad).toContain('you would not put Traditionis Custodes into effect');
    expect(bad.bad).toContain('you are a loud man');
  });

  it('two men with the same stats and different records get different letters', () => {
    // The same world, the same weeks: sees fall vacant for both, and the nuncio reads them differently.
    let named: GameState | null = null;
    let other: GameState | null = null;
    for (const seed of ['letters', 'letters:2', 'letters:3', 'letters:4', 'letters:5', 'letters:6', 'letters:7', 'letters:8']) {
      const faithful = withRecord(veteran(seed), true);
      const run1 = run(faithful, 52 * 25, (x) => typeof x.flags['nuncio:named_see'] === 'string');
      const defiant = withRecord(veteran(seed), false);
      const run2 = run(defiant, run1.clock.week - defiant.clock.week);
      expect(run2.flags.terna_named, seed).toBeFalsy();
      if (typeof run1.flags['nuncio:named_see'] === 'string') { named = run1; other = run2; break; }
    }
    if (!named || !other) throw new Error('no world named the faithful man in twenty-five years');
    expect(named.flags.terna_named).toBe(true);
    expect(typeof named.flags['nuncio:named_see']).toBe('string');
    expect(other.flags.terna_named).toBeFalsy();
    expect(other.flags['nuncio:named_see']).toBeUndefined();
    expect((other.rome!.ternas ?? []).some((t) => t.player)).toBe(false);
    // The letter comes to the one, not the other, and it reads his file back to him.
    const see = offerById('ep_diocesan_bishop')!;
    expect(isOfferEligible(see, named)).toBe(true);
    expect(isOfferEligible(see, other)).toBe(false);
    const body = renderText(see.body, named);
    expect(body).toMatch(/The see of [A-Z][a-z]/);
    expect(body).toContain('He has read your file: ');
    expect(body).not.toMatch(/\{/);
  });

  it('a man is asked about another priest before he is ever on a list, and the scene can be played', () => {
    const s = veteran('consult');
    const mid: GameState = { ...s, flags: { ...s.flags, ordination_week: s.clock.week - 10 * 52 } };
    const asked = run(mid, 52 * 20, (x) => x.rome!.nuncioScene?.kind === 'consulted');
    expect(asked.rome!.nuncioScene?.kind).toBe('consulted');
    const due = run(asked, 12, (x) => dueNuncioScene(x) === 'consulted');
    expect(resolveSelector(due, '@terna_subject')).toBeTruthy();
    const scenes = allEvents.filter((e) => e.beat === 'nuncio' && isEligible(e, due) && evaluateAll(e.requires ?? [], due));
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((e) => e.id.startsWith('nu_consulted'))).toBe(true);
  });

  it('names no one while the see of Rome is vacant', () => {
    const s = veteran('vacant');
    const vacant: GameState = { ...s, rome: { ...s.rome!, vacancy: { sinceDay: 0, electionDay: 1e9, cause: 'died', priorId: s.rome!.popes.at(-1)!.id } } };
    const after = run(vacant, 52 * 6);
    expect(after.rome!.ternas ?? []).toEqual([]);
  });
});

describe('Rome in trust', () => {
  it("a chancery post comes likelier to a man Rome thinks well of", () => {
    const s = veteran('trust');
    const chancery = allOffers.find((o) => o.category === 'chancery' && o.cluster !== 'episcopal')!;
    const low: GameState = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, rome: -60 } } };
    expect(romeTrust(s)).toBeCloseTo(1.2);
    expect(offerWeight(chancery, s)).toBeGreaterThan(offerWeight(chancery, low));
  });
});
