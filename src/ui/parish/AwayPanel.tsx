import { useGameStore } from '@/engine/store';
import { awayAvailability, retreatDue, vacationLeft } from '@/systems/away';
import { awayPlace } from '@/content/parish';
import { controlsMoney } from '@/systems/finance';
import Sheet from '../Sheet';

/** The retreat the law asks for and the vacation the body does. */
export default function AwayPanel() {
  const game = useGameStore((s) => s.game);
  const goAway = useGameStore((s) => s.goAway);
  if (!game?.parish) return null;
  const options = awayAvailability(game);
  const due = retreatDue(game);
  const left = vacationLeft(game);
  const away = game.away ? awayPlace(game.away.placeId) : null;
  return (
    <Sheet title="Away">
      {away ? (
        <p className="text-sm leading-relaxed">{away.label}: {game.away!.weeksLeft} week{game.away!.weeksLeft === 1 ? '' : 's'} to go. The supply priest has the Masses; the parish will keep.</p>
      ) : (
        <p className="text-sm leading-relaxed">
          {due ? 'The retreat is still owed this year; canon 276 asks a week, and so does the chancery.' : 'The retreat is made for this year.'}{' '}
          {left > 0 ? `${left} week${left === 1 ? '' : 's'} of vacation left this year.` : 'No vacation left this year.'}
          {controlsMoney(game) && ' A supply priest costs the parish while a pastor is gone.'}
        </p>
      )}
      {!away && (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {options.map(({ def, available, why }) => (
            <li key={def.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={available ? '' : 'ink-muted'}>{def.label} <span className="ink-faint text-xs">· {def.kind === 'retreat' ? 'the retreat' : def.kind === 'supply' ? 'on loan' : 'vacation'}, {def.weeks} week{def.weeks === 1 ? '' : 's'}</span></div>
                <div className="ink-faint text-xs">{available ? def.blurb : why}</div>
              </div>
              {available && <button className="pbtn shrink-0 px-2 py-0 text-xs" onClick={() => goAway(def.id)}>go</button>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
