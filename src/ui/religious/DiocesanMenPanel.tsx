import { useGameStore } from '@/engine/store';
import { diocesanClassmateLine, diocesanClassmates } from '@/systems/religious/diocesanClassmates';
import { directees, DIRECTING } from '@/systems/religious/directing';
import { relationshipWord } from '@/systems/classmates';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

/**
 * The diocese's men a friar knows: the seminarians from the shared lectures
 * who became the diocese's priests, the seminary's men when he teaches
 * there, and the ones he directs, under the seal. E3 §3.13.
 */
export default function DiocesanMenPanel() {
  const game = useGameStore((s) => s.game);
  const answer = useGameStore((s) => s.answerDirectionAsk);
  const end = useGameStore((s) => s.endDirectee);
  if (!game?.religious) return null;
  const r = game.religious;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const mates = diocesanClassmates(game);
  const did = game.world?.diocese.presetId ?? '';
  const men = (r.seminarians?.[did] ?? []).map((id) => game.npcs[id]).filter((n) => !!n);
  const directed = directees(game);
  const ask = r.directionAsk ? game.npcs[r.directionAsk.npcId] : undefined;
  if (!mates.length && !men.length && !directed.length && !ask && !r.directingLine) return null;
  const here = game.world?.diocese.presetId;
  return (
    <Panel title="The diocese's men">
      {mates.length > 0 && (
        <div className="text-sm">
          <div className="heading text-sm">From the seminary lectures</div>
          <p className="ink-faint text-xs">The diocesan seminary sent its men to the same hall for the theology years. Ordained the June you were; the diocese's priests now, and the file says so.</p>
          <ul className="mt-1 flex flex-col gap-1">
            {mates.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <Portrait portrait={portraitForNpc(n, year)} size={22} />
                <span className="min-w-0 flex-1">{n.title ? `${n.title} ` : ''}{n.name.first} {n.name.last}, {year - n.birthYear}: {diocesanClassmateLine(n)}{n.tags.includes(`diocese:${here}`) ? '' : ', in another diocese'}.</span>
                <span className="ink-muted text-xs">{relationshipWord(n.relationship)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {men.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="heading text-sm">The seminary's men</div>
          <p className="ink-faint text-xs">The diocesan seminary's students, while you teach there. They will be this diocese's priests, and they will remember who taught them.</p>
          <ul className="mt-1 flex flex-col gap-1">
            {men.map((n) => (
              <li key={n!.id} className="flex items-center gap-2">
                <Portrait portrait={portraitForNpc(n!, year)} size={22} />
                <span className="min-w-0 flex-1">{n!.title ? `${n!.title} ` : ''}{n!.name.first} {n!.name.last}, {year - n!.birthYear}: {n!.role === 'priest' ? 'ordained' : 'a seminarian'}.</span>
                <span className="ink-muted text-xs">{relationshipWord(n!.relationship)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 text-sm">
        <div className="heading text-sm">Direction you give ({directed.length} of {DIRECTING.slots})</div>
        <p className="ink-faint text-xs">A block a week each. What is said in the room stays in it: the engine will not let it move a standing.</p>
        {r.directingLine && <p className="mt-1 rounded border rule bg-white/30 p-2 text-xs italic">{r.directingLine}</p>}
        {ask && (
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span>{ask.title ? `${ask.title} ` : ''}{ask.name.first} {ask.name.last} has asked you to direct him.</span>
            <button className="pbtn px-2 py-0.5 text-xs" onClick={() => answer(true)}>Yes</button>
            <button className="pbtn px-2 py-0.5 text-xs" onClick={() => answer(false)}>Give him a name</button>
          </p>
        )}
        {directed.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {directed.map((d) => (
              <li key={d.npc.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">{d.npc.title ? `${d.npc.title} ` : ''}{d.npc.name.first} {d.npc.name.last}, since {Math.floor((game.clock.week - d.sinceWeek) / 52)} year{Math.floor((game.clock.week - d.sinceWeek) / 52) === 1 ? '' : 's'}.</span>
                <button className="pbtn-link text-xs" onClick={() => end(d.npc.id)}>end</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
