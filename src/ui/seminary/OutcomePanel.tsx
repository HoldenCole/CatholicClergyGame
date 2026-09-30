import { useGameStore } from '@/engine/store';
import Panel from '../Panel';

/** What came of the last choice, on a sheet laid over the room until it is read. The clock waits; Enter or Escape folds it. */
export default function OutcomePanel() {
  const outcome = useGameStore((s) => s.lastOutcome);
  const prose = useGameStore((s) => s.prose);
  const dismiss = useGameStore((s) => s.dismissOutcome);
  if (!outcome) return null;
  const text = prose[`outcome:${outcome.eventId}:${outcome.week}:${outcome.choiceId}`] ?? outcome.text;
  return (
    <Panel title={`What came of it · ${outcome.title}`} tilt="r">
      <p className="ink-muted text-xs">{outcome.label}{outcome.rolled ? ` · ${outcome.rolled === 'success' ? 'it went your way' : 'it did not go your way'}` : ''}</p>
      <div className="scroll-paper mt-3 max-h-[320px] overflow-y-auto whitespace-pre-line pr-2 leading-relaxed">{text}</div>
      <div className="mt-3 flex items-center justify-between">
        <span className="ink-faint text-xs">The week goes on when you have read it.</span>
        <button className="pbtn text-xs" onClick={() => dismiss()} title="Enter, or Escape">Read</button>
      </div>
    </Panel>
  );
}
