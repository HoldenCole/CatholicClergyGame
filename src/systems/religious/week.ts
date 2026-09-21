import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { houseWeek } from './house';
import { horariumWeek } from './horarium';
import { friendshipWeek } from './friendship';
import { restlessWeek } from './restless';
import { dispensationWeek, preachingWeek } from './study';
import { requestsWeek } from './requests';
import { chanceryWeek } from './bishopAsks';
import { friarDeaneryWeek } from './deanery';
import { pastorAskWeek } from './pastorAsks';
import { directingWeek } from './directing';

/** One week of the common life: the horarium as kept, then the house's own drift. Nothing for a diocesan run. */
export function religiousWeek(state: GameState, rng: Rng): GameState {
  if (!state.religious) return state;
  let next = houseWeek(horariumWeek(state), rng.derive(`house:${state.clock.week}`));
  next = chanceryWeek(requestsWeek(dispensationWeek(preachingWeek(next))));
  next = restlessWeek(friendshipWeek(next));
  // The diocese around the order's parish, and the pastors who ask for him. E3 §3.12.
  return directingWeek(pastorAskWeek(friarDeaneryWeek(next, rng.derive(`deanery:${state.clock.week}`))));
}
