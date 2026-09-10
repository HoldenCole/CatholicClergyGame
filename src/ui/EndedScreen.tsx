import { useGameStore } from '@/engine/store';

const ENDING_TITLE: Record<string, string> = {
  dismissed: 'Dismissed',
  left_seminary: 'You left',
  left_priesthood: 'You left the priesthood',
  died: 'Requiescat',
  retired: 'Retired',
};

export default function EndedScreen() {
  const game = useGameStore((s) => s.game);
  const newGame = useGameStore((s) => s.newGame);
  if (!game || game.mode.kind !== 'ended') return null;
  const c = game.character;
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded border border-stone-800 bg-stone-900/60 p-8 flex flex-col gap-4">
        <h1 className="text-2xl">{ENDING_TITLE[game.mode.ending] ?? game.mode.ending}</h1>
        <p className="text-stone-200 leading-relaxed">{game.mode.summary}</p>
        {c && (
          <p className="text-sm text-stone-400">
            {c.name.first} {c.name.last}, {game.seminary ? `year ${game.seminary.year} of formation` : ''}. {game.history.length} decisions recorded.
          </p>
        )}
        <button className="self-start rounded border border-stone-700 px-4 py-2 text-sm hover:bg-stone-800" onClick={() => newGame({ seed: `run-${Date.now().toString(36)}` })}>
          Begin again
        </button>
      </div>
    </div>
  );
}
