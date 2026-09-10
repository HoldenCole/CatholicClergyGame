import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { eventKey } from '@/llm/skin';
import Panel from '../Panel';

/** A scene, written on a sheet laid over the room. */
export default function EventPanel() {
  const game = useGameStore((s) => s.game);
  const resolve = useGameStore((s) => s.resolveEvent);
  const prose = useGameStore((s) => s.prose);
  const pending = game?.pending[0];
  if (!game || !pending) return null;
  const event = eventById(pending.eventId);
  if (!event) return <Panel title="Missing event">{pending.eventId}</Panel>;
  const choices = visibleChoices(event, game, pending.bindings);
  const r = (t: string) => renderText(t, game, pending.bindings);

  return (
    <Panel title={`${event.severity === 'CRITICAL' ? 'A decision' : 'This week'} · ${event.category.replace('_', ' ')}`} tilt="l">
      <h2 className="title text-xl">{r(event.title)}</h2>
      <div className="scroll-paper mt-3 max-h-[320px] overflow-y-auto whitespace-pre-line pr-2 leading-relaxed">{prose[eventKey(pending)] ?? r(event.body)}</div>
      <ul className="mt-4 flex flex-col gap-1">
        {choices.map(({ choice, available }) => (
          <li key={choice.id}>
            <button disabled={!available} onClick={() => resolve(choice.id)} className="choice">
              {r(choice.label)}
              {choice.volume && choice.volume !== 'private' && (
                <span className="heading ml-2 ink-wine">{choice.volume === 'public' ? 'on the record' : 'said aloud'}</span>
              )}
              {!available && <span className="ink-faint ml-2 text-xs">not open to you</span>}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
