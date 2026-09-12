import { useGameStore } from '@/engine/store';
import { studyProgram } from '@/content/study';
import { placeVerdict, placeWord } from '@/systems/studyWeek';
import Sheet from '../Sheet';

/** The work: a posting's own dials, in words, and how the years there are going. */
export default function PlacePanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.study?.place) return null;
  const program = studyProgram(game.study.program);
  if (!program?.place) return null;
  const years = Math.floor((game.clock.week - game.study.startWeek) / 52);
  return (
    <Sheet title={program.place.label}>
      <p className="ink-muted text-xs">{years === 0 ? 'Your first year here.' : `${years} year${years === 1 ? '' : 's'} here.`} {placeVerdict(game) ? `So far, ${placeVerdict(game)}.` : ''}</p>
      <dl className="mt-2 flex flex-col gap-1 text-sm">
        {program.place.dials.map((d) => (
          <div key={d.id} className="flex justify-between gap-3"><dt className="ink-muted">{d.label}</dt><dd className="text-right">{placeWord(game.study!.place![d.id] ?? 0, d.low, d.high)}</dd></div>
        ))}
      </dl>
      <p className="ink-faint mt-2 text-xs">The hours on the Week sheet move these. The diocese hears how the appointment goes, and the board reads it when the years end.</p>
    </Sheet>
  );
}
