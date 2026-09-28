import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { presetById } from '@/content/dioceses';
import { beginStudy } from '@/engine/study';
import { deserialize, serialize, buildSave } from '@/engine/save';
import { resolveSelector } from '@/engine/selectors';
import { studyWeekHook, type EventDeps } from '@/engine/weekHook';
import { careerYear } from '@/engine/career';
import { homeDioceseId, homeWorld, installSeeWorld, seeWorld } from '@/engine/seeWorld';
import { homeSuccession } from '@/systems/homeFromAfar';
import { readerOf } from '@/systems/rome/policy';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

function candidate(seed: string, see = 'gaylord', extra: Partial<GameState> = {}): GameState {
  const base = parishState(seed);
  const c = base.character!;
  return {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, credentials: [...c.credentials, 'JCL'], reputation: { ...c.reputation, chancery: 72, rome: 40 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true, aux_named: true, vg_served: true, 'nuncio:named_see': see },
    offers: [{ offerId: 'ep_diocesan_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }],
    ...extra,
  };
}

function named(seed: string, see = 'gaylord'): { home: GameState; bishop: GameState } {
  const home = candidate(seed, see);
  return { home, bishop: acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state };
}

const inDiocese = (n: { tags: string[] }, id: string) => n.tags.includes(`diocese:${id}`);

describe('the see as a place with people (E4 R1.0)', () => {
  it('a small see is rolled as a world of its own, with the man in the chair and home waiting in the territory', () => {
    const { home, bishop: b } = named('see-world');
    const homeId = home.world!.diocese.presetId;
    expect(b.see!.dioceseId).toBe('see_gaylord');
    expect(b.world!.diocese.presetId).toBe('see_gaylord');
    expect(b.world!.diocese.visible.see).toBe('Gaylord');
    expect(b.world!.parishes.length).toBeGreaterThanOrEqual(10);
    expect(b.homeDioceseId).toBe(homeId);
    expect(homeDioceseId(b)).toBe(homeId);
    expect(b.territory![homeId]!.parishes).toEqual(home.world!.parishes);
    expect(homeWorld(b)!.diocese.presetId).toBe(homeId);
    expect(seeWorld(b)!.diocese.presetId).toBe('see_gaylord');
    expect(b.flags['diocese:see_gaylord']).toBe(true);
    expect(b.flags[`diocese:${homeId}`]).toBeUndefined();
    // The bishop of the see is the man: his own reading, a policy rolled around it; the predecessor is emeritus.
    const hb = b.world!.diocese.hidden.bishop;
    expect(hb.npcId).toBe('player');
    expect(hb.alignment).toBe(b.character!.alignment);
    expect(hb.liturgy.latin_mass).toBeDefined();
    expect(b.world!.diocese.visible.bishop.name).toContain(b.character!.name.last);
    const emeritus = Object.values(b.npcs).find((n) => n.tags.includes('bishop_emeritus') && inDiocese(n, 'see_gaylord'));
    expect(emeritus?.status).toBe('retired');
    // He reads Rome's documents himself now.
    expect(readerOf(b, 'older_mass')).toBeNull();
  });

  it("the see's people are his own: the selectors find its priests and chancery, and home's men are tagged as home's", () => {
    const { home, bishop: b } = named('see-people');
    const homeId = home.world!.diocese.presetId;
    const seePriests = Object.values(b.npcs).filter((n) => n.role === 'priest' && n.status === 'active' && inDiocese(n, 'see_gaylord'));
    expect(seePriests.length).toBeGreaterThanOrEqual(10);
    const homePriests = Object.values(b.npcs).filter((n) => n.role === 'priest' && inDiocese(n, homeId));
    expect(homePriests.length).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) {
      const p = resolveSelector(b, '@brother_priest', createRng(`p${i}`));
      expect(p && inDiocese(p, 'see_gaylord')).toBe(true);
    }
    const vg = resolveSelector(b, '@vicar_general', createRng('vg'));
    expect(vg && inDiocese(vg, 'see_gaylord') && vg.tags.includes('vicar_general')).toBe(true);
    // The people the see's scenes name by role: the chancery is his.
    for (const sel of ['@chancellor', '@vicar_for_clergy']) expect(resolveSelector(b, sel, createRng(sel))?.tags.includes(`diocese:see_gaylord`)).toBe(true);
    // Nobody of the see shares an id with anybody of home.
    const homeIds = new Set(Object.keys(home.npcs));
    for (const n of seePriests) expect(homeIds.has(n.id)).toBe(false);
  });

  it('a great see is its preset, with the real map under it', () => {
    const home = candidate('great', 'gaylord');
    const great = presetById(home.world!.diocese.presetId === 'chicago' ? 'boston' : 'chicago')!;
    const b = acceptAndGo({ ...home, flags: { ...home.flags, 'nuncio:named_see': great.id } }, offerById('ep_diocesan_bishop')!, createRng('great')).state;
    expect(b.see!.id).toBe(great.id);
    expect(b.world!.diocese.presetId).toBe(great.id);
    expect(presetById(b.world!.diocese.presetId)).toBeDefined();
    expect(b.world!.diocese.hidden.bishop.npcId).toBe('player');
    expect(Object.values(b.npcs).some((n) => n.role === 'priest' && inDiocese(n, great.id))).toBe(true);
  });

  it('the home see changes hands in the territory, as news from home; the see stays his', () => {
    const { home, bishop: b } = named('see-home');
    const homeId = home.world!.diocese.presetId;
    const oldBishop = home.world!.diocese.hidden.bishop.npcId;
    const year = 2017 + Math.floor(b.clock.week / 52);
    const aged = { ...b, npcs: { ...b.npcs, [oldBishop]: { ...b.npcs[oldBishop]!, birthYear: year - 80 } } };
    let r = homeSuccession(aged, createRng('x'));
    for (let i = 0; i < 40 && !r.letter; i++) r = homeSuccession(aged, createRng(`s${i}`));
    expect(r.letter?.title).toMatch(/^From home/);
    expect(r.state.world!.diocese.presetId).toBe('see_gaylord');
    expect(r.state.world!.diocese.hidden.bishop.npcId).toBe('player');
    expect(r.state.territory![homeId]!.diocese.hidden.bishop.npcId).not.toBe(oldBishop);
    expect(r.state.territory![homeId]!.diocese.hidden.bishop.npcId.startsWith(`${homeId}:`)).toBe(true);
    // The year through the engine: a letter from home may come, and never a succession beat of his own.
    const y = careerYear({ ...aged, clock: { ...aged.clock, week: aged.clock.week + 52 } }, createRng('cy'));
    expect(y.world!.diocese.hidden.bishop.npcId).toBe('player');
    expect(y.beats.some((x) => x.kind === 'succession')).toBe(false);
  });

  it('a translation stashes the first see and rolls the second; home stays home', () => {
    const { home, bishop: b } = named('see-move');
    const homeId = home.world!.diocese.presetId;
    const moved = beginStudy({ ...b, flags: { ...b.flags, bishop_of_a_see: true } }, offerById('ep_translation')!, false, createRng('move'));
    expect(moved.see!.id).not.toBe('gaylord');
    expect(moved.see!.former?.at(-1)?.id).toBe('gaylord');
    expect(moved.world!.diocese.presetId).toBe(moved.see!.dioceseId);
    expect(moved.territory!['see_gaylord']).toBeDefined();
    expect(moved.territory![homeId]).toBeDefined();
    expect(moved.homeDioceseId).toBe(homeId);
    expect(moved.world!.diocese.hidden.bishop.npcId).toBe('player');
  });

  it('installing is idempotent, survives a save, and a see from before it had a world gets one from the seed', () => {
    const { home, bishop: b } = named('see-save');
    expect(installSeeWorld(b, createRng('again'))).toEqual(b);
    const saved = serialize(buildSave(b, createRng(b.seed), null, {}));
    const back = deserialize(saved).state;
    expect(serialize(buildSave(back, createRng(b.seed), null, {}))).toBe(saved);
    expect(back.see).toEqual(b.see);
    expect(Object.keys(back.territory!)).toEqual(Object.keys(b.territory!));
    // An old save: the see with no world of its own, home as the world.
    const { dioceseId: _d, ...oldSee } = b.see!;
    const { homeDioceseId: _h, territory: _t, ...rest } = b;
    const old: GameState = { ...rest, see: oldSee, world: home.world, npcs: home.npcs, flags: { ...b.flags, [`diocese:${home.world!.diocese.presetId}`]: true } };
    delete (old.flags as Record<string, unknown>)['diocese:see_gaylord'];
    const deps: EventDeps = { pool: [], lookup: () => undefined, offerLookup: (id) => offerById(id) };
    const after = studyWeekHook(deps)({ ...old, clock: { ...old.clock, week: old.clock.week + 1 } }, createRng('hook'), []);
    expect(after.see!.dioceseId).toBe('see_gaylord');
    expect(after.world!.diocese.presetId).toBe('see_gaylord');
    expect(after.territory![home.world!.diocese.presetId]).toBeDefined();
  });
});
