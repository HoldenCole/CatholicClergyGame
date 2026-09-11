import { useGameStore } from '@/engine/store';
import { allOffers } from '@/content/offers';
import { currentPreference, PREFERENCES, PREFERENCE_LABEL } from '@/systems/assignment';
import { chancesFor } from '@/systems/openings';
import { CATEGORY_WORD, offerDoors } from '@/systems/doors';
import { formationStanding, summersOnRecord } from '@/systems/standing';
import type { Opening } from '@/types';
import Sheet from './Sheet';

const KIND_WORD: Record<Opening['kind'], string> = { pastor: 'Pastor', administrator: 'Administrator', parochial_vicar: 'Parochial vicar', chancery: 'A chancery post' };
const AFFILIATION_WORD: Record<string, string> = {
  'affiliation:cursillo': 'Cursillo', 'affiliation:diocesan_fraternity': 'the diocesan fraternity', 'affiliation:opus_dei': 'Opus Dei',
  'affiliation:prog_caucus': 'the progressive clergy caucus', 'affiliation:trad_fraternity': 'the traditionalist fraternity',
};

function urgencyWord(u: number): string {
  return u >= 70 ? 'needed now' : u >= 45 ? 'open' : 'no hurry';
}

/**
 * The jobs sheet: what the man has asked for, the openings he could try
 * for, the doors open and shut to him, the groups that would have him,
 * and what is on his record. DESIGN §7.4 and §7.5 rule 1.
 */
export default function JobsPanel() {
  const game = useGameStore((s) => s.game);
  const setPreference = useGameStore((s) => s.setPreference);
  const apply = useGameStore((s) => s.applyForOpening);
  if (!game?.character) return null;
  const inParish = !!game.parish;
  const pref = currentPreference(game);
  const doors = offerDoors(game, allOffers);
  const social = (d: { category: string }) => d.category === 'social';
  const ready = doors.ready.filter((d) => !social(d));
  const closed = doors.closed.filter((d) => !social(d.def)).slice(0, 8);
  const groupsReady = doors.ready.filter(social);
  const groupsClosed = doors.closed.filter((d) => social(d.def));
  const affiliations = Object.keys(game.flags).filter((k) => k.startsWith('affiliation:') && game.flags[k]).map((k) => AFFILIATION_WORD[k] ?? k.slice('affiliation:'.length));
  const summers = summersOnRecord(game.seminary);
  const standing = formationStanding(game);
  const away = !!game.study;
  const canAsk = inParish || away || (game.seminary?.year ?? 0) >= 5;
  const applications = game.career.filter((e) => e.text.startsWith('Put your name in')).slice(-4);

  return (
    <>
      <Sheet title="What you have asked the chancery for">
        {canAsk ? (
          <>
            <p className="ink-muted text-xs leading-relaxed">
              {inParish ? 'The personnel board reads this when your arc ends.' : away ? 'The board will find you a post when you come home, and reads this when it does.' : 'The vicar for clergy asks the deacons where they would go. The bishop decides.'}
              {pref ? '' : ' You have not said.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {PREFERENCES.map((p) => (
                <button key={p} className={'pbtn px-2 py-0.5 text-xs ' + (pref === p ? 'pbtn-active' : '')} onClick={() => setPreference(p)} title={PREFERENCE_LABEL[p].blurb}>
                  {PREFERENCE_LABEL[p].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="ink-faint text-xs">The chancery does not ask a man in the early years. From the fifth year on, it will.</p>
        )}
        {!inParish && !away && (
          <p className="ink-muted mt-3 text-xs leading-relaxed">
            The bishop will read your file as <span className="ink">{standing.word}</span>{standing.reasons.length ? `: ${standing.reasons.join(', ')}` : ''}. The flagship and the growing parishes go to the men he wants seen; the rural posts and the hard parish are where he seasons the rest, or spends a good man where one is needed.
          </p>
        )}
      </Sheet>

      {inParish && (
        <Sheet title="Openings coming up">
          {game.openings.length === 0 ? (
            <p className="ink-faint text-sm">Nothing is open in the diocese this year. Pastors retire in the spring.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {game.openings.map((o) => {
                const parish = o.parishId ? game.world?.parishes.find((p) => p.id === o.parishId) : undefined;
                const ch = chancesFor(game, o);
                return (
                  <li key={o.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div>
                        {KIND_WORD[o.kind]}{parish ? ` of ${parish.name}, ${parish.place}` : `: ${o.label.toLowerCase()}`}
                        <span className="ink-faint ml-2 text-xs">{urgencyWord(o.urgency)}{o.needsSpanish ? ' · Spanish' : ''}{o.needsAdmin ? ' · the books' : ''}</span>
                      </div>
                      <div className="ink-muted text-xs">
                        {ch.verdict}: {ch.readiness}, {ch.trust}, {ch.fit}{ch.reasons.length ? ` (${ch.reasons.slice(0, 3).join(', ')})` : ''}.
                      </div>
                    </div>
                    <button className={'pbtn shrink-0 px-2 py-0 text-xs ' + (o.applied ? 'pbtn-active' : '')} disabled={!!o.applied} onClick={() => apply(o.id)} title="The board is told you want it. It counts, a little, and the chancery notices a man who asks for everything.">
                      {o.applied ? 'your name is in' : 'put your name forward'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {applications.length > 0 && <p className="ink-faint mt-2 text-xs">{applications.map((a) => a.text).join(' ')}</p>}
        </Sheet>
      )}

      <Sheet title="Doors open to you">
        {ready.length === 0 ? (
          <p className="ink-faint text-sm">Nothing you qualify for is unspoken for right now. Build something and the offers follow.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {ready.map((d) => (
              <li key={d.id}>
                {d.title} <span className="ink-faint text-xs">· {CATEGORY_WORD[d.category]} · may come your way</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet title="Doors not yet open">
        {closed.length === 0 ? (
          <p className="ink-faint text-sm">Nothing in reach is shut to you.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {closed.map(({ def, why }) => (
              <li key={def.id}>
                {def.title} <span className="ink-faint text-xs">· needs {why}</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet title="Groups and affiliations">
        {affiliations.length > 0 && <p className="mb-2 text-sm">You belong to {affiliations.join(' and ')}. People will judge you by it for the rest of your life.</p>}
        {groupsReady.length === 0 && groupsClosed.length === 0 && affiliations.length === 0 && <p className="ink-faint text-sm">No group would have you yet, and none has asked.</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {groupsReady.map((d) => (
            <li key={d.id}>{d.title} <span className="ink-faint text-xs">· would have you; an invitation may come</span></li>
          ))}
          {groupsClosed.map(({ def, why }) => (
            <li key={def.id}>{def.title} <span className="ink-faint text-xs">· needs {why}</span></li>
          ))}
        </ul>
      </Sheet>

      {(summers.length > 0 || game.character.credentials.length > 0) && (
        <Sheet title="On your record">
          <ul className="flex flex-col gap-1 text-sm">
            {summers.map((s) => (
              <li key={s.year}>Summer of year {s.year}: {s.label.toLowerCase()}.</li>
            ))}
            {game.character.credentials.length > 0 && <li>Credentials: {game.character.credentials.map((c) => c.replace(/_/g, ' ')).join(', ')}.</li>}
          </ul>
        </Sheet>
      )}
    </>
  );
}
