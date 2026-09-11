import { useGameStore } from '@/engine/store';
import { mayTalk } from '@/systems/talks';

/** "Have a word": an hour with one person, when the week and the last conversation allow it. */
export default function TalkButton({ npcId }: { npcId: string }) {
  const game = useGameStore((s) => s.game);
  const talk = useGameStore((s) => s.haveAWord);
  if (!game) return null;
  const may = mayTalk(game, npcId);
  if (!may.who) return null;
  return (
    <button className="pbtn-link text-xs" disabled={!may.ok} title={may.ok ? 'An hour of the coming week, and whatever comes of it.' : may.why ?? ''} onClick={() => talk(npcId)}>
      have a word
    </button>
  );
}

/** The last exchange, shown where the man was when he had it. */
export function LastTalk({ npcIds }: { npcIds?: string[] }) {
  const last = useGameStore((s) => s.lastTalk);
  const game = useGameStore((s) => s.game);
  if (!last || !game || last.week !== game.clock.week) return null;
  if (npcIds && !npcIds.includes(last.npcId)) return null;
  return <p className="mt-2 rounded border rule bg-white/30 px-3 py-2 text-sm leading-relaxed">{last.text}</p>;
}
