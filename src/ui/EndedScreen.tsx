import { useGameStore } from '@/engine/store';
import { careerSummary } from '@/engine/career';

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
  const ending = game.mode.ending;
  const showCareer = game.flags.ordained && (ending === 'left_priesthood' || ending === 'retired' || ending === 'died') && !/years a priest/.test(game.mode.summary);
  const career = showCareer && c ? careerSummary(game, ending as 'left_priesthood' | 'retired' | 'died') : null;
  return (
    <div className="felt flex min-h-screen items-center justify-center p-6">
      <div className="paper paper-tilt-r flex w-full max-w-2xl flex-col gap-4 px-8 py-8">
        <h1 className="title text-2xl">{ENDING_TITLE[game.mode.ending] ?? game.mode.ending}</h1>
        <p className="whitespace-pre-line leading-relaxed">{game.mode.summary}</p>
        {career && <p className="ink-muted whitespace-pre-line border-t rule pt-4 leading-relaxed">{career}</p>}
        {c && (
          <p className="ink-faint text-sm">
            {c.name.first} {c.name.last}{game.seminary ? `, year ${game.seminary.year} of formation` : ''}. {game.history.length} decisions recorded.
          </p>
        )}
        <button className="pbtn self-start" onClick={() => newGame({ seed: `run-${Date.now().toString(36)}` })}>Begin again</button>
      </div>
    </div>
  );
}
