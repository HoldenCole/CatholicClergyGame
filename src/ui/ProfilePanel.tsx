import { useGameStore } from '@/engine/store';
import { profileOf } from '@/systems/profile';
import { requestHistory } from '@/systems/request';
import { worksDone } from '@/systems/sidework';
import Sheet from './Sheet';
import Portrait from './portraits/Portrait';
import { portraitForPlayer } from './portraits/spec';
import { identitiesOf, phraseOf, reputationDef, reputationWord, topReputations, REPUTATIONS } from '@/systems/religious/reputations';

/**
 * The profile: the one sheet that answers "what have I done with forty
 * years". DESIGN §8.6 — whole numbers and plain sentences, and the only
 * screen in the game where the numbers are the point.
 */
export default function ProfilePanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.character) return null;
  const p = profileOf(game);
  const asked = requestHistory(game).filter((r) => r.outcome);
  const works = worksDone(game);

  return (
    <>
      <Sheet title="The man">
        <div className="flex items-start gap-3">
          <Portrait portrait={portraitForPlayer(game)} size={64} />
          <div className="min-w-0">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="ink-muted text-sm">
              {p.age}, born {p.born}{p.ordainedYear ? `, ordained ${p.ordainedYear}` : ''}{p.diocese ? ` for ${p.diocese}` : ''}.
            </div>
            <div className="ink-muted text-sm">{p.post}.</div>
            <div className="ink-faint mt-1 text-xs">{p.line}</div>
          </div>
        </div>
      </Sheet>

      {game.religious && game.flags.ordained && (() => {
        const top = topReputations(game).filter((r) => r.value >= 20);
        const ids = identitiesOf(game);
        const phrase = phraseOf(game);
        const mine = game.religious.observance;
        return (
          <Sheet title="What you are known for">
            <p className="text-sm leading-relaxed">
              {phrase ? `The province, asked, would say: ${phrase}.` : 'The province could not yet say what you are in one phrase, and a man it cannot describe it does not elect.'}
              {mine !== undefined ? ` Your own observance: ${mine >= 70 ? 'strict' : mine >= 45 ? 'as the house keeps it' : 'relaxed'}.` : ''}
            </p>
            {top.length > 0 && (
              <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                {top.map((r) => (
                  <li key={r.key}><span className="font-medium">{reputationDef(r.key).label}</span>: {reputationWord(r.value)}{game.flags[`rep:overshoot:${r.key}`] ? <span className="ink-wine"> · more than you have earned</span> : ''}. <span className="ink-faint text-xs">{reputationDef(r.key).line}</span></li>
                ))}
              </ul>
            )}
            {ids.length > 0 && (
              <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                {ids.map((d) => <li key={d.id}><span className="font-medium">{d.label}.</span> <span className="ink-muted">{d.line}</span></li>)}
              </ul>
            )}
            <p className="ink-faint mt-2 text-xs">A reputation is built by the hours, week after week, and held under the stats behind it; it travels with you when every local standing resets, and fades only when wholly unused. Known from {REPUTATIONS.known}.</p>
          </Sheet>
        );
      })()}
      <Sheet title="The book">
        {p.ministry.length === 0 ? (
          <p className="ink-faint text-sm">Nothing counted yet. The book opens at ordination.</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {p.ministry.map((row) => (
                <li key={row.key} className="flex justify-between gap-2">
                  <span className="ink-muted">{row.label}</span>
                  <span className="tabular-nums">{row.value.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <p className="ink-faint mt-2 text-xs">
              Counted from the weeks as you worked them: the Masses you kept, the hours you sat in the box, and your share of what a parish that size asks for — a pastor takes the weddings and the funerals, his vicar takes the baptisms, and an aging parish buries more than it baptizes.
            </p>
          </>
        )}
      </Sheet>

      <Sheet title="Where you have been">
        {p.tenures.length === 0 ? (
          <p className="ink-faint text-sm">Nowhere yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {p.tenures.map((t, i) => (
              <li key={`${t.startWeek}-${i}`}>
                <div>
                  {t.label} <span className="ink-muted">of {t.place}</span>
                  <span className="ink-faint ml-2 text-xs">{Math.max(1, Math.round((t.endWeek - t.startWeek) / 52))} year{Math.round((t.endWeek - t.startWeek) / 52) === 1 ? '' : 's'}{t.left ? ` · ${t.left}` : ''}</span>
                </div>
                {t.verdict && <div className="ink-muted text-xs">{t.verdict}.</div>}
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      {p.impacts.some((i) => i.turnaround) && (
        <Sheet title="Parishes you turned">
          <ul className="flex flex-col gap-1 text-sm">
            {p.impacts.filter((i) => i.turnaround).map((i) => (
              <li key={i.place}>
                {i.place} <span className="ink-faint text-xs">· {i.years} year{i.years === 1 ? '' : 's'} · {i.verdict.toLowerCase()} when you left</span>
              </li>
            ))}
          </ul>
          <p className="ink-faint mt-2 text-xs">A parish the diocese had written off, handed on alive. The board remembers these longer than it remembers the flagship.</p>
        </Sheet>
      )}

      <Sheet title="The men">
        <ul className="flex flex-col gap-1 text-sm">
          {p.formed.length === 0 && p.vocations === 0 && <li className="ink-faint">No one yet. Take a summer seminarian, and spend the hours on the young men of the parish.</li>}
          {p.formed.map((f) => (
            <li key={`${f.name}-${f.year}`}>
              {f.name} <span className="ink-faint text-xs">· summer of {f.year} · you wrote {f.verdict} · {f.now}</span>
            </li>
          ))}
          {p.vocations > 0 && (
            <li className="ink-muted">
              {p.vocations === 1 ? 'One man' : `${p.vocations} men`} of your parishes entered the seminary.
            </li>
          )}
        </ul>
      </Sheet>

      <Sheet title="On the record">
        <ul className="flex flex-col gap-1 text-sm">
          {p.offices.length > 0 && <li>Offices: {p.offices.join(', ')}.</li>}
          {p.credentials.length > 0 && <li>Degrees and credentials: {p.credentials.map((c) => c.replace(/_/g, ' ')).join(', ')}.</li>}
          {p.groupsFounded > 0 && <li>Founded {p.groupsFounded === 1 ? 'one group' : `${p.groupsFounded} groups`} in the parishes you served.</li>}
          {works.length > 0 && <li>Besides the parish: {works.join('; ')}.</li>}
          {asked.length > 0 && (
            <li>
              Asked the chancery for: {asked.map((r) => `${r.label} (${r.outcome})`).join('; ')}.
            </li>
          )}
          {p.offices.length === 0 && p.credentials.length === 0 && p.groupsFounded === 0 && asked.length === 0 && works.length === 0 && <li className="ink-faint">Nothing the chancery would file.</li>}
        </ul>
      </Sheet>
    </>
  );
}
