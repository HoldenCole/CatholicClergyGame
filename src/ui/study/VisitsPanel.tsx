import { useGameStore } from '@/engine/store';
import { cycleProgress, parishesToVisit, pastorOf, visitAvailable } from '@/systems/bishop/visits';
import { shortName } from '@/systems/bishop/directions';
import Sheet from '../Sheet';

/** The visitation: every parish of the see, the longest unvisited first, and the cycle. E4 R1.3. */
export default function VisitsPanel() {
  const game = useGameStore((s) => s.game);
  const visit = useGameStore((s) => s.visitParish);
  if (!game?.see) return null;
  const list = parishesToVisit(game);
  if (!list.length) return null;
  const { visited, total } = cycleProgress(game);
  const ago = (w: number | null) => (w === null ? 'never' : game.clock.week - w < 52 ? 'this year' : `${Math.floor((game.clock.week - w) / 52)} year${Math.floor((game.clock.week - w) / 52) === 1 ? '' : 's'} ago`);
  return (
    <Sheet title="The visitation">
      <p className="ink-muted text-xs">{visited} of {total} parishes seen within five years. A visit is a weekend: the pastor, the books, the school, the people, and what the file did not say.</p>
      <ul className="mt-2 flex max-h-64 flex-col gap-0.5 overflow-y-auto text-xs">
        {list.map(({ parish, lastWeek, due }) => {
          const may = visitAvailable(game, parish.id);
          const pastor = pastorOf(game, parish);
          return (
            <li key={parish.id} className="flex items-center justify-between gap-2">
              <span className={due ? '' : 'ink-muted'}>{parish.name}, {parish.place}{pastor ? `: ${shortName(pastor)}` : ': no pastor'}<span className="ink-faint"> · {ago(lastWeek)}</span></span>
              <button className="pbtn px-2 py-0.5 text-xs" disabled={!may.ok} title={may.why ?? ''} onClick={() => visit(parish.id)}>Visit</button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
