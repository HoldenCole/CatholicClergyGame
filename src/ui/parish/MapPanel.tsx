import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { milesAcross, milesBetween } from '@/systems/map';
import { parishKindWord } from '@/systems/placement';
import type { Parish } from '@/types';
import Sheet from '../Sheet';
import { DioceseMap, fitView, MapControls, type MapView } from './DioceseMap';

export { DioceseMap } from './DioceseMap';

/** The Map sheet: the diocese on real ground, yours marked, the deanery ringed, the miles on hover. */
export default function MapPanel() {
  const game = useGameStore((s) => s.game);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  if (!game?.world) return null;
  const world = game.world;
  const here = world.parishes.find((p) => p.id === game.assignment?.parishId);
  const deanery = new Set(game.parish?.deanery?.parishIds ?? []);
  const across = milesAcross(world);
  const hovered = world.parishes.find((p) => p.id === hover) ?? null;
  const chosen = world.parishes.find((p) => p.id === selected) ?? null;
  const openings = game.openings.filter((o) => o.parishId);
  const openIds = openings.map((o) => o.parishId!);
  const openingAt = (id: string) => openings.find((o) => o.parishId === id);
  const pastorOf = (p: Parish) => game.npcs[p.pastorId];
  const miles = (p: Parish) => (here ? milesBetween(here, p, across) : null);
  // Open on the parishes, close enough to tell them apart; the buttons and the wheel take it from there.
  const home = fitView(world.parishes.map((p) => ({ x: p.x ?? 50, y: p.y ?? 50 })), 2.5);
  const shown = view ?? home;
  return (
    <Sheet title={`${world.diocese.visible.name}, ${across} miles across`}>
      <div className="relative w-full overflow-hidden rounded border rule" style={{ background: '#efe6d2', aspectRatio: '1 / 1' }}>
        <DioceseMap world={world} hereId={here?.id} deaneryIds={[...deanery]} openIds={openIds} selectedId={selected} view={shown} onView={setView} onHover={setHover} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />
        <MapControls view={shown} onView={setView} home={home} />
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {hovered
          ? `${hovered.name}, ${hovered.place}${hovered.cathedral ? ', the cathedral' : hovered.founded ? ` (${hovered.founded})` : ''}: ${hovered.households.toLocaleString()} households${hovered.id === here?.id ? '. Yours.' : miles(hovered) !== null ? `, ${miles(hovered)} miles from you${deanery.has(hovered.id) ? ', in your deanery' : ''}.` : '.'}`
          : here
            ? `${here.name} is the ringed one; the cross is the cathedral; the lines run to your deanery. Drag to move, scroll or use the buttons to come closer. Hover a church for its name and the miles.`
            : 'The cross is the cathedral. Drag to move, scroll to come closer, hover a church for its name.'}
      </p>
      {chosen && (() => {
        const pastor = pastorOf(chosen);
        const opening = openingAt(chosen.id);
        const mine = chosen.id === here?.id;
        return (
          <div className="mt-2 rounded border rule bg-white/40 px-3 py-2 text-sm leading-relaxed">
            <div className="flex items-baseline justify-between">
              <span className="title text-base">{chosen.name}, {chosen.place}{chosen.founded ? ` (${chosen.founded})` : ''}</span>
              <button className="pbtn-link text-xs" onClick={() => setSelected(null)}>close</button>
            </div>
            <div>{parishKindWord(chosen)}, about {chosen.households.toLocaleString()} households, {chosen.generational}{chosen.school === 'none' ? ', no school' : `, a school ${chosen.school.replace('_', ' ')}`}{chosen.needsSpanish ? ', Spanish needed' : ''}.</div>
            <div>{chosen.cathedral ? 'The cathedral. ' : ''}{pastor ? `${chosen.cathedral ? 'Rector' : 'Pastor'}: ${pastor.title} ${pastor.name.first} ${pastor.name.last}${pastor.status !== 'active' ? ` (${pastor.status})` : ''}.` : 'No pastor.'}{mine ? ' Yours.' : miles(chosen) !== null ? ` ${miles(chosen)} miles from you${deanery.has(chosen.id) ? ', in your deanery' : ''}.` : ''}</div>
            {opening && <div className="text-[#7a1f1f]">Open: {opening.label}{opening.needsSpanish ? ', Spanish wanted' : ''}{opening.needsAdmin ? ', a head for money wanted' : ''}. The Jobs sheet has the rest.</div>}
          </div>
        );
      })()}
      <p className="ink-faint mt-1 text-[11px]">Click a church for its card; a dashed ring means it is open. Coast, rivers, highways, counties, and towns from Natural Earth. The churches are where they stand.</p>
    </Sheet>
  );
}
