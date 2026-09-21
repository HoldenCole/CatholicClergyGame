import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { houseById } from '@/systems/religious/house';
import Panel from '../Panel';

const REASON: Record<string, string> = {
  first: 'Ordained, and the provincial has you in for the first talk about where you will go.',
  term: 'The term in this house has run; the provincial has you in to talk about the next one.',
  bishop: 'The bishop has asked the province for the parish back. The provincial has you in.',
  province: 'The province needs you elsewhere, the provincial says, and has you in to say where.',
  withdrawal: 'The province is withdrawing from the parish. The provincial has you in about what comes after.',
};

function need(n: number): string {
  return n >= 65 ? 'they badly need a man' : n >= 40 ? 'they could use one' : 'they would take one';
}
function fit(n: number): string {
  return n >= 65 ? 'the work suits you' : n >= 45 ? 'you could do it' : 'it is not your work';
}

/** The consultation before an assignment: state a preference, object on real grounds, then the provincial decides. E3 §3.1. */
export default function ConsultationPanel() {
  const game = useGameStore((s) => s.game);
  const statePreference = useGameStore((s) => s.statePreference);
  const decide = useGameStore((s) => s.letProvincialDecide);
  const [objection, setObjection] = useState(false);
  if (!game?.religious?.consultation || game.mode.kind !== 'consultation') return null;
  const c = game.religious.consultation;
  const provincial = game.province ? game.npcs[game.province.provincialId] : undefined;
  return (
    <Panel title="The consultation" tilt="r">
      <p className="leading-relaxed">{REASON[c.reason] ?? REASON.term}{provincial ? ` ${provincial.title} ${provincial.name.last} has three houses in mind and says so, and then asks what you think.` : ''}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {c.options.map((o) => {
          const house = houseById(game, o.houseId);
          const chosen = c.preference === o.houseId;
          return (
            <li key={o.houseId} className={'rounded border rule px-3 py-2 ' + (chosen ? 'choice-chosen' : 'bg-white/30')}>
              <div className="font-medium">{house?.name ?? o.houseId} <span className="ink-faint text-xs">· {o.work.replace('_', ' ')}</span></div>
              <p className="ink-muted text-xs">{o.line}</p>
              <p className="ink-faint text-xs">As he puts it: {need(o.need)}; {fit(o.fit)}{o.formation >= 60 ? '; and a young friar should see it' : ''}.</p>
              <button className="pbtn mt-1 px-2 py-0.5 text-xs" onClick={() => statePreference(o.houseId, objection)}>{chosen ? 'Asked for' : 'Ask for this one'}</button>
            </li>
          );
        })}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={objection} onChange={(e) => { setObjection(e.target.checked); statePreference(c.preference ?? null, e.target.checked); }} />
        <span>Object on real grounds to being sent anywhere but the house you asked for. He weighs it; he does not obey it.</span>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button className="pbtn pbtn-primary" onClick={() => decide()}>Let the provincial decide</button>
        <span className="ink-faint text-xs">Obedience is the default, and the province honours it. The letter follows.</span>
      </div>
    </Panel>
  );
}
