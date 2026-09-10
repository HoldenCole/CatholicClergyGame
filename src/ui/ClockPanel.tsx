import { useGameStore } from '@/engine/store';
import { dateOf, gameYearOf, seasonOf, weekOfYear } from '@/engine/time';
import { formatDate, SEASON_LABELS } from '@/engine/calendar';
import type { StopReason } from '@/engine/clock';
import Panel from './Panel';

const PHASE_LABELS: Record<string, string> = {
  seminary: 'Seminarian',
  parochial_vicar: 'Parochial vicar',
  administrator: 'Administrator',
  pastor: 'Pastor',
  chancery: 'Chancery',
  bishop: 'Bishop',
};

function describeStop(stop: StopReason | null): string | null {
  if (!stop) return null;
  switch (stop.kind) {
    case 'paused':
      return 'Paused.';
    case 'manual':
      return 'Week resolved.';
    case 'event':
      return `Stopped: ${stop.event.severity.toLowerCase()} ${stop.event.category.replace('_', ' ')} event.`;
    case 'beat':
      return `Stopped: ${stop.beat.label}.`;
    case 'mode':
      return 'A decision is waiting.';
    case 'offer':
      return 'An offer has arrived.';
    case 'cap':
      return 'Stopped after a full batch of weeks.';
  }
}

export default function ClockPanel() {
  const game = useGameStore((s) => s.game);
  const lastStop = useGameStore((s) => s.lastStop);
  if (!game) return null;

  const { clock } = game;
  const season = seasonOf(clock);

  return (
    <Panel title="The week">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Week of" value={formatDate(dateOf(clock))} wide />
        <Stat label="Season" value={SEASON_LABELS[season]} />
        <Stat label="Standing" value={PHASE_LABELS[game.phase] ?? game.phase} />
        <Stat label="Year" value={`${gameYearOf(clock)}, week ${weekOfYear(clock)}`} />
        <Stat label="Weeks elapsed" value={String(clock.week)} />
        <Stat label="Pending events" value={String(game.pending.length)} />
        <Stat label="Speed" value={game.speed} />
      </div>
      {lastStop && <p className="mt-4 text-sm text-stone-400">{describeStop(lastStop)}</p>}
    </Panel>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-lg">{value}</div>
    </div>
  );
}
