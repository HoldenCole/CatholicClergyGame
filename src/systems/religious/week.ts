import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { houseWeek } from './house';
import { horariumWeek } from './horarium';
import { friendshipWeek } from './friendship';
import { restlessWeek } from './restless';
import { dispensationWeek, preachingWeek } from './study';
import { requestsWeek } from './requests';

/** One week of the common life: the horarium as kept, then the house's own drift. Nothing for a diocesan run. */
export function religiousWeek(state: GameState, rng: Rng): GameState {
  if (!state.religious) return state;
  let next = houseWeek(horariumWeek(state), rng.derive(`house:${state.clock.week}`));
  next = requestsWeek(dispensationWeek(preachingWeek(next)));
  return restlessWeek(friendshipWeek(next));
}
