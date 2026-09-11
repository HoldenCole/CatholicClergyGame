import { useGameStore } from '@/engine/store';
import { dateOf, gameYearOf, seasonOf, weekOfYear } from '@/engine/time';
import { formatDate, SEASON_LABELS } from '@/engine/calendar';
import type { StopReason } from '@/engine/clock';
import { SPEEDS, type Speed } from '@/types';
import Portrait from './portraits/Portrait';
import { portraitForCharacter, yearOf } from './portraits/spec';

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
    case 'event': return `Something ${stop.event.severity === 'CRITICAL' ? 'that cannot wait' : 'worth your attention'}.`;
    case 'beat': return `${stop.beat.label}.`;
    case 'mode': return 'A decision is waiting.';
    case 'offer': return 'A letter has come.';
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
  const stop = describeStop(lastStop);

  return (
    <header className="plate hud flex items-center justify-between gap-6 px-5 py-2">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="title text-lg tracking-wide" style={{ color: '#e6c25a' }}>Vocation</h1>
        {c && <Portrait portrait={portraitForCharacter(c, yearOf(clock.startDay, clock.week), game.flags.ordained_bishop ? 'bishop' : game.phase)} size={34} title={`${c.name.first} ${c.name.last}`} />}
        <span className="truncate text-sm">
          {c ? `${c.name.first} ${c.name.last}, ` : ''}{game.study ? `${game.see ? `Bishop of ${game.see.see}` : game.study.city === 'rome' || game.study.city === 'washington' ? `Studying in ${game.study.city === 'rome' ? 'Rome' : 'Washington'}` : game.study.label}, year ${Math.floor((clock.week - game.study.startWeek) / 52) + 1}` : (PHASE_LABELS[game.phase] ?? game.phase)}
        </span>
        <span className="truncate text-sm opacity-80">
          Week of {formatDate(dateOf(clock))} · {SEASON_LABELS[seasonOf(clock)]} · year {gameYearOf(clock)}, week {weekOfYear(clock)}
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
        {speed === 'MANUAL' && <HudButton onClick={() => tick()}>Next week</HudButton>}
        {continuous && <HudButton onClick={() => setRunning(!running)}>{running ? 'Hold' : 'Go'}</HudButton>}
        {continuous && !running && <HudButton onClick={() => runToStop()}>To the next stop</HudButton>}
        <HudButton onClick={() => rewind()} disabled={!previous} title="Take back the last week that resolved itself">Take it back</HudButton>
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
