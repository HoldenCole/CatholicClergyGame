import { useGameStore } from '@/engine/store';
import { candidateLine, mayManageStaff, STAFF_LABEL, staffOf } from '@/systems/staff';
import { relationshipWord } from '@/systems/classmates';
import Sheet from '../Sheet';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';
import TalkButton from './TalkButton';

/** The staff: who sits at each desk, who could, and the pastor's say over it. */
export default function StaffPanel() {
  const game = useGameStore((s) => s.game);
  const letGo = useGameStore((s) => s.letGo);
  const hire = useGameStore((s) => s.hire);
  if (!game?.parish) return null;
  const desks = staffOf(game);
  if (!desks.length) return null;
  const may = mayManageStaff(game);
  const year = yearOf(game.clock.startDay, game.clock.week);
  const hiring = game.parish.hiring ?? {};
  return (
    <Sheet title="The staff">
      <ul className="flex flex-col gap-1.5 text-sm">
        {desks.map(({ tag, npc }) => (
          <li key={tag}>
            {npc ? (
              <div className="flex items-center gap-2">
                <Portrait portrait={portraitForNpc(npc, year)} size={22} />
                <span className="min-w-0 flex-1">
                  {npc.name.first} {npc.name.last}, {STAFF_LABEL[tag]}
                  {game.flags[`staff:new:${tag}`] ? <span className="ink-faint ml-2 text-xs">new</span> : ''}
                </span>
                <span className="ink-muted">{relationshipWord(npc.relationship)}</span>
                <TalkButton npcId={npc.id} />
                {may.ok && <button className="pbtn-link text-xs" title="Let this person go. The people will mind, and the staff more." onClick={() => letGo(npc.id)}>let go</button>}
              </div>
            ) : (
              <div>
                <div className="ink-wine">Nobody at the desk: {STAFF_LABEL[tag]}.</div>
                {may.ok ? (
                  (hiring[tag] ?? []).length ? (
                    <ul className="ml-3 mt-1 flex flex-col gap-1">
                      {hiring[tag]!.map((c) => (
                        <li key={c.id} className="flex items-center gap-2">
                          <Portrait portrait={portraitForNpc(c, year)} size={20} />
                          <span className="min-w-0 flex-1 text-xs">
                            {c.name.first} {c.name.last}, {year - c.birthYear}. <span className="ink-muted">{candidateLine(c)}</span>
                          </span>
                          <button className="pbtn shrink-0 px-2 py-0 text-xs" onClick={() => hire(c.id)}>hire</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ink-faint text-xs">The notice is up; people will come to interview next week.</div>
                  )
                ) : (
                  <div className="ink-faint text-xs">The pastor will hire someone, in his time.</div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
