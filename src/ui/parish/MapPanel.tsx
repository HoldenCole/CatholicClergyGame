import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { milesAcross, milesBetween } from '@/systems/map';
import type { Parish } from '@/types';
import Sheet from '../Sheet';
import { DioceseMap, fitView, MapControls, type MapView } from './DioceseMap';

export { DioceseMap } from './DioceseMap';

/** The Map sheet: the diocese on real ground, yours marked, the deanery ringed, the miles on hover. */
export default function MapPanel() {
  const game = useGameStore((s) => s.game);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  if (!game?.world) return null;
  const world = game.world;
  const here = world.parishes.find((p) => p.id === game.assignment?.parishId);
  const deanery = new Set(game.parish?.deanery?.parishIds ?? []);
  const across = milesAcross(world);
  const hovered = world.parishes.find((p) => p.id === hover) ?? null;
  const miles = (p: Parish) => (here ? milesBetween(here, p, across) : null);
  // Open on the parishes, close enough to tell them apart; the buttons and the wheel take it from there.
  const home = fitView(world.parishes.map((p) => ({ x: p.x ?? 50, y: p.y ?? 50 })), 2.5);
  const shown = view ?? home;
  return (
    <Sheet title={`${world.diocese.visible.name}, ${across} miles across`}>
      <div className="relative w-full overflow-hidden rounded border rule" style={{ background: '#efe6d2', aspectRatio: '1 / 1' }}>
        <DioceseMap world={world} hereId={here?.id} deaneryIds={[...deanery]} view={shown} onView={setView} onHover={setHover} />
        <MapControls view={shown} onView={setView} home={home} />
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {hovered
          ? `${hovered.name}, ${hovered.place}${hovered.cathedral ? ', the cathedral' : hovered.founded ? ` (${hovered.founded})` : ''}: ${hovered.households.toLocaleString()} households${hovered.id === here?.id ? '. Yours.' : miles(hovered) !== null ? `, ${miles(hovered)} miles from you${deanery.has(hovered.id) ? ', in your deanery' : ''}.` : '.'}`
          : here
            ? `${here.name} is the ringed one; the cross is the cathedral; the lines run to your deanery. Drag to move, scroll or use the buttons to come closer. Hover a church for its name and the miles.`
            : 'The cross is the cathedral. Drag to move, scroll to come closer, hover a church for its name.'}
      </p>
      <p className="ink-faint mt-1 text-[11px]">Coast, rivers, highways, counties, and towns from Natural Earth. The churches are where they stand; the rest of the parishes are placed near their towns.</p>
    </Sheet>
  );
}
