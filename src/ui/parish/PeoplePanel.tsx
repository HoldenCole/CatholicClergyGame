import { useGameStore } from '@/engine/store';
import { bondsPhrase, parishPeople } from '@/systems/bonds';
import { relationshipWord } from '@/systems/classmates';
import Sheet from '../Sheet';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';
import { TRAIT_LABEL } from '../portraits/traits';

/** The people you know: the named parishioners, and what you have done for them. */
export default function PeoplePanel() {
  const game = useGameStore((s) => s.game);
  if (!game?.parish) return null;
  const people = parishPeople(game);
  if (!people.length) return null;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const known = people.filter((n) => (n.bonds?.length ?? 0) > 0).length;
  return (
    <Sheet title="The people you know">
      <p className="ink-muted mb-2 text-xs">{known === 0 ? 'Names on the registry, so far. The sacraments will make them yours.' : known === 1 ? 'One family the parish will remember you by.' : `${known} people the parish will remember you by.`}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {people.map((n) => {
          const phrase = bondsPhrase(n);
          return (
            <li key={n.id} className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(n, year)} size={22} />
              <span className="min-w-0 flex-1">
                {n.name.first} {n.name.last}, {year - n.birthYear}
                {phrase && <span className="ink-muted">, {phrase}</span>}
                {n.traitKnown && <span className="ink-faint ml-2 text-xs">{TRAIT_LABEL[n.hiddenTrait]}</span>}
              </span>
              <span className="ink-muted">{relationshipWord(n.relationship)}</span>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
