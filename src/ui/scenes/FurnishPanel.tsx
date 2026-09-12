import { useGameStore } from '@/engine/store';
import { evaluateAll } from '@/engine/conditions';
import { seasonOf } from '@/engine/time';
import { currentDecor, gateFor, mayFurnish, optionsFor, previewState, slotsFor, stanceFor, TOPIC_LABEL } from '@/systems/decor';
import type { DecorOption, DecorPlace, DecorSlot } from '@/types';
import { useUiStore } from '../uiStore';
import SceneArt from './SceneArt';
import type { SceneId } from './scenes';

const SLOT_LABEL: Record<DecorSlot, string> = {
  sanctuary: 'The sanctuary',
  altar_rail: 'The altar rail',
  orientation: 'The altar',
  confessionals: 'Confessions',
  choir: 'The choir',
  statues: 'The statues',
  tabernacle: 'The tabernacle',
  mass_form: 'The Mass',
  music: 'What the parish sings',
  style: 'The room',
  devotion: 'The devotion',
  seating: 'The seating',
  wall: 'The wall',
  desk: 'The desk',
  floor: 'The floor',
  corner: 'The corner',
};

const PLACE_LABEL: Record<DecorPlace, string> = {
  church: 'How the church looks',
  chapel: 'How the chapel looks',
  office: 'How your office looks',
  rectory: 'How the rectory looks',
  seminary_room: 'Your room',
  chancery: 'Your office at the chancery',
};
const PLACE_SCENE: Record<DecorPlace, SceneId> = { church: 'church', chapel: 'chapel', office: 'office', rectory: 'rectory', seminary_room: 'seminary_room', chancery: 'chancery' };

/**
 * The furnishing sheet. Hovering an option shows the room as it would
 * look; choosing it spends the money and provokes whatever it provokes.
 * What the bishop governs is marked, and a letter can be sent from here.
 */
export default function FurnishPanel({ place }: { place: DecorPlace }) {
  const game = useGameStore((s) => s.game);
  const furnish = useGameStore((s) => s.furnish);
  const petition = useGameStore((s) => s.petition);
  const line = useGameStore((s) => s.lastFurnishLine);
  const setPreview = useUiStore((s) => s.setPreview);
  const selectedRef = useUiStore((s) => s.selected);
  const select = useUiStore((s) => s.select);
  const close = useUiStore((s) => s.furnish);
  if (!game) return null;
  const allowed = mayFurnish(game, place);
  const decor = currentDecor(game, place);
  const slots = slotsFor(place);
  const cash = game.parish?.finance.cash ?? 0;
  const bishopId = game.world?.diocese.hidden.bishop.npcId;
  const bishop = bishopId ? game.npcs[bishopId] : undefined;
  const selected = selectedRef && selectedRef.place === place ? optionsFor(place).find((o) => o.id === selectedRef.optionId) ?? null : null;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b rule px-5 pt-4 pb-2">
        <h3 className="heading">{PLACE_LABEL[place]}</h3>
        <button className="pbtn-link" onClick={() => close(null)}>put it away</button>
      </div>
      <div className="px-5 py-3 text-sm">
        {!allowed.ok && <p className="ink-wine">{allowed.why}</p>}
        {allowed.ok && (place === 'church' || place === 'chapel') && (
          <p className="ink-muted text-xs leading-relaxed">
            Paid from parish cash, ${cash.toLocaleString()} on hand. The parish will react; so will the blocs; the chancery hears about some of it.
            {bishop && ` ${bishop.title} ${bishop.name.last} decides what needs his leave.`}
          </p>
        )}
        {allowed.ok && place !== 'church' && place !== 'chapel' && <p className="ink-muted text-xs">Yours to arrange. Nobody minds.</p>}
        {line && <p className="mt-2 rounded border rule bg-white/30 px-3 py-2 text-sm">{line}</p>}
      </div>
      {selected && (
        <div className="sticky top-0 z-10">
          <Selected option={selected} place={place} onDone={() => select(null)} onFurnish={() => { furnish(place, selected.id); select(null); }} onPetition={() => { if (selected.policy) petition(selected.policy); select(null); }} />
        </div>
      )}
      <div className="flex flex-col">
        {slots.map((slot) => (
          <section key={slot} className="border-t rule px-5 py-3">
            <div className="heading mb-2">{SLOT_LABEL[slot]}</div>
            <ul className="flex flex-col gap-1">
              {optionsFor(place, slot).map((o) => {
                const chosen = decor[slot] === o.id;
                const meets = evaluateAll(o.requires, game);
                const affordable = o.cost === 0 || cash >= o.cost;
                const gate = gateFor(game, o);
                const status = chosen ? 'as it is' : !allowed.ok ? '' : !meets ? 'not open to you yet' : gate.stance === 'forbidden' ? 'not permitted here' : gate.canAsk ? 'needs the bishop’s leave' : gate.permission?.status === 'pending' ? 'asked; waiting' : gate.permission?.status === 'denied' && !gate.ok ? 'refused' : !affordable ? 'cannot pay for it' : '';
                return (
                  <li key={o.id}>
                    <button
                      className={'choice flex items-center gap-3 ' + (chosen ? 'choice-chosen' : '') + (selected?.id === o.id ? ' border-[#7a1f1f]' : '')}
                      onMouseEnter={() => setPreview({ place, optionId: o.id })}
                      onMouseLeave={() => setPreview(null)}
                      onClick={() => select(selected?.id === o.id ? null : { place, optionId: o.id })}
                    >
                      <Thumb place={place} optionId={o.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block">{o.label}</span>
                        <span className="ink-faint block text-xs">
                          {o.cost > 0 ? `$${o.cost.toLocaleString()}` : 'no cost'}{status ? ` · ${status}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Thumb({ place, optionId }: { place: DecorPlace; optionId: string }) {
  const game = useGameStore((s) => s.game)!;
  return (
    <span className="relative block h-[36px] w-[60px] shrink-0 overflow-hidden rounded-sm border border-[#7a6a4a]/50 bg-[#1a120c]">
      <SceneArt scene={PLACE_SCENE[place]} season={seasonOf(game.clock)} state={previewState(game, place, optionId)} plain />
    </span>
  );
}

function Selected({ option, place, onDone, onFurnish, onPetition }: { option: DecorOption; place: DecorPlace; onDone: () => void; onFurnish: () => void; onPetition: () => void }) {
  const game = useGameStore((s) => s.game)!;
  const allowed = mayFurnish(game, place);
  const chosen = currentDecor(game, place)[option.slot] === option.id;
  const meets = evaluateAll(option.requires, game);
  const cash = game.parish?.finance.cash ?? 0;
  const affordable = option.cost === 0 || cash >= option.cost;
  const gate = gateFor(game, option);
  const stance = option.policy ? stanceFor(game, option.policy) : null;
  const parish = game.world?.parishes.find((p) => p.id === game.assignment?.parishId);
  const gap = option.alignment !== null && parish ? Math.abs(option.alignment - parish.alignment) : 0;
  const reaction = (place !== 'church' && place !== 'chapel') || option.alignment === null ? null : gap < 30 ? 'The parish would take it as their own.' : gap < 60 ? 'Some would mind.' : 'Letters would be written.';
  return (
    <div className="border-y rule px-5 py-3 text-sm shadow-md" style={{ background: '#f6efdd' }}>
      <div className="flex items-baseline justify-between">
        <strong>{option.label}</strong>
        <button className="pbtn-link" onClick={onDone}>never mind</button>
      </div>
      <p className="ink-muted mt-1 leading-relaxed">{option.blurb}</p>
      {option.policy && stance && (
        <p className="mt-1 text-xs ink-muted">
          {stance === 'free' ? `The bishop leaves ${TOPIC_LABEL[option.policy]} to pastors.` : stance === 'by_permission' ? `The bishop must be asked about ${TOPIC_LABEL[option.policy]}.` : `The bishop does not allow ${TOPIC_LABEL[option.policy]} in this diocese.`}
        </p>
      )}
      {reaction && <p className="mt-1 text-xs ink-wine">{reaction}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chosen ? (
          <span className="ink-faint text-xs">This is how it is now.</span>
        ) : !allowed.ok ? (
          <span className="ink-faint text-xs">{allowed.why}</span>
        ) : !meets ? (
          <span className="ink-faint text-xs">Not open to you yet.</span>
        ) : gate.ok ? (
          <button className="pbtn pbtn-primary" disabled={!affordable} onClick={onFurnish}>
            {option.cost > 0 ? `Do it, for $${option.cost.toLocaleString()}` : 'Do it'}
          </button>
        ) : gate.canAsk ? (
          <button className="pbtn" onClick={onPetition}>Write to the chancery</button>
        ) : (
          <span className="ink-faint text-xs">{gate.why}</span>
        )}
        {!affordable && gate.ok && !chosen && <span className="ink-faint text-xs">The parish cannot pay for it.</span>}
      </div>
    </div>
  );
}
