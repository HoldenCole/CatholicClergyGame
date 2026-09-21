import { useGameStore } from '@/engine/store';
import { currentHouse, houseLine } from '@/systems/religious/house';
import { horariumLoad } from '@/systems/religious/horarium';
import { currentPosting } from '@/systems/religious/transfer';
import { friendshipLoad } from '@/systems/religious/friendship';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';
import DigestPanel from '../DigestPanel';

const WORK: Record<string, string> = {
  parish: 'the parish the house serves',
  school: 'the school',
  teaching: 'the house of studies, teaching',
  formation: 'the formation house',
  priory_church: 'the priory church and the pulpit',
  preaching: 'the pulpit',
  mission: 'the mission',
  curia: "the provincial's house",
};

/** An ordained friar's week without a parish loop of his own: the house's, and the posting's. E3 §3.3. */
export default function FriarWeekPanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.religious) return null;
  const house = currentHouse(game);
  const posting = currentPosting(game);
  const order = religiousOrder(game.religious.order);
  const load = horariumLoad(game) + friendshipLoad(game);
  return (
    <>
      <Panel title="The week">
        <p className="leading-relaxed">{house ? houseLine(game, house) : ''}</p>
        <p className="ink-muted mt-2 text-sm">
          The common life takes {load} blocks before anything else; the House sheet sets how you keep it. Your work is {WORK[posting?.work ?? ''] ?? 'the house\'s'}{game.religious.office ? `, and you are ${game.religious.office.office === 'prior' ? order.governance.priorTitle : order.governance.provincialTitle}` : game.religious.appointment ? `, and you hold the office of ${order.offices.find((o) => o.id === game.religious!.appointment!.id)?.label.toLowerCase() ?? 'an appointment'}` : ''}.
        </p>
        <p className="ink-faint mt-2 text-xs">The provincial assigns you for a term of three to six years and consults you before each letter. A parish entrusted to the order is held by two keys. Chapters elect the prior and the provincial, and you watch the ballots.</p>
      </Panel>
      <DigestPanel />
    </>
  );
}
