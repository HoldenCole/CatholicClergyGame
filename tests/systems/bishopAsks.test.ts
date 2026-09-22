import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { bishopAskDefs, religiousOrder } from '@/content/religious';
import type { GameState, OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { currentHouse } from '@/systems/religious/house';
import { moveToHouse, fileCarry } from '@/systems/religious/transfer';
import { resolveSelector } from '@/engine/selectors';
import { answerBishopAsk, bishopAskLetter, bishopAskYear, eligibleAsks, provincialAnswers } from '@/systems/religious/bishopAsks';
import { apostolateLoad } from '@/systems/religious/requests';

function friar(seed: string, order: OrderKey = 'OP', kind = 'priory'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = gen.houses.find((h) => h.kind === kind)!.id;
  const base = seminaryState(seed);
  const c = testCharacter({ stats: { administration: 60, charisma: 60, theology: 65, knowledge: 60, piety: 60 }, reputation: { ...base.character!.reputation, province: 20, superiors: 15, community: 20, local_bishop: 40 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 6 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

describe('the bishop asks the order (E3 §3.11)', () => {
  it('every diocese of the province has its own people: no two share an id, and each is tagged with its diocese', () => {
    const s = friar('ids');
    const ids = new Set<string>();
    for (const w of [s.world!, ...Object.values(s.territory!)]) {
      expect(s.npcs[w.diocese.hidden.bishop.npcId]).toBeDefined();
      expect(s.npcs[w.diocese.hidden.bishop.npcId]!.tags).toContain(`diocese:${w.diocese.presetId}`);
      for (const p of w.parishes) {
        expect(ids.has(p.id)).toBe(false);
        ids.add(p.id);
        expect(s.npcs[p.pastorId]?.tags).toContain(`pastor:${p.id}`);
      }
    }
    // The bishop selector finds the bishop where he is, and a brother priest of this diocese only.
    const bishop = resolveSelector(s, '@bishop');
    expect(bishop?.id).toBe(s.world!.diocese.hidden.bishop.npcId);
    const priest = resolveSelector(s, '@brother_priest', createRng('p'));
    expect(priest?.tags).toContain(`diocese:${s.world!.diocese.presetId}`);
  });

  it('the bishop writes to the provincial, never to the friar: formation work and an office held are never spared, and a full week means both or nothing', () => {
    const s = friar('rule');
    const def = bishopAskDefs.find((d) => d.id === 'vicar_for_religious')!;
    // A man in the novitiate is refused however fond the bishop is.
    const novice = friar('rule', 'OP', 'novitiate');
    expect(provincialAnswers({ ...novice, character: { ...novice.character!, reputation: { ...novice.character!.reputation, local_bishop: 100 } } }, def).answer).toBe('refused');
    // A prior is refused.
    const asPrior: GameState = { ...s, religious: { ...s.religious!, office: { office: 'prior', bodyId: currentHouse(s)!.id, startWeek: s.clock.week, endWeek: s.clock.week + 156, consecutive: 1 } } };
    expect(provincialAnswers(asPrior, def).answer).toBe('refused');
    // A friar with room in his week may do both; with a full week, the province spares him or not by the house's need.
    const plain = provincialAnswers(s, def);
    expect(['both', 'spared', 'refused']).toContain(plain.answer);
    // A full week: the common life kept in full, the hospital, and the procurator's books.
    const heavy: GameState = { ...s, religious: { ...s.religious!, horarium: { hours: 'invested', conventual_mass: 'standard', common_table: 'invested', house_chapter: 'standard' }, houseOffice: { id: 'procurator', startWeek: 0 }, apostolate: { id: 'hospital_chaplain', dioceseId: s.world!.diocese.presetId, label: 'Chaplain at the hospital', startWeek: s.clock.week } } };
    expect(provincialAnswers(heavy, def).answer).not.toBe('both');
    // Only eligible asks: an institution the diocese lacks is never asked for.
    const institutions = s.world!.diocese.visible.institutions;
    for (const d of eligibleAsks(s)) if (d.institution) expect(institutions).toContain(d.institution);
  });

  it('a year may bring the letter; the friar answers the provincial, and taking it is a work with blocks and a flag; declining costs the bishop\'s regard, not the province\'s', () => {
    const s = friar('year');
    let asked: GameState | undefined;
    for (let i = 0; i < 60 && !asked; i++) {
      const y = bishopAskYear(s, createRng(`ask:${i}`));
      if (y.religious!.bishopAsk) asked = y;
    }
    expect(asked).toBeDefined();
    expect(asked!.mode.kind).toBe('bishop_ask');
    const letter = bishopAskLetter(asked!);
    expect(letter?.sort).toBe('provincial');
    expect(letter!.body.join(' ')).toMatch(/not to you/);
    const ask = asked!.religious!.bishopAsk!;
    if (ask.answer === 'refused') {
      expect(asked!.character!.reputation.local_bishop).toBeLessThan(s.character!.reputation.local_bishop ?? 0);
      const drawer = answerBishopAsk(asked!, true);
      expect(drawer.religious!.apostolate).toBeUndefined();
      expect(drawer.mode.kind).toBe('clock');
    } else {
      const took = answerBishopAsk(asked!, true);
      expect(took.religious!.apostolate?.label).toBe(ask.label);
      expect(apostolateLoad(took)).toBeGreaterThan(0);
      expect(took.flags[`bishop_ask:${ask.defId}`]).toBeDefined();
      expect(took.mode.kind).toBe('clock');
      const declined = answerBishopAsk(asked!, false);
      expect(declined.religious!.apostolate).toBeUndefined();
      expect(declined.character!.reputation.local_bishop).toBeLessThan(asked!.character!.reputation.local_bishop ?? 0);
      expect(declined.character!.reputation.superiors).toBeGreaterThanOrEqual(asked!.character!.reputation.superiors ?? 0);
    }
    // Same seed, same letter.
    expect(bishopAskYear(s, createRng('ask:7')).religious!.bishopAsk).toEqual(bishopAskYear(s, createRng('ask:7')).religious!.bishopAsk);
  });

  it('the bishop\'s file: a diocese he returns to remembers him, more under the same bishop, and the people a little', () => {
    const s = friar('file');
    const home = s.world!.diocese.presetId;
    const away = Object.values(s.orderHouses!).find((h) => h.dioceseId !== home)!;
    const gone = moveToHouse(s, away.id, away.works[0] ?? 'priory_church');
    expect(gone.character!.reputation.local_bishop).toBe(0);
    expect(gone.religious!.dioceseFile![home]!.local_bishop).toBe(40);
    // Five years on, back to the first house.
    const later: GameState = { ...gone, clock: { ...gone.clock, week: gone.clock.week + 52 * 5 } };
    const carry = fileCarry(later, home, later.territory![home]!);
    expect(carry!.sameBishop).toBe(true);
    expect(carry!.local_bishop).toBeGreaterThan(10);
    const back = moveToHouse(later, s.religious!.houseId, 'priory_church');
    expect(back.character!.reputation.local_bishop).toBe(carry!.local_bishop);
    expect(back.career.some((e) => e.text.startsWith('Back in'))).toBe(true);
    // A new bishop reads the file and remembers less.
    const newBishop: GameState = { ...later, territory: { ...later.territory, [home]: { ...later.territory![home]!, diocese: { ...later.territory![home]!.diocese, hidden: { ...later.territory![home]!.diocese.hidden, bishop: { ...later.territory![home]!.diocese.hidden.bishop, npcId: 'someone_else' } } } } } };
    const carry2 = fileCarry(newBishop, home, newBishop.territory![home]!);
    expect(carry2!.sameBishop).toBe(false);
    expect(carry2!.local_bishop).toBeLessThan(carry!.local_bishop);
  });
});
