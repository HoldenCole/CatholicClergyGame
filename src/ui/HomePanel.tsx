import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { homeView } from '@/systems/home';
import { circleOf } from '@/systems/circle';
import { parishKindWord } from '@/systems/placement';
import Sheet from './Sheet';
import ClassmatesPanel from './parish/ClassmatesPanel';
import Portrait from './portraits/Portrait';
import { portraitForNpc, yearOf } from './portraits/spec';
import { DioceseMap, fitView, MapControls, type MapView } from './parish/DioceseMap';

/**
 * Home, from away (one world, round 1): the diocese a man in Rome, in the
 * service, or in a see elsewhere still belongs to. The parish he left and who
 * has it, his bishop and the chancery as they hold him, the class, the
 * openings, and the year's news from home.
 */
export default function HomePanel() {
  const game = useGameStore((s) => s.game);
  const [view, setView] = useState<MapView | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  if (!game?.world) return null;
  const home = homeView(game);
  if (!home) return null;
  const world = game.world;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const rows = circleOf(game).filter((r) => r.group === 'bishops' || r.group === 'chancery');
  const regardOf = (id: string) => rows.find((r) => r.npc.id === id)?.regard ?? 'no view of you yet';
  const fit = fitView(world.parishes.map((p) => ({ x: p.x ?? 50, y: p.y ?? 50 })), 2.5);
  const shown = view ?? fit;
  const hovered = world.parishes.find((p) => p.id === hover) ?? null;
  const fp = home.formerParish;
  const afar = game.see ? 'a bishop elsewhere' : game.rome?.diplomacy && game.study?.city === 'nunciature' ? 'in the service of the Holy See' : game.rome?.pontificate ? 'in the chair of Peter' : 'away';
  return (
    <>
      <Sheet title={`Home: ${home.diocese}`}>
        <p className="ink-muted mb-2 text-xs leading-relaxed">
          Your diocese, from {afar}. {game.see || game.rome?.pontificate ? 'It goes on without you; its news comes as news.' : 'Your name is still in its book: the board will have a parish for you when you come home, and the bishop reads the years away.'}
        </p>
        <div className="relative w-full overflow-hidden rounded border rule" style={{ background: '#efe6d2', aspectRatio: '1 / 1' }}>
          <DioceseMap world={world} hereId={fp?.parish.id} deaneryIds={[]} openIds={home.openings.map((o) => o.parishId!)} selectedId={null} view={shown} onView={setView} onHover={setHover} onSelect={() => undefined} />
          <MapControls view={shown} onView={setView} home={fit} />
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          {hovered ? `${hovered.name}, ${hovered.place}: ${parishKindWord(hovered)}, about ${hovered.households.toLocaleString()} households.` : fp ? `The ringed church is ${fp.parish.name}, ${fp.parish.place}, where you were ${fp.label.toLowerCase()} for ${fp.years} year${fp.years === 1 ? '' : 's'} and ${fp.left}.` : 'The cross is the cathedral. You have held no parish yet.'}
        </p>
        {fp && (
          <p className="mt-1 text-sm leading-relaxed">
            {fp.pastor ? `${fp.pastor.title} ${fp.pastor.name.first} ${fp.pastor.name.last} has it now${fp.pastor.status !== 'active' ? ` (${fp.pastor.status})` : ''}.` : 'It has no pastor just now.'}
          </p>
        )}
      </Sheet>
      <Sheet title="The bishop and the chancery" fold="open">
        <ul className="flex flex-col gap-1 text-sm">
          {home.bishop && (
            <li className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(home.bishop, year)} size={22} />
              <span className="flex-1">{home.bishop.title} {home.bishop.name.first} {home.bishop.name.last}, bishop of {world.diocese.visible.see}</span>
              <span className="ink-muted">{regardOf(home.bishop.id)}</span>
            </li>
          )}
          {home.chancery.map((n) => (
            <li key={n.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(n, year)} size={22} />
              <span className="flex-1">{n.title ? `${n.title} ` : ''}{n.name.first} {n.name.last}, {n.tags.find((t) => ['vicar_general', 'chancellor', 'vicar_for_clergy', 'judicial_vicar'].includes(t))?.replace(/_/g, ' ')}</span>
              <span className="ink-muted">{regardOf(n.id)}</span>
            </li>
          ))}
        </ul>
        <p className="ink-faint mt-2 text-xs">{home.openings.length === 0 ? 'Nothing is open in the diocese this year.' : `${home.openings.length} parish${home.openings.length === 1 ? ' is' : 'es are'} open at home; the Jobs sheet has them.`}</p>
      </Sheet>
      <ClassmatesPanel />
      <Sheet title="News from home this year" fold="closed" summary={home.news.length ? `${home.news.length} things` : 'quiet'}>
        {home.news.length === 0 ? <p className="ink-faint text-sm">Nothing from home this year that the record kept.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {home.news.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </Sheet>
    </>
  );
}
