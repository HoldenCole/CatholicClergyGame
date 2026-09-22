import { friarWord } from '@/systems/religious/who';
import { useGameStore } from '@/engine/store';
import { weatherOfWeek } from '@/systems/weather';
import { dateOf, gameYearOf, priesthoodYear, seasonOf, weekOfYear } from '@/engine/time';
import { formatDate, SEASON_LABELS } from '@/engine/calendar';
import type { StopReason } from '@/engine/clock';
import { eventById } from '@/content';
import { SPEEDS, type Speed } from '@/types';
import Portrait from './portraits/Portrait';
import { portraitForPlayer } from './portraits/spec';

const PHASE_LABELS: Record<string, string> = {
  seminary: 'Seminarian',
  study: 'Priest-student',
  parochial_vicar: 'Parochial vicar',
  administrator: 'Administrator',
  pastor: 'Pastor',
  chancery: 'Chancery',
  bishop: 'Bishop',
};

const SPEED_LABEL: Record<Speed, string> = { PAUSED: 'Pause', MANUAL: 'By the week', AUTO: 'Let it run', SKIP: 'Skip ahead' };
const SPEED_HELP: Record<Speed, string> = {
  PAUSED: 'Nothing advances.',
  MANUAL: 'One week at a time.',
  AUTO: 'Runs on the routine; stops for anything you have asked to see.',
  SKIP: 'Runs to the next big thing; stops only for what cannot wait.',
};

function describeStop(stop: StopReason | null): string | null {
  if (!stop) return null;
  switch (stop.kind) {
    case 'paused': return 'Paused.';
    case 'manual': return 'The week is over.';
    case 'event': {
      const title = eventById(stop.event.eventId)?.title;
      return title ? `${stop.event.severity === 'CRITICAL' ? 'It cannot wait' : 'This week'}: ${title.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()}.` : `Something ${stop.event.severity === 'CRITICAL' ? 'that cannot wait' : 'worth your attention'}.`;
    }
    case 'beat': return `${stop.beat.label}.`;
    case 'mode': return 'A decision is waiting.';
    case 'offer': return stop.lapsing ? 'A letter lapses next week.' : 'A letter has come.';
    case 'cap': return 'Stopped to let you look around.';
  }
}

/** The strip above the table: the date, the man's standing, and the clock. */
export default function Hud() {
  const game = useGameStore((s) => s.game);
  const lastStop = useGameStore((s) => s.lastStop);
  const running = useGameStore((s) => s.running);
  const previous = useGameStore((s) => s.previous);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const tick = useGameStore((s) => s.tick);
  const runToStop = useGameStore((s) => s.runToStop);
  const setRunning = useGameStore((s) => s.setRunning);
  const rewind = useGameStore((s) => s.rewind);
  if (!game) return null;
  const { clock, speed } = game;
  const continuous = speed === 'AUTO' || speed === 'SKIP';
  const c = game.character;
  // A decision on the table holds the clock: the buttons that would move it go quiet until it is answered.
  const held = game.pending.length > 0 || game.mode.kind !== 'clock' || game.offers.some((o) => !o.read);
  const stop = game.pending[0] ? describeStop({ kind: 'event', event: game.pending[0] }) : describeStop(lastStop);
  // The seminary counts academic years; a priest counts from the day he was ordained.
  const ordained = typeof game.flags.ordination_week === 'number' && clock.week >= game.flags.ordination_week ? priesthoodYear(clock.week, game.flags.ordination_week) : null;
  const yearLine = ordained ? `year ${ordained.year} ordained, week ${ordained.week}` : `year ${gameYearOf(clock)}, week ${weekOfYear(clock)}`;

  return (
    <header className="plate hud flex items-center justify-between gap-6 px-5 py-2">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="title text-lg tracking-wide" style={{ color: '#e6c25a' }}>Vocation</h1>
        {c && <Portrait portrait={portraitForPlayer(game)} size={34} title={`${c.name.first} ${c.name.last}`} />}
        <span className="truncate text-sm">
          {c ? `${c.name.first} ${c.name.last}, ` : ''}{game.study ? `${game.see ? `Bishop of ${game.see.see}` : game.study.city === 'rome' || game.study.city === 'washington' ? `Studying in ${game.study.city === 'rome' ? 'Rome' : 'Washington'}` : game.study.label}, year ${Math.floor((clock.week - game.study.startWeek) / 52) + 1}` : (friarWord(game) ?? PHASE_LABELS[game.phase] ?? game.phase)}
        </span>
        <span className="truncate text-sm opacity-80">
          Week of {formatDate(dateOf(clock))} · {SEASON_LABELS[seasonOf(clock)]}{game.world ? ` · ${weatherOfWeek(game.seed, clock, game.world.diocese.visible.region).word}` : ''} · {yearLine}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {stop && <span className="mr-2 text-xs opacity-70">{stop}</span>}
        <div className="flex overflow-hidden rounded border border-[#8a6a2a]/60" title={SPEED_HELP[speed]}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={'px-2.5 py-1 text-xs ' + (s === speed ? 'bg-[#c9a24a] text-[#2b2116]' : 'text-[#e8d9b8] hover:bg-[#5a3f22]')}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        {held ? (
          <span className="text-xs text-[#e6c25a]" title="The clock waits on what is on the table">{game.pending.length === 0 && game.mode.kind === 'clock' ? 'Read the letter first' : 'Decide first'}</span>
        ) : (
          <>
            {speed === 'PAUSED' && <span className="ink-faint text-xs" title="The space bar or N advances a week and sets the clock by the week">Space for the next week</span>}
            {speed === 'MANUAL' && <HudButton onClick={() => tick()} title="N, or the space bar">Next week</HudButton>}
            {continuous && <HudButton onClick={() => setRunning(!running)} title="N, or the space bar">{running ? 'Hold' : 'Go'}</HudButton>}
            {continuous && !running && <HudButton onClick={() => runToStop()}>To the next stop</HudButton>}
          </>
        )}
        <HudButton onClick={() => rewind()} disabled={!previous || held} title="Take back the last week that resolved itself (Z)">Take it back</HudButton>
      </div>
    </header>
  );
}

function HudButton({ children, onClick, disabled, title }: { children: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      className="rounded border border-[#8a6a2a]/60 bg-[#2b1d10] px-2.5 py-1 text-xs text-[#e8d9b8] hover:bg-[#5a3f22] disabled:opacity-35 disabled:hover:bg-[#2b1d10]"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
