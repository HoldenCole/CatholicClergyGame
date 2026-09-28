import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { actProgress, actsFor, closableParishes, stanceWord, topicWord } from '@/systems/bishop/desk';
import { seeAct } from '@/content/see';
import { LITURGICAL_TOPICS, type LiturgicalStance, type LiturgicalTopic } from '@/types';
import Sheet from '../Sheet';

const STANCES: LiturgicalStance[] = ['free', 'by_permission', 'forbidden'];

/** The bishop's desk: the act being written, or the acts he could begin. E4 R1.1. */
export default function BishopDeskPanel() {
  const game = useGameStore((s) => s.game);
  const begin = useGameStore((s) => s.beginSeeAct);
  const drop = useGameStore((s) => s.dropSeeAct);
  const [picked, setPicked] = useState<string | null>(null);
  const [parishId, setParishId] = useState<string>('');
  const [topic, setTopic] = useState<LiturgicalTopic>('latin_mass');
  const [stance, setStance] = useState<LiturgicalStance>('by_permission');
  if (!game?.see) return null;
  const see = game.see;
  const writing = game.study?.routine.see_desk ?? 0;
  const progress = actProgress(game);
  const onDesk = see.desk ? seeAct(see.desk.actId) : undefined;
  const acts = actsFor(game);
  const chosen = picked ? seeAct(picked) : undefined;
  const parishes = closableParishes(game);
  const policy = game.world?.diocese.hidden.bishop.liturgy;
  const ready = !chosen || (chosen.target === 'parish' ? !!parishId : chosen.target === 'stance' ? policy?.[topic] !== stance : true);
  return (
    <Sheet title="The desk">
      {onDesk && progress ? (
        <div className="text-sm">
          <p className="leading-relaxed">{onDesk.label}{see.desk?.parishId ? `: ${game.world?.parishes.find((p) => p.id === see.desk!.parishId)?.name ?? ''}` : ''}{see.desk?.topic && see.desk.stance ? `: ${topicWord(see.desk.topic)}, ${stanceWord(see.desk.stance)}` : ''}.</p>
          <p className="ink-muted mt-1 text-xs">{progress.done} of {progress.need} blocks written. {writing > 0 ? `${writing} a week at the desk: about ${Math.ceil((progress.need - progress.done) / writing)} week${Math.ceil((progress.need - progress.done) / writing) === 1 ? '' : 's'} more.` : 'Give it blocks of The desk on the Week sheet, or it will never be signed.'}</p>
          <button className="pbtn mt-2 px-2 py-0.5 text-xs" onClick={() => drop()}>Put it in a drawer, unsigned</button>
        </div>
      ) : (
        <div className="text-sm">
          <p className="ink-muted text-xs">Nothing is on the desk. An act is written in the desk's hours and signed when they are done; the diocese reads it the same week.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {acts.map(({ def, ok, why }) => (
              <li key={def.id}>
                <label className={'flex items-start gap-2 text-xs ' + (ok ? 'cursor-pointer' : 'ink-faint')}>
                  <input type="radio" name="act" disabled={!ok} checked={picked === def.id} onChange={() => setPicked(def.id)} />
                  <span>
                    <span className={ok ? '' : 'line-through'}>{def.label}</span> <span className="ink-faint">({def.hours} blocks{why ? `; ${why.toLowerCase()}` : ''})</span>
                    {picked === def.id && <span className="ink-muted block">{def.blurb}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {chosen?.target === 'parish' && (
            <select className="pinput mt-2 text-xs" value={parishId} onChange={(e) => setParishId(e.target.value)}>
              <option value="">Which parish</option>
              {parishes.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.place}: {p.households} households</option>)}
            </select>
          )}
          {chosen?.target === 'stance' && policy && (
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <select className="pinput text-xs" value={topic} onChange={(e) => setTopic(e.target.value as LiturgicalTopic)}>
                {LITURGICAL_TOPICS.map((t) => <option key={t} value={t}>{topicWord(t)} (now {stanceWord(policy[t])})</option>)}
              </select>
              <div className="flex flex-wrap gap-1">
                {STANCES.map((s) => (
                  <button key={s} className={'pbtn px-2 py-0.5 text-xs ' + (stance === s ? 'pbtn-primary' : '')} onClick={() => setStance(s)}>{stanceWord(s)}</button>
                ))}
              </div>
            </div>
          )}
          <button className="pbtn pbtn-primary mt-2 px-2 py-0.5 text-xs" disabled={!chosen || !ready} onClick={() => { if (chosen) begin(chosen.id, chosen.target === 'parish' ? { parishId } : chosen.target === 'stance' ? { topic, stance } : {}); setPicked(null); setParishId(''); }}>Begin</button>
        </div>
      )}
      {see.acts && see.acts.length > 0 && (
        <ul className="ink-muted mt-3 flex flex-col gap-0.5 text-xs">
          {[...see.acts].reverse().map((a, i) => <li key={i}>{seeAct(a.actId)?.label ?? a.actId}{a.parishName ? `: ${a.parishName}` : ''}{a.topic && a.stance ? `: ${topicWord(a.topic)}, ${stanceWord(a.stance)}` : ''}</li>)}
        </ul>
      )}
    </Sheet>
  );
}
