import { useGameStore } from '@/engine/store';
import { evaluateAll } from '@/engine/conditions';
import { currentDecor, gateFor, mayFurnish, optionsFor, slotsFor } from '@/systems/decor';
import type { DecorPlace, DecorSlot } from '@/types';

const SLOT_LABEL: Record<DecorSlot, string> = {
  sanctuary: 'The sanctuary',
  altar_rail: 'The altar rail',
  orientation: 'The altar',
  confessionals: 'Confessions',
  choir: 'The music',
  statues: 'The statues',
  tabernacle: 'The tabernacle',
  mass_form: 'The Mass',
  wall: 'The wall',
  desk: 'The desk',
  floor: 'The floor',
  corner: 'The corner',
};

const PLACE_LABEL: Record<DecorPlace, string> = {
  church: 'How the church looks',
  office: 'How your office looks',
  rectory: 'How the rectory looks',
  seminary_room: 'Your room',
  chancery: 'Your office at the chancery',
};

export default function FurnishPanel({ place, onClose }: { place: DecorPlace; onClose: () => void }) {
  const game = useGameStore((s) => s.game);
  const furnish = useGameStore((s) => s.furnish);
  const petition = useGameStore((s) => s.petition);
  const line = useGameStore((s) => s.lastFurnishLine);
  const error = useGameStore((s) => s.error);
  if (!game) return null;
  const allowed = mayFurnish(game, place);
  const decor = currentDecor(game, place);
  const slots = slotsFor(place);
  const cash = game.parish?.finance.cash ?? 0;

  return (
    <div className="border-t border-stone-800 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm uppercase tracking-widest text-stone-400">{PLACE_LABEL[place]}</h3>
        <button className="text-xs text-stone-500 hover:text-stone-300" onClick={onClose}>close</button>
      </div>
      {!allowed.ok && <p className="mt-2 text-sm text-amber-700">{allowed.why}</p>}
      {allowed.ok && place === 'church' && (
        <p className="mt-1 text-xs text-stone-500">Paid from parish cash (${cash.toLocaleString()} on hand). The parish will react; so will the blocs; the chancery hears about some of it.</p>
      )}
      {slots.length === 0 && <p className="mt-2 text-sm text-stone-500">Nothing here is yours to change.</p>}
      <div className="mt-3 flex flex-col gap-3">
        {slots.map((slot) => (
          <div key={slot}>
            <div className="text-xs uppercase tracking-wider text-stone-500">{SLOT_LABEL[slot]}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {optionsFor(place, slot).map((o) => {
                const chosen = decor[slot] === o.id;
                const meets = evaluateAll(o.requires, game);
                const affordable = o.cost === 0 || cash >= o.cost;
                const gate = gateFor(game, o);
                const can = allowed.ok && meets && affordable && gate.ok && !chosen;
                if (allowed.ok && !chosen && gate.canAsk && o.policy) {
                  return (
                    <button key={o.id} title={`${o.blurb} ${gate.why}`} onClick={() => petition(o.policy!)} className="rounded border border-dashed border-amber-800 px-2 py-1 text-left text-xs text-amber-200/80 hover:border-amber-500">
                      {o.label} <span className="text-stone-500">· write to the chancery</span>
                    </button>
                  );
                }
                return (
                  <button
                    key={o.id}
                    disabled={!can && !chosen}
                    title={`${o.blurb}${!meets ? ' (not open to you yet)' : !affordable ? ' (the parish cannot pay for it)' : !gate.ok ? ` (${gate.why})` : ''}`}
                    onClick={() => furnish(place, o.id)}
                    className={
                      'rounded border px-2 py-1 text-left text-xs ' +
                      (chosen ? 'border-amber-600 bg-amber-950/40 text-amber-100' : can ? 'border-stone-700 text-stone-300 hover:border-amber-600' : 'border-stone-900 text-stone-600')
                    }
                  >
                    {o.label}
                    {o.cost > 0 && <span className="ml-1 text-stone-500">${o.cost.toLocaleString()}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {line && <p className="mt-3 text-sm text-stone-300">{line}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
