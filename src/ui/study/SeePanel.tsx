import { useGameStore } from '@/engine/store';
import { moneyWord, regardWord, shortageWord } from '@/engine/see';
import { seeDef } from '@/content/sees';
import Sheet from '../Sheet';

/** The see: what a bishop holds, in words, and the years so far. */
export default function SeePanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.see) return null;
  const see = game.see;
  const def = seeDef(see.id);
  const years = Math.floor((game.clock.week - see.installedWeek) / 52);
  const rows: [string, string][] = [
    ['The priests', regardWord(see.presbyterate)],
    ['The people', regardWord(see.people)],
    ['Rome', regardWord(see.rome)],
    ['The money', moneyWord(see.money)],
    ['Priests to parishes', shortageWord(see.shortage)],
    ['Ordained by you', see.ordinations === 0 ? 'no one yet' : String(see.ordinations)],
    ['Parishes closed', see.closings === 0 ? 'none' : String(see.closings)],
  ];
  return (
    <>
      <Sheet title={`${see.name.charAt(0).toUpperCase()}${see.name.slice(1)}, ${see.region}`}>
        {def && <p className="text-sm leading-relaxed">{def.character}</p>}
        <p className="ink-muted mt-2 text-xs">{def ? `About ${def.priests} priests and ${def.parishes} parishes and missions. ` : ''}{years === 0 ? 'Your first year in the chair.' : `${years} year${years === 1 ? '' : 's'} in the chair.`}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2"><dt className="ink-muted">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </Sheet>
      {see.years.length > 0 && (
        <Sheet title="The years">
          <ol className="flex flex-col gap-1 text-sm">
            {[...see.years].reverse().map((l, i) => <li key={i} className="ink-muted">{l}</li>)}
          </ol>
        </Sheet>
      )}
    </>
  );
}
