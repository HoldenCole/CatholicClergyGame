import type { GameState, Season } from '@/types';
import type { SceneId } from './scenes';
import { ambientFor, currentDecor } from '@/systems/decor';
import { Defs, Finish } from './art/defs';
import { Church } from './art/church';
import { Chancery, chanceryRank, Office } from './art/office';
import { Rectory, SeminaryRoom, Study } from './art/home';
import { Chapel, Hall, Street } from './art/places';

/** Season tints the light through every window. */
const SEASON_SKY: Record<Season, [string, string]> = {
  advent: ['#5b6a8e', '#c9b6a0'],
  christmas: ['#4a5680', '#e0c8a8'],
  ordinary: ['#6f9ccf', '#e3ebf0'],
  lent: ['#7f859e', '#d8d0c8'],
  holy_week: ['#6b5f78', '#d9c4b0'],
  easter: ['#86b6e6', '#f6efd8'],
};

/**
 * The rooms, drawn in a 100×60 box so hotspot percentages line up. Every
 * room reads the state: the church its parish and furnishings, the office
 * its parish's means and the man's rank, every desk the man himself.
 */
export default function SceneArt({ scene, season, state }: { scene: SceneId; season: Season; state: GameState }) {
  const [skyTop, skyBottom] = SEASON_SKY[season];
  const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  const ambient = (place: Parameters<typeof ambientFor>[1]) => ambientFor(state, place);
  const bishopId = state.world?.diocese.hidden.bishop.npcId;
  const bishop = bishopId ? state.npcs[bishopId] : undefined;
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
      <Defs skyTop={skyTop} skyBottom={skyBottom} />
      {scene === 'office' && <Office decor={currentDecor(state, 'office')} ambient={ambient('office')} parish={parish} role={state.assignment?.role} />}
      {scene === 'rectory' && <Rectory decor={currentDecor(state, 'rectory')} ambient={ambient('rectory')} parish={parish} />}
      {scene === 'church' && <Church decor={currentDecor(state, 'church')} parish={parish} />}
      {scene === 'hall' && <Hall />}
      {scene === 'chapel' && <Chapel />}
      {scene === 'street' && <Street terrain={parish?.terrain} />}
      {scene === 'study' && <Study ambient={ambient('office')} />}
      {scene === 'seminary_room' && <SeminaryRoom ambient={ambient('seminary_room')} seminaryName={state.seminary?.name} />}
      {scene === 'chancery' && <Chancery ambient={ambient('chancery')} rank={chanceryRank(state) ?? 'modest'} bishopName={bishop ? `${bishop.title} ${bishop.name.first} ${bishop.name.last}` : 'The bishop'} />}
      <Finish />
    </svg>
  );
}
