import { useGameStore } from '@/engine/store';
import { nameArchetype } from '@/systems/formation';
import { ordinationAge } from '@/systems/creation';
import type { Archetype } from '@/types';
import Panel from '../Panel';

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
  if (!game?.character || game.mode.kind !== 'ordination') return null;
  const c = game.character;
  const archetype = nameArchetype(game);
  const classmates = Object.values(game.npcs).filter((n) => n.role === 'classmate');
  const ordainedWith = classmates.filter((n) => n.status === 'active');
  const bishop = Object.values(game.npcs).find((n) => n.tags.includes('bishop'));
  return (
    <Panel title="Ordination" tilt="l">
      <p className="leading-relaxed">
        {bishop ? `${bishop.title} ${bishop.name.last}` : 'The bishop'} lays hands on you in the cathedral. You are {ordinationAge(c)}. The seminary
        names you {ARCHETYPE_TEXT[archetype]}. {ordainedWith.length} of the {classmates.length} men you entered with are ordained beside you.
      </p>
      {c.credentials.length > 0 && <p className="ink-muted mt-2 text-sm">You leave with: {c.credentials.join(', ')}.</p>}
      <p className="ink-muted mt-2 text-sm">
        Positions on the record: {c.positions.filter((p) => p.volume !== 'private').length}. Concerns in the file: {game.seminary?.concerns.length ?? 0}.
      </p>
      <button className="pbtn pbtn-primary mt-4" onClick={ordain}>Receive your first assignment</button>
    </Panel>
  );
}
