import { eventById } from '@/content';
import { visibleChoices } from '@/engine/events';
import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import Panel from '../Panel';

export default function EventPanel() {
  const game = useGameStore((s) => s.game);
  const resolve = useGameStore((s) => s.resolveEvent);
  const pending = game?.pending[0];
  if (!game || !pending) return null;
  const event = eventById(pending.eventId);
  if (!event) return <Panel title="Missing event">{pending.eventId}</Panel>;
  const choices = visibleChoices(event, game, pending.bindings);
  const r = (t: string) => renderText(t, game, pending.bindings);

  return (
    <Panel title={`${event.severity === 'CRITICAL' ? 'A decision' : 'This week'} · ${event.category.replace('_', ' ')}`}>
      <h2 className="text-xl">{r(event.title)}</h2>
      <div className="mt-3 text-stone-200 leading-relaxed whitespace-pre-line max-h-[300px] overflow-y-auto pr-2">{r(event.body)}</div>
      <ul className="mt-4 flex flex-col gap-2">
        {choices.map(({ choice, available }) => (
          <li key={choice.id}>
            <button
              disabled={!available}
              onClick={() => resolve(choice.id)}
              className={
                'w-full text-left rounded border px-3 py-2 ' +
                (available ? 'border-stone-700 hover:border-amber-600 hover:bg-amber-950/20' : 'border-stone-800 text-stone-600 cursor-not-allowed')
              }
            >
              {r(choice.label)}
              {choice.volume && choice.volume !== 'private' && (
                <span className="ml-2 text-xs uppercase tracking-wider text-amber-700">{choice.volume === 'public' ? 'on the record' : 'said aloud'}</span>
              )}
              {!available && <span className="ml-2 text-xs text-stone-600">not open to you</span>}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
