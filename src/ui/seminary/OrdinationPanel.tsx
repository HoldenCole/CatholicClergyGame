import { useGameStore } from '@/engine/store';
import { nameArchetype } from '@/systems/formation';
import { ordinationAge } from '@/systems/creation';
import type { Archetype } from '@/types';
import Panel from '../Panel';
import { currentPreference, PREFERENCES, PREFERENCE_LABEL } from '@/systems/assignment';
import { formationStanding, summersOnRecord } from '@/systems/standing';

const ARCHETYPE_TEXT: Record<Archetype, string> = {
  pastoral: 'a pastor: the man people come to, and stay with',
  teaching: 'a teacher: the one who can make a room understand',
  theological: 'a theologian: precise, credible with clergy, dangerous in an argument',
  administrative: 'an administrator: the one who will be given the difficult parish and then the chancery',
  missionary: 'a missionary: restless, prayerful, hard to keep in one place',
};

export default function OrdinationPanel() {
  const game = useGameStore((s) => s.game);
  const ordain = useGameStore((s) => s.ordain);
  const setPreference = useGameStore((s) => s.setPreference);
  if (!game?.character || game.mode.kind !== 'ordination') return null;
  const c = game.character;
  const archetype = nameArchetype(game);
  const classmates = Object.values(game.npcs).filter((n) => n.role === 'classmate');
  const ordainedWith = classmates.filter((n) => n.status === 'active');
  const bishop = Object.values(game.npcs).find((n) => n.tags.includes('bishop'));
  const pref = currentPreference(game);
  return (
    <Panel title="Ordination" tilt="l">
      <p className="leading-relaxed">
        {bishop ? `${bishop.title} ${bishop.name.last}` : 'The bishop'} lays hands on you in the cathedral. You are {ordinationAge(c)}. The seminary
        names you {ARCHETYPE_TEXT[archetype]}. {ordainedWith.length} of the {classmates.length} men you entered with are ordained beside you.
      </p>
      {(() => {
        const standing = formationStanding(game);
        const summers = summersOnRecord(game.seminary);
        const known = [game.flags.known_pastoral && 'a pastor', game.flags.known_scholar && 'a scholar', game.flags.known_administrator && 'a man for the books'].filter((x): x is string => !!x);
        return (
          <div className="mt-3 rounded border rule bg-white/30 p-3 text-sm leading-relaxed">
            <div className="heading mb-1">What the seminary made of you</div>
            <p>The file reads as <span className="font-medium">{standing.word}</span>{standing.reasons.length ? `: ${standing.reasons.join(', ')}` : ''}.{known.length ? ` The diocese has you down as ${known.join(' and ')}.` : ''}</p>
            {c.traits.length > 0 && <p className="ink-muted mt-1">They say of you: {c.traits.slice(-6).join('; ')}.</p>}
            {summers.length > 0 && <p className="ink-muted mt-1">The summers: {summers.map((x) => x.label.toLowerCase()).join(', ')}.</p>}
            {c.credentials.length > 0 && <p className="ink-muted mt-1">You leave with: {c.credentials.join(', ')}.</p>}
          </div>
        );
      })()}
      <p className="ink-muted mt-2 text-sm">
        Positions on the record: {c.positions.filter((p) => p.volume !== 'private').length}. Concerns in the file: {game.seminary?.concerns.length ?? 0}.
      </p>
      <div className="mt-4 border-t rule pt-3">
        <div className="heading mb-1">The preference form</div>
        <p className="ink-muted text-sm">The chancery asks every new priest what he would like. It reads the answer, and then it decides.</p>
        <ul className="mt-2 flex flex-col gap-1">
          {PREFERENCES.map((p) => (
            <li key={p}>
              <button className={'choice ' + (pref === p ? 'choice-chosen' : '')} onClick={() => setPreference(p)}>
                <span>{PREFERENCE_LABEL[p].label}</span>
                <span className="ink-faint ml-2 text-xs">{PREFERENCE_LABEL[p].blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button className="pbtn pbtn-primary mt-4" disabled={!pref} onClick={ordain}>Receive your first assignment</button>
      {!pref && <span className="ink-faint ml-3 text-xs">The form has to say something.</span>}
    </Panel>
  );
}
