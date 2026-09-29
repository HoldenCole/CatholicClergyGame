import { useGameStore } from '@/engine/store';
import { moneyWord, regardWord, shortageWord } from '@/engine/see';
import { seeDef } from '@/content/sees';
import { OFFICE_LABEL } from '@/generation/chancery';
import { CONFERENCE, OFFICE_LABEL as CONFERENCE_OFFICE_LABEL, nextOffice, temperWord } from '@/systems/conference';
import type { ChanceryOffice } from '@/types';
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
      {game.world && game.world.diocese.presetId === see.dioceseId && (() => {
        const w = game.world;
        const here = (t: string[]) => t.includes(`diocese:${w.diocese.presetId}`);
        const priests = Object.values(game.npcs).filter((n) => n.status === 'active' && n.role === 'priest' && here(n.tags));
        const chancery = w.diocese.hidden.chanceryIds.map((id) => game.npcs[id]).filter((n) => n && n.status === 'active');
        const emeritus = Object.values(game.npcs).find((n) => n.tags.includes('bishop_emeritus') && here(n.tags));
        const office = (n: { tags: string[] }) => OFFICE_LABEL[(n.tags.find((t) => t in OFFICE_LABEL) ?? 'chancellor') as ChanceryOffice];
        return (
          <Sheet title="The diocese">
            <p className="ink-muted text-xs">{w.parishes.length} parishes on the map, and {priests.length} priests of the diocese, every one of whom you must know.</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {chancery.map((n) => (
                <div key={n!.id} className="flex justify-between gap-2"><dt className="ink-muted">{office(n!)}</dt><dd>{n!.title} {n!.name.last}</dd></div>
              ))}
              {emeritus && <div className="flex justify-between gap-2"><dt className="ink-muted">Bishop emeritus</dt><dd>{emeritus.title} {emeritus.name.last}</dd></div>}
            </dl>
            {(see.borrowed?.length || see.lent?.length) ? (
              <p className="ink-muted mt-2 text-xs">
                {see.borrowed?.length ? `On loan to you: ${see.borrowed.map((l) => `${l.name} from ${l.see}, ${Math.max(1, Math.ceil((l.untilWeek - game.clock.week) / 52))} year${Math.ceil((l.untilWeek - game.clock.week) / 52) === 1 ? '' : 's'} to run`).join('; ')}. ` : ''}
                {see.lent?.length ? `Lent: ${see.lent.map((l) => `${l.name} to ${l.see}`).join('; ')}.` : ''}
              </p>
            ) : null}
          </Sheet>
        );
      })()}
      {game.conference && (() => {
        const c = game.conference;
        const held = c.held;
        const yearsLeft = held ? Math.max(0, Math.ceil((held.endWeek - game.clock.week) / 52)) : 0;
        const next = nextOffice(game);
        const last = c.elections?.at(-1);
        const issued = (game.rome?.issued ?? []).filter((d) => d.source === 'conference').slice(-3).reverse();
        const nextElectionYear = (() => { const y = new Date((game.clock.startDay + game.clock.week * 7) * 86_400_000).getUTCFullYear(); let n = y; while (n % 3 !== CONFERENCE.electionYearMod) n++; return n; })();
        return (
          <Sheet title="The conference" fold="closed" summary={held ? `${CONFERENCE_OFFICE_LABEL[held.office]}, ${yearsLeft} year${yearsLeft === 1 ? '' : 's'} to run` : `${temperWord(c.temper)}; ${c.president.name} presides`}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="ink-muted">Its temper</dt><dd>{temperWord(c.temper)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="ink-muted">President</dt><dd>{c.president.npcId === 'player' ? 'you' : c.president.name}</dd></div>
              <div className="flex justify-between gap-2"><dt className="ink-muted">Vice-president</dt><dd>{c.vicePresident.npcId === 'player' ? 'you' : c.vicePresident.name}</dd></div>
              <div className="flex justify-between gap-2"><dt className="ink-muted">Your office</dt><dd>{held ? `${CONFERENCE_OFFICE_LABEL[held.office]}, ${yearsLeft} year${yearsLeft === 1 ? '' : 's'} to run` : next ? `none; ${CONFERENCE_OFFICE_LABEL[next]} is the next rung, elected in November ${nextElectionYear}` : 'none'}</dd></div>
            </dl>
            {last && <p className="ink-muted mt-2 text-xs">Last election: {CONFERENCE_OFFICE_LABEL[last.office]} went to {last.won ? 'you' : last.winnerName} on the {last.rounds === 1 ? 'first' : last.rounds === 2 ? 'second' : last.rounds === 3 ? 'third' : `${last.rounds}th`} ballot{last.stood && !last.won ? '; you stood' : ''}.</p>}
            {c.past && c.past.length > 0 && <p className="ink-muted mt-1 text-xs">Held: {c.past.map((h) => CONFERENCE_OFFICE_LABEL[h.office]).join(', ')}.</p>}
            {issued.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {issued.map((d) => <li key={d.id} className="ink-muted">{d.title}, {d.gist}{d.implemented ? ` (your vote: ${d.implemented === 'eager' ? 'for' : d.implemented === 'defiant' ? 'against' : d.implemented === 'faithful' ? 'with the majority, after an amendment' : 'absent'})` : ''}.</li>)}
              </ul>
            )}
          </Sheet>
        );
      })()}
      {see.former && see.former.length > 0 && (
        <Sheet title="The chairs before this one" fold="closed">
          <ul className="flex flex-col gap-1 text-sm">
            {see.former.map((f) => (
              <li key={f.id} className="ink-muted">{f.name}, {f.region}: {f.years} year{f.years === 1 ? '' : 's'}, {f.ordinations} ordained, {f.closings === 0 ? 'no parishes closed' : `${f.closings} parish${f.closings === 1 ? '' : 'es'} closed`}.</li>
            ))}
          </ul>
        </Sheet>
      )}
      {see.years.length > 0 && (
        <Sheet title="The years" fold="closed" summary={see.years.at(-1)}>
          <ol className="flex flex-col gap-1 text-sm">
            {[...see.years].reverse().map((l, i) => <li key={i} className="ink-muted">{l}</li>)}
          </ol>
        </Sheet>
      )}
    </>
  );
}
