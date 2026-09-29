import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { houseWeek } from './house';
import { ruleWeek } from './priorDesk';
import { horariumWeek } from './horarium';
import { friendshipWeek } from './friendship';
import { restlessWeek } from './restless';
import { dispensationWeek, preachingWeek } from './study';
import { requestsWeek } from './requests';
import { chanceryWeek } from './bishopAsks';
import { friarDeaneryWeek } from './deanery';
import { pastorAskWeek } from './pastorAsks';
import { directingWeek } from './directing';
import { confrereAskWeek } from './confrereAsks';
import { brothersWeek } from './brothers';
import { houseFlagsWeek, ruleRubsWeek } from './teeth';

function appendLines(state: GameState, lines: string[]): GameState['digest'] {
  const last = state.digest[state.digest.length - 1];
  if (!last || last.week !== state.clock.week) return [...state.digest, { week: state.clock.week, lines }];
  return [...state.digest.slice(0, -1), { ...last, lines: [...last.lines, ...lines] }];
}

/** One week of the common life: the horarium as kept, then the house's own drift. Nothing for a diocesan run. */
export function religiousWeek(state: GameState, rng: Rng): GameState {
  if (!state.religious) return state;
  let next = ruleRubsWeek(ruleWeek(houseWeek(horariumWeek(state), rng.derive(`house:${state.clock.week}`))));
  // The men at table: regard built by the common life, and the flags the house's scenes read. Friar round D1, D4.
  const table = brothersWeek(next, rng.derive(`brothers:${state.clock.week}`));
  next = houseFlagsWeek(table.lines.length ? { ...table.state, digest: appendLines(table.state, table.lines) } : table.state);
  next = chanceryWeek(requestsWeek(dispensationWeek(preachingWeek(next))));
  next = restlessWeek(friendshipWeek(next));
  // The diocese around the order's parish, and the pastors who ask for him. E3 §3.12.
  return confrereAskWeek(directingWeek(pastorAskWeek(friarDeaneryWeek(next, rng.derive(`deanery:${state.clock.week}`)))));
}
