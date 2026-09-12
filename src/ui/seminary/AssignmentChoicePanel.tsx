import { useGameStore } from '@/engine/store';
import Panel from '../Panel';

/** The bishop's desk: every assignment he would give, each with what it is worth, what it takes, and what is involved. */
export default function AssignmentChoicePanel() {
  const game = useGameStore((s) => s.game);
  const choose = useGameStore((s) => s.chooseAssignment);
  if (!game || game.mode.kind !== 'assignment_choice') return null;
  const { options, why } = game.mode;
  return (
    <Panel title="The bishop asks which you would rather" tilt="l">
      <p className="leading-relaxed">{why}</p>
      <ul className={`mt-3 grid gap-3 ${options.length > 3 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((o) => (
          <li key={o.id} className="rounded border rule bg-white/30 px-3 py-2">
            <h3 className="title text-lg">{o.headline}</h3>
            <p className="ink-muted mt-1 text-sm leading-relaxed">{o.blurb}</p>
            <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="ink-faint">Prestige</dt><dd>{o.prestige}</dd>
              <dt className="ink-faint">Time</dt><dd>{o.time}</dd>
              <dt className="ink-faint">Involved</dt><dd>{o.involves.join('; ')}.</dd>
              {o.assignment.reasons.length > 0 && !o.posting && <><dt className="ink-faint">Why you</dt><dd>{o.assignment.reasons.join('; ')}.</dd></>}
            </dl>
            <button className="pbtn pbtn-primary mt-2" onClick={() => choose(o.id)}>{o.posting ? 'Take the chair' : 'Take it'}</button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
