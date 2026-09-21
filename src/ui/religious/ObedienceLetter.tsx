import { useGameStore } from '@/engine/store';
import { houseById } from '@/systems/religious/house';
import { OBEDIENCE } from '@/systems/religious/obedience';
import Panel from '../Panel';

/** The provincial's letter: taken with good grace, with visible reluctance, or refused. E3 §3.1. */
export default function ObedienceLetter() {
  const game = useGameStore((s) => s.game);
  const answer = useGameStore((s) => s.answerLetter);
  if (!game?.religious?.consultation?.decided || game.mode.kind !== 'obedience_letter') return null;
  const d = game.religious.consultation.decided;
  const house = houseById(game, d.houseId);
  const provincial = game.province ? game.npcs[game.province.provincialId] : undefined;
  const asked = game.religious.consultation.preference === d.houseId;
  const refusals = game.religious.obedience.refused;
  return (
    <Panel title="A letter from the provincial" tilt="r">
      <pre className="whitespace-pre-wrap font-[inherit] leading-relaxed">{`Dear Father,

After our conversation, and having consulted the council, I am assigning you to ${house?.name ?? 'the house'}${house ? `, in the ${game.territory?.[house.dioceseId]?.diocese.visible.name ?? game.world?.diocese.visible.name ?? 'diocese'}` : ''}, for ${d.work === 'parish' ? 'the parish' : d.work === 'school' ? 'the school' : d.work === 'formation' ? 'the formation house' : d.work === 'teaching' ? 'the house of studies' : 'the priory and its church'}.${asked ? ' It is the house you asked for.' : ''} ${d.reasons.length ? `I will say plainly that ${d.reasons.join(', and that ')}.` : ''}

Please be there by the first of the month. The prior expects you.

Fraternally in St. ${game.religious.order === 'OP' ? 'Dominic' : 'Augustine'},
${provincial ? `${provincial.title} ${provincial.name.first} ${provincial.name.last}` : 'The Prior Provincial'}`}</pre>
      {house && <p className="ink-muted mt-3 text-sm">{house.name}: {house.memberIds.length} men, {house.kind === 'parish' ? 'a small community at a parish held by two keys: the bishop\'s and the provincial\'s.' : `a ${house.kind}.`}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="pbtn pbtn-primary" onClick={() => answer('good')}>Go, with good grace</button>
        <button className="pbtn" onClick={() => answer('reluctant')}>Go, and let it show</button>
        <button className="pbtn" onClick={() => answer('refused')}>Refuse</button>
      </div>
      <p className="ink-faint mt-2 text-xs">
        Accepting well raises your standing with the provincial and the province and steadies your prayer. Reluctance is remembered. Refusal is open to you and almost never right{refusals >= OBEDIENCE.processAfterRefusals - 1 ? ': a second refusal opens the process that can end in dismissal from the order' : ''}.
      </p>
    </Panel>
  );
}
