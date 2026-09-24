import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testCharacter } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { installSuperior } from '@/systems/religious/chapter';
import { vacateOffice } from '@/systems/religious/vacate';
import { closeHouse } from '@/systems/religious/foundations';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { DEFAULT_ROUTINE_FLAG, defaultFormationRoutine } from '@/systems/religious/spends';
import { houseLifeLine } from '@/systems/religious/houseLife';
import houseLife from '@/content/religious/houseLife.json';
import { allOffers } from '@/content/offers';
import { isOfferEligible } from '@/engine/offers';
import type { GameState, OrderKey } from '@/types';

function friar(seed: string, order: OrderKey = 'OP', ordained = true): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const priory = gen.houses.find((h) => h.kind === 'priory' || h.kind === 'parish')!;
  const base = seminaryState(seed);
  const s = installProvince({ ...base, seed, character: testCharacter({ entryYear: 1982, stats: { administration: 60, charisma: 65, theology: 64, knowledge: 60, piety: 60 } }), flags: { ...base.flags, ordained, ordination_week: 0, [`order:${order}`]: true } }, gen, 2010, priory.id);
  return { ...s, ...(ordained ? { seminary: null, phase: 'parochial_vicar' as const } : {}), clock: { ...s.clock, week: 60 * 12 }, religious: { ...s.religious!, vows: { renewals: [], solemnWeek: 0 } } };
}

/** He is prior of his own house. */
function asPrior(s: GameState): GameState {
  const houseId = s.religious!.houseId!;
  const seated = installSuperior(s, 'prior', houseId, PLAYER_ID);
  return { ...seated, religious: { ...seated.religious!, office: { office: 'prior', bodyId: houseId, startWeek: 600, endWeek: 600 + 156, consecutive: 1 } }, flags: { ...seated.flags, 'office:prior': 600 } };
}

describe('one office at a time, and no house left governed by an absence', () => {
  it('a prior who leaves office early loses the flag, keeps the term on his record, and the house has a prior', () => {
    const s = asPrior(friar('vacate'));
    const houseId = s.religious!.houseId!;
    const out = vacateOffice(s, 'for the office of provincial');
    expect(out.flags['office:prior']).toBeUndefined();
    expect(out.religious!.office).toBeUndefined();
    expect(out.religious!.termsServed.at(-1)!.office).toBe('prior');
    const prior = out.orderHouses![houseId]!.priorId;
    expect(prior).not.toBe(PLAYER_ID);
    if (prior) expect(out.npcs[prior]!.tags).toContain('prior');
  });

  it('when the province closes his own house he goes with the men, and a prior of it is prior of nothing', () => {
    const s = asPrior(friar('close'));
    const houseId = s.religious!.houseId!;
    const out = closeHouse(s, houseId, createRng('close')).state;
    expect(out.orderHouses![houseId]).toBeUndefined();
    expect(out.orderHouses![out.religious!.houseId!]).toBeDefined();
    expect(out.flags['office:prior']).toBeUndefined();
    expect(out.flags['house_closed:mine']).toBeDefined();
  });
});

describe('the novice\'s free hours begin as the order\'s usual ones', () => {
  it('given once, where offered, within the hours; cleared hours stay cleared', () => {
    const s = friar('novice', 'OP', false);
    const given = defaultFormationRoutine(s);
    const wanted = religiousOrder('OP').mechanics.defaultFormationRoutine!;
    const routine = given.seminary!.routine ?? {};
    expect(Object.keys(routine).length).toBeGreaterThan(0);
    for (const id of Object.keys(routine)) expect(wanted[id]).toBeDefined();
    expect(given.flags[DEFAULT_ROUTINE_FLAG]).toBe(true);
    const cleared = { ...given, seminary: { ...given.seminary!, routine: {} } };
    expect(defaultFormationRoutine(cleared).seminary!.routine).toEqual({});
  });
});

describe('the Dominicans read as Dominicans', () => {
  it('the order\'s own customs come into the week, and only for that order', () => {
    const op = (houseLife as unknown as Record<string, string[]>)['order:OP']!;
    const osa = (houseLife as unknown as Record<string, string[]>)['order:OSA']!;
    const seen = (s: GameState) => new Set(Array.from({ length: 300 }, (_, i) => houseLifeLine(s, createRng(`l:${i}`))).filter((l): l is string => !!l));
    const a = seen(friar('op-lines', 'OP'));
    const b = seen(friar('osa-lines', 'OSA'));
    expect(op.some((l) => a.has(l))).toBe(true);
    expect(op.some((l) => b.has(l))).toBe(false);
    expect(osa.some((l) => b.has(l))).toBe(true);
  });

  it('the Dominican letters never reach an Augustinian', () => {
    const osa = friar('osa-letters', 'OSA');
    const s = { ...osa, character: { ...osa.character!, reputation: { ...osa.character!.reputation, province: 60 } } };
    for (const o of allOffers.filter((d) => d.id.startsWith('op_'))) expect(isOfferEligible(o, s), o.id).toBe(false);
    const op = friar('op-letters', 'OP');
    expect(allOffers.filter((d) => d.id.startsWith('op_')).some((o) => isOfferEligible(o, op))).toBe(true);
  });
});
