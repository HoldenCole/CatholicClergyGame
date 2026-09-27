import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { fromDayNumber } from '@/engine/calendar';
import { CONCLAVE, PLAYER } from '@/systems/rome/conclave';
import { regnalChoices } from '@/systems/rome/conclaveFlow';
import Panel from './Panel';

const SPEECH: { key: 'continuity' | 'reform' | 'pastor' | 'governance'; label: string; line: string }[] = [
  { key: 'continuity', label: 'Continuity', line: 'what the late pope began, carried on' },
  { key: 'reform', label: 'Reform', line: 'a Church that changes what it must' },
  { key: 'pastor', label: 'A pastor', line: 'a man who has had a parish, and hears confessions' },
  { key: 'governance', label: 'Governance', line: 'a man who can run the Curia' },
];

/** The conclave from inside: the general congregations, the ballot, the rounds read aloud in the Sistine Chapel, and the name. E1 §7. */
export default function ConclavePanel() {
  const game = useGameStore((s) => s.game);
  const act = useGameStore((s) => s.conclaveAct);
  const hold = useGameStore((s) => s.holdConclave);
  const answer = useGameStore((s) => s.answerConclave);
  const [shown, setShown] = useState(1);
  const c = game?.rome?.conclave;
  if (!game || !c || game.mode.kind !== 'conclave') return null;
  const since = game.rome!.vacancy!.sinceDay;
  const year = fromDayNumber(since).year;
  const card = (id: string) => game.rome!.college?.find((x) => x.id === id);
  const name = (id: string) => (id === PLAYER ? 'you' : `Cardinal ${card(id)?.name ?? id}`);
  const describe = (id: string) => {
    const x = card(id);
    return x ? `${x.from}, ${year - x.born}` : '';
  };
  const needed = Math.ceil(c.electorIds.length * (CONCLAVE.threshold ?? 2 / 3) - 1e-9);
  const others = c.candidateIds.filter((id) => id !== PLAYER);
  const a = c.actions;

  if (!c.ballots) {
    return (
      <Panel title="The conclave" tilt="r">
        <p className="leading-relaxed">
          The see of Rome is vacant, and you are one of {c.electorIds.length} cardinal electors. For a week the College has met in the general congregations: who speaks, what the Church needs, which names are said in the corridors. The names are not declared; they are only said. {c.candidateIds.includes(PLAYER) ? 'Yours is among them.' : ''}
        </p>
        <div className="mt-3 text-sm">
          <div className="heading text-sm">Your intervention in the congregations</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {SPEECH.map((sp) => (
              <button key={sp.key} className={'pbtn px-2 py-0.5 text-xs ' + (a.speech === sp.key ? 'pbtn-primary' : '')} title={sp.line} onClick={() => act('speech', sp.key)}>{sp.label}</button>
            ))}
          </div>
          <p className="ink-faint mt-1 text-xs">Five minutes, in Italian. What you say moves the room a little toward the men who answer it, and is remembered of you.</p>
        </div>
        <div className="mt-3 text-sm">
          <div className="heading text-sm">Your ballot</div>
          <div className="mt-1 flex flex-col gap-1">
            {others.map((id) => (
              <button key={id} className={'pbtn px-2 py-0.5 text-left text-xs ' + (a.vote === id ? 'pbtn-primary' : '')} onClick={() => act('vote', id)}>
                {name(id)} <span className="ink-faint">({describe(id)})</span>
              </button>
            ))}
          </div>
          <p className="ink-faint mt-1 text-xs">Eligo in Summum Pontificem: written in a hand that disguises your own, folded twice, and laid in the chalice.</p>
        </div>
        {c.candidateIds.includes(PLAYER) && (
          <div className="mt-3 text-sm">
            <div className="heading text-sm">Your own name</div>
            <div className="mt-1 flex gap-2">
              <button className={'pbtn px-2 py-0.5 text-xs ' + (a.signal === 'unwilling' ? 'pbtn-primary' : '')} onClick={() => act('signal', 'unwilling')}>Let it be known you would rather not</button>
              <button className={'pbtn px-2 py-0.5 text-xs ' + (a.signal === 'willing' ? 'pbtn-primary' : '')} onClick={() => act('signal', 'willing')}>Let it be known you would serve</button>
            </div>
            <p className="ink-faint mt-1 text-xs">Very quietly. The College distrusts the man who wants it, a little the man who says he does not, and most of all the man who is seen to be counting.</p>
          </div>
        )}
        <button className="pbtn pbtn-primary mt-4" disabled={!a.vote} onClick={() => { setShown(1); hold(); }}>Extra omnes: into the Sistine Chapel</button>
      </Panel>
    );
  }

  const rounds = c.ballots;
  const visible = rounds.slice(0, shown);
  const done = shown >= rounds.length;
  const elected = c.electedId!;
  const choices = regnalChoices(game);
  return (
    <Panel title="The ballots" tilt="r">
      <p className="ink-faint text-xs">{c.electorIds.length} electors; {needed} for the two thirds. Four ballots a day, the smoke after each morning and each afternoon.{c.declined ? ' You refused the College once; it votes again without you.' : ''}</p>
      <ol className="mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
        {visible.map((r) => {
          const tallies = Object.entries(r.tallies).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
          return (
            <li key={r.round} className="rounded border rule bg-white/30 px-3 py-2">
              <div className="heading text-xs">Ballot {r.round}{r.field.length <= 2 && r.round > CONCLAVE.majorityRounds ? ' · the two leaders, who do not vote' : ''}</div>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {tallies.map(([id, v]) => (
                  <li key={id} className="flex justify-between"><span>{name(id)}</span><span className="font-mono">{v}</span></li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      {!done ? (
        <div className="mt-3 flex gap-2">
          <button className="pbtn" onClick={() => setShown((n) => n + 1)}>The next ballot</button>
          <button className="pbtn" onClick={() => setShown(rounds.length)}>Read them all</button>
        </div>
      ) : elected === PLAYER ? (
        <div className="mt-3 text-sm">
          <p className="leading-relaxed">The last ballot is counted and the room is very quiet. The Cardinal Dean comes down the chapel to your place and asks you, in Latin, whether you accept your canonical election as Supreme Pontiff, and by what name you wish to be called.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((n) => (
              <button key={n} className="pbtn pbtn-primary" onClick={() => answer(true, n)}>Accepto: {n}</button>
            ))}
            <button className="pbtn" onClick={() => { setShown(1); answer(false); }}>Do not accept</button>
          </div>
          <p className="ink-faint mt-1 text-xs">A man may refuse, and the College will vote again. Accepting ends a priest's life and begins another.</p>
        </div>
      ) : (
        <div className="mt-3 text-sm">
          <p className="leading-relaxed">{name(elected)} of {card(elected)?.from ?? 'the College'} has two thirds. He accepts, and chooses a name, and goes to the Room of Tears to be dressed in white. You go up with the others to promise him obedience.</p>
          <button className="pbtn pbtn-primary mt-2" onClick={() => answer(true)}>The white smoke</button>
        </div>
      )}
    </Panel>
  );
}
