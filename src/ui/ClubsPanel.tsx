import { useGameStore } from '@/engine/store';
import { clubAvailability, clubHours, clubsOf } from '@/systems/clubs';
import { hoursOf } from '@/systems/week';
import Sheet from './Sheet';
import Portrait from './portraits/Portrait';
import { portraitForNpc, yearOf } from './portraits/spec';

/** The societies: what he belongs to, what would have him, and what is by invitation. */
export default function ClubsPanel() {
  const game = useGameStore((s) => s.game);
  const join = useGameStore((s) => s.joinClub);
  const leave = useGameStore((s) => s.leaveClub);
  if (!game?.character) return null;
  const all = clubAvailability(game);
  const mine = all.filter((a) => a.member);
  const open = all.filter((a) => !a.member && a.open);
  const shut = all.filter((a) => !a.member && !a.open);
  const inParish = !!game.parish;
  const hours = clubHours(game);
  const unit = (h: number) => (inParish ? `${hoursOf(h)} hours` : `${h} ${h === 1 ? 'hour' : 'hours'}`);
  const year = yearOf(game.clock.startDay, game.clock.week);

  return (
    <>
      <Sheet title={inParish ? 'Your circles' : 'Your clubs'}>
        {mine.length === 0 ? (
          <p className="ink-faint text-sm">{inParish ? 'You belong to nothing yet. The presbyterate has its tables; find one.' : 'You belong to nothing yet. The house has its societies, and it notices who joins what.'}</p>
        ) : (
          <>
            <p className="ink-muted mb-2 text-xs">{unit(hours)} a week, taken before anything else.</p>
            <ul className="flex flex-col gap-2 text-sm">
              {mine.map(({ def }) => {
                const m = clubsOf(game).memberships[def.id]!;
                const fellows = m.fellows.map((id) => game.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
                return (
                  <li key={def.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div>{def.label} <span className="ink-faint text-xs">· {unit(def.hours)} a week · {def.builds}</span></div>
                      <div className="ink-muted text-xs">
                        {Math.floor(m.weeks / 52) > 0 ? `${Math.floor(m.weeks / 52)} years in. ` : `${m.weeks} weeks in. `}
                        {def.credentialAfter && !m.earned ? `${Math.max(0, def.credentialAfter.weeks - m.weeks)} weeks to something to show for it. ` : ''}
                        {fellows.length > 0 && (
                          <span className="inline-flex items-center gap-1 align-middle">
                            with {fellows.map((n) => (
                              <span key={n.id} className="inline-flex items-center gap-0.5"><Portrait portrait={portraitForNpc(n, year)} size={16} /> {n.name.last}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="pbtn-link shrink-0" onClick={() => leave(def.id)} title={def.onLeave?.length ? 'Leaving costs something with the people you leave.' : ''}>leave</button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Sheet>
      <Sheet title="Open to you">
        {open.length === 0 ? (
          <p className="ink-faint text-sm">Nothing else would have you right now.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {open.map(({ def }) => (
              <li key={def.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div>{def.label} <span className="ink-faint text-xs">· {unit(def.hours)} a week · {def.builds}</span></div>
                  <div className="ink-muted text-xs">{def.blurb}</div>
                </div>
                <button className="pbtn shrink-0 px-2 py-0 text-xs" onClick={() => join(def.id)}>join</button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {shut.length > 0 && (
        <Sheet title="Not open to you">
          <ul className="flex flex-col gap-1 text-sm">
            {shut.map(({ def, why }) => (
              <li key={def.id}>
                <span className="ink-muted">{def.label}</span> <span className="ink-faint text-xs">· {why === 'by invitation' ? `by invitation. ${def.hint ?? 'Be the kind of man they ask.'}` : `needs ${why}`}</span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
