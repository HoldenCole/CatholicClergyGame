import { useGameStore } from '@/engine/store';
import { currentParish, dialAvailability, frictionOf, frictionWord, mayChangeMass, weeklyCost } from '@/systems/liturgy';
import { facultyGate } from '@/systems/decor';
import Sheet from '../Sheet';

/** The Mass: seven dials the pastor sets, what the people want of each, and how it sits. */
export default function MassPanel() {
  const game = useGameStore((s) => s.game);
  const setDial = useGameStore((s) => s.setDial);
  const petition = useGameStore((s) => s.petition);
  const line = useGameStore((s) => s.lastFurnishLine);
  if (!game?.parish) return null;
  const parish = currentParish(game);
  if (!parish?.liturgy) return null;
  const dials = dialAvailability(game);
  const may = mayChangeMass(game);
  const friction = frictionOf(parish);
  const cost = weeklyCost(parish);
  const fresh = dials.filter((d) => d.changedWeeksAgo !== null && d.changedWeeksAgo < 26).length;
  return (
    <Sheet title="The Mass">
      <p className="text-sm leading-relaxed">
        {may.ok ? 'Yours to set, all of it. ' : `${may.why} `}As it stands it is {frictionWord(friction)}{cost ? `, and it costs $${cost} a week in wax, smoke, and musicians` : ''}.
        {fresh > 0 ? ` ${fresh === 1 ? 'One change is' : `${fresh} changes are`} still fresh; the people have not decided what they think.` : ''}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {dials.map((d) => (
          <li key={d.def.id} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span>{d.def.label}</span>
              <span className={'text-xs ' + (d.fit === 'far' ? 'ink-wine' : 'ink-faint')}>the people want {d.want}{d.fit === 'far' ? '; this is not it' : d.fit === 'near' ? '; near enough' : ''}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {d.options.map((o) => (
                <button
                  key={o.def.id}
                  className={'tab ' + (o.def.id === d.current ? 'tab-active' : '')}
                  disabled={!o.available && o.def.id !== d.current}
                  title={o.def.id === d.current ? 'As it is' : o.why ?? (o.def.cost ? `$${o.def.cost} a week` : '')}
                  onClick={() => o.available && setDial(d.def.id, o.def.id)}
                >
                  {o.def.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="ink-faint mt-2 text-xs">A change shocks the parish and goes on your record. The weeks after decide whether they come round; a Mass they wanted fills the pews, one they did not empties them.</p>
      {(() => {
        const gate = facultyGate(game);
        return (
          <div className="mt-3 border-t rule pt-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span>The older form</span>
              <span className="ink-faint text-xs">the 1962 Missal, by the bishop's faculties</span>
            </div>
            <p className={'mt-0.5 text-xs ' + (gate.ok ? '' : 'ink-muted')}>
              {gate.ok
                ? 'You hold faculties to celebrate it. Put hours to it in the routine, and it is yours to say on a weekday evening; the pastor decides whether it goes on a Sunday.'
                : gate.why}
            </p>
            {gate.canAsk && (
              <button className="pbtn mt-1 px-2 py-0 text-xs" onClick={() => petition('older_form_faculty')}>Write to the chancery for faculties</button>
            )}
            {line && gate.permission?.status === 'pending' && <p className="ink-faint mt-1 text-xs">{line}</p>}
          </div>
        );
      })()}
    </Sheet>
  );
}
