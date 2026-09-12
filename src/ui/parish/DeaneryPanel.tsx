import { useGameStore } from '@/engine/store';
import { coverAvailability, deaneryPriests } from '@/systems/deanery';
import { relationshipWord } from '@/systems/classmates';
import { milesWord } from '@/systems/map';
import Sheet from '../Sheet';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';
import TalkButton from './TalkButton';

/** The deanery: the priests around you, the dean, and the cover you trade. */
export default function DeaneryPanel() {
  const game = useGameStore((s) => s.game);
  const setCover = useGameStore((s) => s.setCover);
  if (!game?.parish?.deanery) return null;
  const priests = deaneryPriests(game);
  const year = yearOf(game.clock.startDay, game.clock.week);
  const dean = priests.find((p) => p.dean);
  const coverId = game.parish.deanery.coverId;
  const cover = coverId ? game.npcs[coverId] : undefined;
  const rival = game.openings.find((o) => o.deaneryRivalId && game.npcs[o.deaneryRivalId]?.status === 'active');
  const rivalNpc = rival?.deaneryRivalId ? game.npcs[rival.deaneryRivalId] : undefined;
  return (
    <Sheet title="The deanery">
      <p className="text-sm leading-relaxed">
        {game.flags['deanery:dean'] ? 'You are the dean: the meeting is yours to run, and the complaints yours to carry.' : dean ? `${dean.npc.title} ${dean.npc.name.last} of ${dean.parish.name} is dean.` : 'The deanery has no dean at the moment.'}{' '}
        {cover ? `You trade cover with ${cover.title} ${cover.name.last}: a block of the week back, and a man who owes you.` : 'Trade cover with a neighbor who trusts you and get a block of the week back.'}
        {rivalNpc && rival && <span className="ink-wine"> {rivalNpc.title} {rivalNpc.name.last} is said to want {rival.label}, and so might you.</span>}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {priests.map(({ npc, parish, miles, dean: isDean }) => {
          const may = coverAvailability(game, npc.id);
          const trading = coverId === npc.id;
          return (
            <li key={npc.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(npc, year)} size={22} />
              <span className="min-w-0 flex-1">
                {npc.title} {npc.name.first} {npc.name.last}, {year - npc.birthYear}{isDean ? ', dean' : ''}
                <span className="ink-faint block text-xs">{parish.name}, {parish.place}, {milesWord(miles)}</span>
              </span>
              <span className="ink-muted">{relationshipWord(npc.relationship)}</span>
              <TalkButton npcId={npc.id} />
              {trading ? (
                <button className="pbtn-link text-xs" onClick={() => setCover(null)}>stop</button>
              ) : (
                <button className="pbtn-link text-xs" disabled={!may.ok} title={may.why ?? 'His Masses when he is away, yours when you are'} onClick={() => may.ok && setCover(npc.id)}>trade cover</button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="ink-faint mt-2 text-xs">The deanery meets monthly; its priests cover for each other, compete for the same parishes, and are the ones who will speak for you or not when a terna is drawn.</p>
    </Sheet>
  );
}
