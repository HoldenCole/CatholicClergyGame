import { useGameStore } from '@/engine/store';
import { SPEEDS, type Speed } from '@/types';
import Panel from './Panel';

const SPEED_HELP: Record<Speed, string> = {
  PAUSED: 'Nothing advances. Inspect freely.',
  MANUAL: 'Resolve one week at a time.',
  AUTO: 'Runs on the standing routine. Stops on any flagged event.',
  SKIP: 'Runs to the next major beat. Stops only for critical events.',
};

export default function SpeedControls() {
  const game = useGameStore((s) => s.game);
  const running = useGameStore((s) => s.running);
  const previous = useGameStore((s) => s.previous);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const tick = useGameStore((s) => s.tick);
  const runToStop = useGameStore((s) => s.runToStop);
  const setRunning = useGameStore((s) => s.setRunning);
  const rewind = useGameStore((s) => s.rewind);
  if (!game) return null;

  const speed = game.speed;
  const continuous = speed === 'AUTO' || speed === 'SKIP';

  return (
    <Panel title="Speed">
      <div className="flex gap-2">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={
              'rounded px-3 py-1.5 text-sm border ' +
              (s === speed
                ? 'border-amber-600 bg-amber-900/40 text-amber-100'
                : 'border-stone-700 text-stone-300 hover:bg-stone-800')
            }
            onClick={() => setSpeed(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">{SPEED_HELP[speed]}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {speed === 'MANUAL' && (
          <Action onClick={() => tick()}>Resolve week</Action>
        )}
        {continuous && (
          <>
            <Action onClick={() => setRunning(!running)}>{running ? 'Pause clock' : 'Run clock'}</Action>
            <Action onClick={() => runToStop()} disabled={running}>
              Run to next stop
            </Action>
          </>
        )}
        <Action onClick={() => rewind()} disabled={!previous}>
          Rewind one week
        </Action>
      </div>
    </Panel>
  );
}

function Action({
  children,
  onClick,
  disabled,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="rounded bg-stone-800 px-3 py-1.5 text-sm text-stone-100 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
