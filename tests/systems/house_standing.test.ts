import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import {
  HOUSES,
  answerAsk,
  askFavour,
  expireAsks,
  favourOffers,
  houseCoversSupply,
  houseHelp,
  houseLine,
  houseRelief,
  houseWeek,
  housesOf,
  housesYear,
  raiseHouseAsk,
  regardWord,
  standingOf,
} from '@/systems/houses';
import { planWeek } from '@/systems/week';
import type { GameState, ReligiousHouse } from '@/types';

/** A state whose diocese has one active house and one contemplative, and a standing with each. */
function withHouses(seed = 'houses', regard = 0): { state: GameState; active: ReligiousHouse; quiet: ReligiousHouse } {
  const base = parishState(seed);
  const active: ReligiousHouse = { id: 'house:dominican', name: 'St. Dominic Priory', order: 'dominican', orderLabel: 'the Dominicans', members: 'friars', charism: 'active', alignment: -15, setting: 'city', size: 11, line: 'A priory in the city.' };
  const quiet: ReligiousHouse = { id: 'house:trappist', name: 'Our Lady of Peace Abbey', order: 'trappist', orderLabel: 'the Trappists', members: 'monks', charism: 'contemplative', alignment: -25, setting: 'country', size: 19, line: 'An abbey an hour out of town.' };
  const world = { ...base.world!, diocese: { ...base.world!.diocese, visible: { ...base.world!.diocese.visible, houses: [active, quiet] } } };
  const houses = {
    [active.id]: { houseId: active.id, regard, sinceWeek: 0, asked: 0, given: 0, arrangements: [] },
    [quiet.id]: { houseId: quiet.id, regard, sinceWeek: 0, asked: 0, given: 0, arrangements: [] },
  };
  return { state: { ...base, world, houses }, active, quiet };
}

describe('systems/houses', () => {
  it('a diocese\'s houses are visible, and a man starts as a name on the deanery list', () => {
    const { state, active } = withHouses();
    expect(housesOf(state)).toHaveLength(2);
    expect(standingOf(state, active.id).regard).toBe(0);
    expect(regardWord(0)).toContain('deanery list');
    expect(regardWord(80)).toContain('one of their own');
    expect(houseLine(state, active)).toContain('deanery list');
  });

  it('an hour a week builds it, and nobody going cools it', () => {
    const { state, active } = withHouses('build', 30);
    const kept = houseWeek(state, 1);
    expect(standingOf(kept, active.id).regard).toBeGreaterThan(30);
    let cold = state;
    for (let i = 0; i < 20; i++) cold = houseWeek(cold, 0);
    expect(standingOf(cold, active.id).regard).toBeLessThan(30);
    // It cools toward indifference, not into hostility.
    let colder = cold;
    for (let i = 0; i < 2000; i++) colder = houseWeek(colder, 0);
    expect(standingOf(colder, active.id).regard).toBeGreaterThanOrEqual(0);
  });

  it('a favour is gated on the standing, and on the kind of house', () => {
    const { state, active, quiet } = withHouses('gate', 0);
    const cold = favourOffers(state);
    expect(cold.find((o) => o.house.id === active.id && o.def.id === 'confessor')!.available).toBe(false);
    // A contemplative house does not send a preacher, and an active one is not a guesthouse.
    expect(cold.find((o) => o.house.id === quiet.id && o.def.id === 'mission')!.why).toBeTruthy();
    expect(cold.find((o) => o.house.id === active.id && o.def.id === 'retreat')!.why).toBeTruthy();
    // The prayers of a contemplative house are free to anybody who asks.
    expect(cold.find((o) => o.house.id === quiet.id && o.def.id === 'prayers')!.available).toBe(true);
    const warm = withHouses('gate', 40).state;
    expect(favourOffers(warm).find((o) => o.house.id === active.id && o.def.id === 'confessor')!.available).toBe(true);
    // The provincial's own man takes years.
    expect(favourOffers(warm).find((o) => o.house.id === active.id && o.def.id === 'vicar')!.available).toBe(false);
  });

  it('a Saturday confessor takes most of the hour off the week', () => {
    const { state, active } = withHouses('confessor', 40);
    const before = planWeek(state).mandatory;
    const asked = askFavour(state, active.id, 'confessor', createRng('c'));
    expect(asked.line).toMatch(/Saturday/);
    expect(houseRelief(asked.state).confessions).toBe(HOUSES.confessorRelief);
    expect(planWeek(asked.state).mandatory).toBeLessThan(before);
    // Asking spends some of what was built.
    expect(standingOf(asked.state, active.id).regard).toBe(40 - HOUSES.askCost);
    // And it cannot be asked for twice.
    expect(favourOffers(asked.state).find((o) => o.house.id === active.id && o.def.id === 'confessor')!.why).toBe('Running now');
  });

  it('an order priest in the rectory gives blocks back, and a covered parish pays no supply', () => {
    const { state, active } = withHouses('vicar', 80);
    const before = planWeek(state).mandatory;
    const withVicar = askFavour(state, active.id, 'vicar', createRng('v')).state;
    expect(houseHelp(withVicar)).toBe(HOUSES.vicarRelief);
    expect(planWeek(withVicar).mandatory).toBeLessThan(before);
    expect(houseCoversSupply(withVicar)).toBe(false);
    const covered = askFavour(withVicar, active.id, 'supply', createRng('s')).state;
    expect(houseCoversSupply(covered)).toBe(true);
  });

  it('a mission costs the parish money and cannot be had every year', () => {
    const { state, active } = withHouses('mission', 60);
    const rich = { ...state, parish: { ...state.parish!, finance: { ...state.parish!.finance, cash: 50_000 } } };
    const after = askFavour(rich, active.id, 'mission', createRng('m')).state;
    expect(after.parish!.finance.cash).toBe(50_000 - 3500);
    expect(favourOffers(after).find((o) => o.house.id === active.id && o.def.id === 'mission')!.why).toMatch(/Not again/);
    const poor = { ...state, parish: { ...state.parish!, finance: { ...state.parish!.finance, cash: 100 } } };
    expect(favourOffers(poor).find((o) => o.house.id === active.id && o.def.id === 'mission')!.why).toBe('The parish cannot pay for it');
  });

  it('they ask, and yes builds more than an hour does, and silence is a no', () => {
    const { state } = withHouses('ask', 30);
    const asked = raiseHouseAsk(state, createRng('a'));
    const standing = Object.values(asked.state.houses!).find((s) => s.ask)!;
    expect(asked.line).toBeTruthy();
    const yes = answerAsk(asked.state, standing.houseId, true);
    expect(standingOf(yes.state, standing.houseId).regard).toBe(30 + HOUSES.yesRegard);
    expect(standingOf(yes.state, standing.houseId).given).toBe(1);
    expect(standingOf(yes.state, standing.houseId).ask).toBeUndefined();
    const no = answerAsk(asked.state, standing.houseId, false);
    expect(standingOf(no.state, standing.houseId).regard).toBe(30 + HOUSES.noRegard);
    // Nobody answered: the clock answers.
    const late = { ...asked.state, clock: { ...asked.state.clock, week: asked.state.clock.week + HOUSES.askWeeks } };
    const expired = expireAsks(late);
    expect(expired.lines.length).toBe(1);
    expect(standingOf(expired.state, standing.houseId).regard).toBe(30 + HOUSES.noRegard);
  });

  it('the provincial can end an arrangement, and standing makes it rarer', () => {
    const { state, active } = withHouses('withdraw', 40);
    const running = askFavour(state, active.id, 'confessor', createRng('w')).state;
    let ended = false;
    let next = running;
    for (let i = 0; i < 40 && !ended; i++) {
      next = { ...next, clock: { ...next.clock, week: next.clock.week + 52 } };
      const year = housesYear(next, createRng(`y${i}`));
      next = year.state;
      ended = standingOf(next, active.id).arrangements.length === 0;
    }
    expect(ended).toBe(true);
    expect(houseRelief(next).confessions).toBeUndefined();
  });

  it('a favour the house will not do is refused, not silently dropped', () => {
    const { state, active } = withHouses('refuse', 0);
    expect(() => askFavour(state, active.id, 'vicar', createRng('r'))).toThrow();
    expect(() => askFavour(state, 'house:nobody', 'prayers', createRng('r'))).toThrow();
  });
});
