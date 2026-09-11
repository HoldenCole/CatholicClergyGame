import { useGameStore } from '@/engine/store';
import { classmateLines } from '@/systems/classmates';
import Sheet from '../Sheet';
import TalkButton, { LastTalk } from './TalkButton';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';
import { TRAIT_LABEL } from '../portraits/traits';

/** The class: where each man ordained with you has got to, and how he stands with you. */
export default function ClassmatesPanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.character) return null;
  const lines = classmateLines(game);
  if (lines.length === 0) return null;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const ahead = lines.filter((l) => l.ahead).length;
  return (
    <Sheet title="The class">
      <p className="ink-muted mb-2 text-xs">
        {ahead === 0 ? 'No one ordained with you has gone further than you, yet.' : ahead === 1 ? 'One man from your class has gone further than you.' : `${ahead} men from your class have gone further than you.`}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {lines.map(({ npc, post, regard, ahead: up }) => (
          <li key={npc.id} className={'flex items-center gap-2 ' + (npc.status !== 'active' ? 'ink-faint' : '')}>
            <Portrait portrait={portraitForNpc(npc, year, true)} size={22} />
            <span className="flex-1">
              {npc.title ? `${npc.title} ` : ''}{npc.name.first} {npc.name.last}, {post}
              {up && <span className="ink-wine ml-2 text-xs">ahead of you</span>}
              {npc.traitKnown && <span className="ink-faint ml-2 text-xs">{TRAIT_LABEL[npc.hiddenTrait]}</span>}
            </span>
            <span className="ink-muted">{regard}</span>
            {npc.status === 'active' && <TalkButton npcId={npc.id} />}
          </li>
        ))}
      </ul>
      <LastTalk npcIds={lines.map((l) => l.npc.id)} />
    </Sheet>
  );
}
