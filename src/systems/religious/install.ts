import type { GameState, Npc, ReligiousPlayerState, World } from '@/types';
import type { GeneratedProvince } from '@/generation/province';
import { defaultHorarium } from './horarium';
import { moveToHouse } from './transfer';

/**
 * Make a run a religious campaign: the province is home, its houses are
 * where he will live, every diocese of its territory is kept, and the one
 * holding his first house is the world he is in. E3 §12–13.
 */
export function installProvince(state: GameState, gen: GeneratedProvince, year: number, firstHouseId?: string): GameState {
  const npcs: Record<string, Npc> = { ...state.npcs };
  for (const d of gen.dioceses) for (const n of d.npcs) npcs[n.id] = n;
  for (const f of gen.friars) npcs[f.id] = f;
  const worlds: Record<string, World> = {};
  for (const d of gen.dioceses) {
    worlds[d.presetId] = { diocese: d.diocese, parishes: d.parishes, generatedYear: year, bishopHistory: [d.diocese.hidden.bishop.npcId], institutes: d.institutes ?? [] };
  }
  const house = gen.houses.find((h) => h.id === firstHouseId) ?? gen.houses.find((h) => h.kind === 'novitiate') ?? gen.houses[0]!;
  const world = worlds[house.dioceseId]!;
  const territory = { ...worlds };
  delete territory[house.dioceseId];
  const religious: ReligiousPlayerState = {
    order: gen.province.order,
    provinceId: gen.province.id,
    houseId: house.id,
    horarium: defaultHorarium(),
    permissions: [],
    assignments: [],
    obedience: { accepted: 0, reluctant: 0, refused: 0 },
    vows: { renewals: [] },
    perceivedAmbition: 10,
    termsServed: [],
  };
  const next: GameState = {
    ...state,
    campaign: 'religious',
    npcs,
    world,
    territory,
    province: gen.province,
    orderHouses: Object.fromEntries(gen.houses.map((h) => [h.id, h])),
    religious,
    flags: { ...state.flags, [`diocese:${house.dioceseId}`]: true, [`order:${gen.province.order}`]: true },
  };
  return moveToHouse(next, house.id, house.works[0] ?? 'formation');
}
