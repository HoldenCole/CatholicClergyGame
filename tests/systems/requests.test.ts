import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { ORDER_KEYS, type GameState, type OrderKey } from '@/types';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { currentHouse } from '@/systems/religious/house';
import { moveToHouse } from '@/systems/religious/transfer';
import {
  apostolateOffers, askHouseOffice, endApostolate, fileRequest, houseOfficeLoad, houseOfficeOffers, requestChance, requestsLoad, requestsWeek, requestWeek, resignHouseOffice, REQUESTS, withdrawRequest,
} from '@/systems/religious/requests';

/** An ordained friar of an order, in a priory of its first province, with stats enough for most of the work. */
function friar(seed: string, order: OrderKey = 'OP'): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = gen.houses.find((h) => h.kind === 'priory')!.id;
  const base = seminaryState(seed);
  const c = testCharacter({ stats: { administration: 60, charisma: 60, theology: 65, knowledge: 60, piety: 60 }, reputation: { ...base.character!.reputation, province: 20, superiors: 15, community: 20 } });
  const s = installProvince({ ...base, character: c }, gen, 2010, first);
  const week = s.clock.week;
  return { ...s, clock: { ...s.clock, week: week + 52 * 6 }, flags: { ...s.flags, ordained: true, ordination_week: week }, religious: { ...s.religious!, vows: { ...s.religious!.vows, simpleWeek: week - 300, solemnWeek: week - 100 } } };
}

/** Run the week's answer until the provincial writes, or give up. */
function untilAnswered(s: GameState, seed: string, max = 30): GameState {
  let next = s;
  for (let i = 0; i < max && next.mode.kind === 'clock'; i++) {
    next = { ...next, clock: { ...next.clock, week: next.clock.week + 1 } };
    next = requestWeek(next, createRng(`${seed}:${next.clock.week}`));
  }
  return next;
}

describe('asking for a work (E3 §3.10)', () => {
  it('every order names its house offices and its apostolates, and the local ones name institutions the world can hold', () => {
    for (const key of ORDER_KEYS) {
      const def = religiousOrder(key);
      expect(def.houseOffices.length).toBeGreaterThanOrEqual(6);
      expect(def.apostolates.length).toBeGreaterThanOrEqual(8);
      for (const a of def.apostolates) {
        if (a.kind === 'house') expect(a.houseKind).toBeDefined();
        if (a.institution) expect(['major_seminary', 'catholic_university', 'hospital_system', 'school_network', 'national_cathedral', 'diocesan_media', 'catholic_charities', 'nunciature_proximity', 'shrine']).toContain(a.institution);
      }
    }
  });

  it('the prior answers at the table, deterministically by seed, and the office costs blocks and stays with the house', () => {
    const s = friar('office');
    const offers = houseOfficeOffers(s);
    expect(offers.some((o) => o.available)).toBe(true);
    const id = offers.find((o) => o.available)!.def.id;
    const a = askHouseOffice(s, id, createRng('ask:1'));
    const b = askHouseOffice(s, id, createRng('ask:1'));
    expect(a.state.religious!.houseOffice).toEqual(b.state.religious!.houseOffice);
    expect(a.line.length).toBeGreaterThan(10);
    // Some seed says yes.
    let granted: GameState | undefined;
    for (let i = 0; i < 40 && !granted; i++) {
      const r = askHouseOffice(s, id, createRng(`ask:${i}`));
      if (r.state.religious!.houseOffice) granted = r.state;
    }
    expect(granted).toBeDefined();
    expect(houseOfficeLoad(granted!)).toBeGreaterThan(0);
    expect(granted!.flags[`house_office:${id}`]).toBeDefined();
    expect(houseOfficeOffers(granted!).find((o) => o.def.id === id)!.why).toBe('Held now');
    // A week of it moves something.
    const after = requestsWeek(granted!);
    expect(after).not.toBe(granted);
    // A move to another house lays it down.
    const other = Object.values(granted!.orderHouses!).find((h) => h.id !== granted!.religious!.houseId)!;
    const moved = moveToHouse(granted!, other.id, other.works[0] ?? 'priory_church');
    expect(moved.religious!.houseOffice).toBeUndefined();
    // Laid down early, the house remembers.
    const resigned = resignHouseOffice(granted!);
    expect(resigned.religious!.houseOffice).toBeUndefined();
    expect(resigned.character!.reputation.community).toBeLessThan(granted!.character!.reputation.community ?? 0);
    // Some seed says no, and the refusal closes the ask for a while.
    let refused: GameState | undefined;
    for (let i = 0; i < 40 && !refused; i++) {
      const r = askHouseOffice(s, id, createRng(`no:${i}`));
      if (!r.state.religious!.houseOffice) refused = r.state;
    }
    expect(refused).toBeDefined();
    expect(houseOfficeOffers(refused!).find((o) => o.def.id === id)!.why).toBe('The prior said no this year');
  });

  it('local works are drawn from what the diocese holds, and a letter for a house of the province moves him when granted', () => {
    const s = friar('letter');
    const offers = apostolateOffers(s);
    const institutions = s.world!.diocese.visible.institutions;
    for (const o of offers.filter((x) => x.def.kind === 'local' && x.def.institution)) {
      expect(o.available || o.why === 'Not in this diocese' || o.why.startsWith('Not before') || o.why.startsWith('The provincial')).toBe(true);
      if (!institutions.includes(o.def.institution as (typeof institutions)[number])) expect(o.why).toBe('Not in this diocese');
    }
    // The jail needs no institution: every diocese has one.
    expect(offers.find((o) => o.def.id === 'prison_chaplain')!.available).toBe(true);
    // A house of the province, other than this one.
    const move = offers.find((o) => o.def.kind === 'house' && o.available);
    expect(move).toBeDefined();
    expect(move!.houseId).not.toBe(s.religious!.houseId);
    const filed = fileRequest(s, move!.def.id, move!.houseId);
    expect(filed.religious!.request?.label).toBe(move!.label);
    expect(apostolateOffers(filed).every((o) => !o.available)).toBe(true);
    expect(requestChance(filed, move!)).toBeGreaterThan(REQUESTS.chance.floor);
    // Answered in weeks, by seed; a yes moves him and a no leaves him.
    let granted: GameState | undefined;
    let refused: GameState | undefined;
    for (let i = 0; i < 40 && !(granted && refused); i++) {
      const done = untilAnswered(filed, `answer:${i}`);
      expect(done.mode.kind).toBe('letter');
      if (done.mode.kind === 'letter') expect(done.mode.letter.sort).toBe('provincial');
      if (done.religious!.request!.outcome === 'granted') granted ??= done;
      else refused ??= done;
    }
    expect(granted).toBeDefined();
    expect(refused).toBeDefined();
    expect(granted!.religious!.houseId).toBe(move!.houseId);
    expect(currentHouse(granted!)!.id).toBe(move!.houseId);
    expect(refused!.religious!.houseId).toBe(s.religious!.houseId);
    // The same seed, the same answer.
    expect(untilAnswered(filed, 'answer:0').religious!.request).toEqual(untilAnswered(filed, 'answer:0').religious!.request);
    // Withdrawn, the letter is closed and another may be written.
    const w = withdrawRequest(filed);
    expect(w.religious!.request!.outcome).toBe('withdrawn');
    expect(apostolateOffers(w).some((o) => o.available)).toBe(true);
  });

  it('a granted local work is done from the house, costs blocks, and ends with a move out of the diocese', () => {
    const s = friar('local', 'OSA');
    const jail = apostolateOffers(s).find((o) => o.def.id === 'prison_chaplain')!;
    expect(jail.available).toBe(true);
    const filed = fileRequest(s, jail.def.id);
    let granted: GameState | undefined;
    for (let i = 0; i < 40 && !granted; i++) {
      const done = untilAnswered(filed, `jail:${i}`);
      if (done.religious!.apostolate) granted = done;
    }
    expect(granted).toBeDefined();
    expect(granted!.religious!.houseId).toBe(s.religious!.houseId);
    expect(granted!.flags['apostolate:prison_chaplain']).toBeDefined();
    expect(requestsLoad(granted!)).toBe(jail.def.ap);
    const after = requestsWeek(granted!);
    expect((after.character!.reputation.local_bishop ?? 0) + (after.character!.reputation.laity ?? 0)).toBeGreaterThan((granted!.character!.reputation.local_bishop ?? 0) + (granted!.character!.reputation.laity ?? 0));
    // A house in the same diocese keeps it; one in another loses it.
    const here = granted!.religious!;
    const same = Object.values(granted!.orderHouses!).find((h) => h.id !== here.houseId && h.dioceseId === currentHouse(granted!)!.dioceseId);
    const away = Object.values(granted!.orderHouses!).find((h) => h.dioceseId !== currentHouse(granted!)!.dioceseId)!;
    if (same) expect(moveToHouse(granted!, same.id, same.works[0] ?? 'priory_church').religious!.apostolate).toBeDefined();
    expect(moveToHouse(granted!, away.id, away.works[0] ?? 'priory_church').religious!.apostolate).toBeUndefined();
    expect(endApostolate(granted!).religious!.apostolate).toBeUndefined();
    // A second letter in the window costs standing with the council.
    const second = fileRequest(endApostolate(granted!), 'hospital_chaplain');
    if (second.religious!.request?.apostolateId === 'hospital_chaplain') expect(second.character!.reputation.superiors).toBeLessThan(granted!.character!.reputation.superiors ?? 0);
  });
});
