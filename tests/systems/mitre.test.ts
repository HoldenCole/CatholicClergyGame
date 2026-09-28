import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { beginStudy } from '@/engine/study';
import { isOfferEligible, offerWeight } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { papalHistory, collegePools } from '@/content/rome';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { contendersOf, electorsOf, nameableByTheOrder, PLAYER_ID } from '@/systems/religious/electorate';
import { BISHOP_FLAG, POPE_OF_ORDER, friarNamedBishop, popeOfHisOrder, popeOfTheOrderWeek } from '@/systems/religious/mitre';
import { mayBeCandidate } from '@/systems/rome/nuncio';
import { nuncioView } from '@/systems/rome/nuncioView';
import { collegeWeek, makeCardinal, mayBeCreated } from '@/systems/rome/college';
import { generatePope, papacyWeek } from '@/systems/rome/papacy';
import { sundayOf } from '@/engine/time';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import type { GameState, OrderKey, Papacy } from '@/types';

/** A solemnly professed priest of fifty, a former provincial, with Rome seeded. */
function friar(seed: string, order: OrderKey = 'OP', patch: Partial<NonNullable<GameState['religious']>> = {}): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'curia')!;
  const base = seminaryState(seed);
  let s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 70, charisma: 65, theology: 60, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained: true, ordination_week: -52 * 20 } }, gen, 2010, priory.id);
  const c = s.character!;
  s = { ...s, phase: 'pastor', character: { ...c, reputation: { ...c.reputation, order: 70, province: 60, rome: 40 } }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 }, perceivedAmbition: 5, legibility: 80, termsServed: [{ office: 'provincial', startWeek: -400, endWeek: -200 }], ...patch } };
  return papacyWeek(s).state;
}

describe('the friar and the mitre (E3 §16B)', () => {
  it('the nuncio reads a friar by the province and the provincial, and credits the offices of the order', () => {
    const s = friar('view');
    const v = nuncioView(s);
    expect(v.good).toContain('the years as provincial');
    // The province's regard stands in for the chancery's; the provincial's letter for the bishop's.
    const warm = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, province: 100 } } };
    expect(nuncioView(warm).value).toBeGreaterThan(v.value);
    const pid = s.province!.provincialId;
    const cool = { ...s, npcs: { ...s.npcs, [pid]: { ...s.npcs[pid]!, relationship: -40 } } };
    expect(nuncioView(cool).bad).toContain("your provincial's letter, which was cool");
    const general = { ...s, flags: { ...s.flags, 'general:served': true } };
    expect(nuncioView(general).good).toContain('the years at the head of the order');
  });

  it('a friar may be a candidate when professed and at home; not from Rome, not as head of the order, not twice', () => {
    const s = friar('cand');
    expect(mayBeCandidate(s)).toBe(true);
    expect(mayBeCandidate({ ...s, religious: { ...s.religious!, vows: { renewals: [] } } })).toBe(false);
    expect(mayBeCandidate({ ...s, religious: { ...s.religious!, office: { office: 'general', bodyId: 'OP', startWeek: 0, endWeek: 400, consecutive: 1 } } })).toBe(false);
    expect(mayBeCandidate({ ...s, flags: { ...s.flags, refused_mitre: true } })).toBe(false);
  });

  it("the provincial's letters offer the mitre to a friar, the bishop's never do, and the nuncio's translation reaches either bishop", () => {
    const s = { ...friar('offer'), flags: { ...friar('offer').flags, aux_named: true } };
    const mine = offerById('fr_auxiliary_bishop')!;
    const theirs = offerById('ep_auxiliary_bishop')!;
    const withView = { ...s, character: { ...s.character!, reputation: { ...s.character!.reputation, rome: 80, province: 100 } } };
    expect(isOfferEligible(mine, withView)).toBe(true);
    expect(isOfferEligible(theirs, withView)).toBe(false);
    expect(offerById('ep_translation')!.campaign).toBe('any');
  });

  it('named a bishop, he lays his office down, is off every ballot for good, and the province writes it as a loss', () => {
    const s = friar('mitre', 'OP', { office: { office: 'provincial', bodyId: 'x', startWeek: -100, endWeek: 300, consecutive: 1 } });
    const off = { ...s, flags: { ...s.flags, 'office:provincial': -100, aux_named: true }, province: { ...s.province!, provincialId: PLAYER_ID } };
    const def = offerById('fr_auxiliary_bishop')!;
    const away = beginStudy({ ...off, flags: { ...off.flags, ordained_bishop: true } }, def, false, createRng('go'));
    expect(away.study?.city).toBe('auxiliary');
    expect(away.religious!.office).toBeUndefined();
    expect(away.province!.provincialId).toBe('');
    expect(away.flags[BISHOP_FLAG]).toBe(away.clock.week);
    expect(away.religious!.termsServed.at(-1)!.office).toBe('provincial');
    expect((away.letters ?? []).some((l) => l.title === 'From the provincial, on the mitre')).toBe(true);
    expect(away.career.some((e) => /Named a bishop/.test(e.text))).toBe(true);
    // Once a bishop, never an elector nor a contender, at home or in the order at large.
    const houseId = away.religious!.houseId;
    expect(electorsOf(away, 'house', houseId).some((v) => v.isPlayer)).toBe(false);
    expect(contendersOf(away, 'prior', houseId).some((c) => c.isPlayer)).toBe(false);
    expect(contendersOf(away, 'provincial', away.religious!.provinceId).some((c) => c.isPlayer)).toBe(false);
    expect(nameableByTheOrder(away)).toBe(false);
    // Twice is once.
    expect(friarNamedBishop(away)).toBe(away);
  });

  it('a friar bishop of a great see, whom Rome regards, may be created a cardinal', () => {
    const s = friar('hat');
    const day = s.clock.startDay + s.clock.week * 7;
    const c = s.character!;
    const see: NonNullable<GameState['see']> = { id: 'chicago', name: 'Archdiocese of Chicago', see: 'Chicago', region: 'Midwest', installedWeek: 0, presbyterate: 0, people: 0, rome: 20, money: 0, shortage: 3, ordinations: 0, closings: 0, years: ['1', '2', '3'] };
    const bishop = { ...s, see, flags: { ...s.flags, ordained_bishop: true, bishop_of_a_see: true }, character: { ...c, entryYear: 1976, reputation: { ...c.reputation, rome: 60 } } };
    expect(mayBeCreated(bishop, day)).toBe(true);
    expect(mayBeCreated({ ...bishop, flags: { ...s.flags } }, day)).toBe(false);
  });

  it('the College and the popes carry their orders: a share of cardinals, the record\'s Jesuit, an elected cardinal\'s order kept', () => {
    let religious = 0;
    for (let n = 1; n <= 600; n++) if (makeCardinal('orders', n, 20000, { id: 'gen:1', temperament: 0 }).order) religious++;
    expect(religious / 600).toBeGreaterThan(collegePools.religiousShare - 0.06);
    expect(religious / 600).toBeLessThan(collegePools.religiousShare + 0.06);
    expect(papalHistory.find((h) => h.key === 'francis')!.order).toBe('SJ');
    const made = generatePope('keep', 1, 20500, [], {}, { born: 1950, from: 'Italy', temperament: 0, order: 'OSA', confrereId: 'friar_x' });
    expect(made.pope.order).toBe('OSA');
    expect(made.pope.confrereId).toBe('friar_x');
    expect(made.pope.line).toMatch(/an Augustinian/);
  });

  it('a consistory may make a cardinal of a friar of his own province, when the pope creates one of his order', { timeout: 60_000 }, () => {
    let found: { seed: string; npcId: string } | null = null;
    for (let i = 0; i < 160 && !found; i++) {
      let s = friar(`red-${i}`);
      const day = sundayOf(s.clock);
      s = collegeWeek(s).state;
      s = { ...s, rome: { ...s.rome!, nextConsistoryDay: day } };
      const after = collegeWeek(s).state;
      const ours = (after.rome!.college ?? []).find((c) => c.npcId);
      if (ours) found = { seed: `red-${i}`, npcId: ours.npcId! };
      if (ours) {
        const npc = after.npcs[ours.npcId!]!;
        expect(npc.tags).toContain(`order:${after.religious!.order}`);
        expect(ours.order).toBe(after.religious!.order);
        expect(ours.name).toBe(`${npc.name.first} ${npc.name.last}`);
      }
    }
    expect(found).not.toBeNull();
  });

  it('a pope of his order: the flag, the letter, Rome\'s regard once; a confrere elected, the rarer flag and the man himself', () => {
    const s = friar('pope');
    const popes = s.rome!.popes;
    const last = popes[popes.length - 1]!;
    const ours: Papacy = { ...last, order: s.religious!.order };
    const world = { ...s, rome: { ...s.rome!, popes: [...popes.slice(0, -1), ours] } };
    expect(popeOfHisOrder(world)).toBe(true);
    const rome0 = world.character!.reputation.rome ?? 0;
    const next = popeOfTheOrderWeek(world);
    expect(next.flags['pope:own_order']).toBe(ours.id);
    expect(next.character!.reputation.rome).toBe(rome0 + POPE_OF_ORDER.rome);
    expect((next.letters ?? []).some((l) => l.title === 'One of ours')).toBe(true);
    expect(popeOfTheOrderWeek(next)).toBe(next);
    // The order's letters come likelier while he reigns.
    const def = offerById('fr_auxiliary_bishop')!;
    expect(offerWeight(def, next) / offerWeight(def, { ...s, flags: next.flags })).toBeCloseTo(POPE_OF_ORDER.offerBoost, 5);
    // A confrere of the province.
    const brother = Object.values(s.npcs).find((n) => n.role === 'religious' && n.tags.includes('vows:solemn') && n.title === 'Fr.')!;
    const confrere = { ...world, rome: { ...world.rome!, popes: [...popes.slice(0, -1), { ...ours, confrereId: brother.id }] } };
    const shock = popeOfTheOrderWeek(confrere);
    expect(shock.flags['pope:confrere']).toBe(ours.id);
    expect(shock.npcs[brother.id]!.title).toBe('Pope');
    expect((shock.letters ?? []).some((l) => l.title === 'One of ours, from this province')).toBe(true);
  });

  it('a friar bishop survives a save', () => {
    const s = friar('save');
    const def = offerById('fr_diocesan_bishop')!;
    const away = beginStudy({ ...s, flags: { ...s.flags, 'nuncio:named_see': 'gaylord', ordained_bishop: true, bishop_of_a_see: true } }, def, false, createRng('see'));
    expect(away.see).toBeDefined();
    const back = deserialize(serialize(buildSave(away, createRng(away.seed), null, {})));
    expect(back.state.flags[BISHOP_FLAG]).toBe(away.flags[BISHOP_FLAG]);
    expect(back.state.see).toEqual(away.see);
    expect(back.state.rome!.college?.map((c) => c.order)).toEqual(away.rome!.college?.map((c) => c.order));
  });
});
