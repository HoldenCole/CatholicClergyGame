import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { PLAYER_ID } from '@/systems/religious/electorate';
import { houseById } from '@/systems/religious/house';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';

/** A chapter in session: the talk before the vote, then the ballots watched round by round, then the answer. E3 §3.6. */
export default function ChapterPanel() {
  const game = useGameStore((s) => s.game);
  const act = useGameStore((s) => s.chapterAct);
  const hold = useGameStore((s) => s.holdBallots);
  const answer = useGameStore((s) => s.answerElection);
  const [shown, setShown] = useState(1);
  if (!game?.religious?.chapter || game.mode.kind !== 'chapter') return null;
  const ch = game.religious.chapter;
  const order = religiousOrder(game.religious.order);
  const office = ch.office === 'prior' ? order.governance.priorTitle : ch.office === 'provincial' ? order.governance.provincialTitle : ch.office ?? 'office';
  const body = ch.level === 'house' ? houseById(game, ch.bodyId)?.name ?? 'the house' : game.province?.name ?? 'the province';
  const name = (id: string) => (id === PLAYER_ID ? 'you' : `${game.npcs[id]?.title ?? ''} ${game.npcs[id]?.name.last ?? id}`.trim());
  const elector = ch.electorIds.includes(PLAYER_ID);
  const candidate = ch.candidateIds.includes(PLAYER_ID);
  const others = ch.candidateIds.filter((id) => id !== PLAYER_ID);
  const a = ch.actions;

  if (!ch.outcome) {
    return (
      <Panel title={`${ch.level === 'house' ? 'House chapter' : 'Provincial chapter'}: the election of a ${office}`} tilt="r">
        <p className="leading-relaxed">{body} is in chapter. No one is a declared candidate; every eligible man can receive votes, and the talk before the vote is where the province decides what it thinks.{elector ? ' You have a vote.' : ' You are not of the body this time, and watch from the gallery.'}{candidate ? ' Your own name is among those the room could turn to.' : ''}</p>
        {elector && (
          <div className="mt-3 text-sm">
            <div className="heading text-sm">Your ballot</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {others.slice(0, 12).map((id) => (
                <button key={id} className={'pbtn px-2 py-0.5 text-xs ' + (a.vote === id ? 'pbtn-primary' : '')} onClick={() => act('vote', id)}>{name(id)}</button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.vote && a.spokeFor.length < 2 && <button className="pbtn px-2 py-0.5 text-xs" onClick={() => act('speak', a.vote)}>Speak for {name(a.vote)}{a.spokeFor.length ? ' again' : ''}</button>}
              {a.vote && !a.steered && <button className="pbtn px-2 py-0.5 text-xs" onClick={() => act('steer', a.vote)}>Quietly steer a bloc to him</button>}
            </div>
            <p className="ink-faint mt-1 text-xs">Speaking once is heard. Twice is too visibly, and steering backfires when seen; both raise how ambitious you look.</p>
          </div>
        )}
        {candidate && (
          <div className="mt-3 text-sm">
            <div className="heading text-sm">Your own name</div>
            <div className="mt-1 flex gap-2">
              <button className={'pbtn px-2 py-0.5 text-xs ' + (a.signal === 'unwilling' ? 'pbtn-primary' : '')} onClick={() => act('unwilling')}>Let it be known you would rather not</button>
              <button className={'pbtn px-2 py-0.5 text-xs ' + (a.signal === 'willing' ? 'pbtn-primary' : '')} onClick={() => act('willing')}>Let it be known you would serve</button>
            </div>
            <p className="ink-faint mt-1 text-xs">Privately and carefully. The room hears both, and remembers the second.</p>
          </div>
        )}
        <button className="pbtn pbtn-primary mt-4" onClick={() => { setShown(1); hold(); }}>Go to the vote</button>
      </Panel>
    );
  }

  const rounds = ch.ballots;
  const visible = rounds.slice(0, shown);
  const done = shown >= rounds.length;
  const majority = Math.floor(ch.electorIds.length / 2) + 1;
  const elected = ch.outcome.electedId;
  return (
    <Panel title={`The ballots for ${office}`} tilt="r">
      <p className="ink-faint text-xs">{ch.electorIds.length} electors; {majority} for an absolute majority in the first rounds.</p>
      <ol className="mt-2 flex flex-col gap-2 text-sm">
        {visible.map((r) => {
          const tallies = Object.entries(r.tallies).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
          return (
            <li key={r.round} className="rounded border rule bg-white/30 px-3 py-2">
              <div className="heading text-xs">Ballot {r.round}{r.absolute ? '' : ' · the field narrowed'}</div>
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
        <button className="pbtn mt-3" onClick={() => setShown((n) => n + 1)}>The next ballot</button>
      ) : ch.outcome.accepted ? (
        <div className="mt-3 text-sm">
          <p>{name(elected) === 'you' ? 'You are' : `${name(elected)} is`} {office} of {body}{ch.outcome.second ? ', after the first choice was declined or refused' : ''}.</p>
          <button className="pbtn pbtn-primary mt-2" onClick={() => answer(true)}>Close the chapter</button>
        </div>
      ) : elected === PLAYER_ID ? (
        <div className="mt-3 text-sm">
          <p className="leading-relaxed">The room turns to you. Elected {office} of {body}, {ch.ended === 'majority' ? 'by an absolute majority' : ch.ended === 'narrowed' ? 'on the narrowed ballot' : 'on a plurality when the rounds ran out'}. The higher superior must confirm; he almost always does.</p>
          <div className="mt-2 flex gap-2">
            <button className="pbtn pbtn-primary" onClick={() => answer(true)}>Accept</button>
            <button className="pbtn" onClick={() => answer(false)}>Decline</button>
          </div>
          <p className="ink-faint mt-1 text-xs">Declining carries honour when you were not seen to want it, and a cost when the province needed you. Declining twice ends the question for good.</p>
        </div>
      ) : (
        <div className="mt-3 text-sm">
          <p>{name(elected)} is elected {office} of {body}, {ch.ended === 'majority' ? 'by an absolute majority' : ch.ended === 'narrowed' ? 'on the narrowed ballot' : 'on a plurality'}. He accepts, and the higher superior confirms.</p>
          <button className="pbtn pbtn-primary mt-2" onClick={() => answer(true)}>Close the chapter</button>
        </div>
      )}
    </Panel>
  );
}
