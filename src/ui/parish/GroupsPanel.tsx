import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { groupTypeDefs } from '@/content/parish';
import { parishGroups, vitalityBand } from '@/systems/groups';
import type { GroupType } from '@/types';
import Panel from '../Panel';

const AGENDA_TEXT: Record<string, string> = {
  saintly: 'does it for the right reasons',
  empire: 'treats it as personal property',
  political: 'has a point to make',
  tired: 'has been doing it too long',
  new: 'is new to this',
  grieving: 'is carrying something',
};

export default function GroupsPanel() {
  const game = useGameStore((s) => s.game);
  const found = useGameStore((s) => s.foundGroup);
  const suppress = useGameStore((s) => s.suppressGroup);
  const [picking, setPicking] = useState(false);
  if (!game?.parish) return null;
  const groups = parishGroups(game);
  const existing = new Set(groups.map((g) => g.type));
  const sustain = game.parish.routine.discretionary.groups ?? 0;
  const founding = game.founding;

  return (
    <Panel title="The groups">
      {sustain === 0 && groups.length > 0 && (
        <p className="mb-2 text-xs text-amber-700">Nothing in your routine goes to them. They will fade.</p>
      )}
      <ul className="flex flex-col gap-1.5 text-sm">
        {groups.map((g) => {
          const leader = game.npcs[g.leaderId];
          const band = vitalityBand(g.vitality);
          return (
            <li key={g.id} className="flex items-start justify-between gap-2">
              <div>
                <div>
                  {g.name}
                  <span className={'ml-2 text-xs ' + (band === 'thriving' ? 'text-emerald-500' : band === 'dying' ? 'text-red-500' : 'text-stone-500')}>{band}</span>
                  {g.foundedByPlayer && <span className="ml-2 text-xs text-amber-700">yours</span>}
                  {g.hostile && <span className="ml-2 text-xs text-red-500">against you</span>}
                </div>
                {leader && (
                  <div className="text-xs text-stone-500">
                    {leader.name.first} {leader.name.last} leads it and {AGENDA_TEXT[g.agenda]}.
                  </div>
                )}
              </div>
              <button
                className="shrink-0 text-xs text-stone-500 hover:text-stone-300"
                onClick={() => suppress(g.id, !g.suppressed)}
                title={g.suppressed ? 'Restore your support' : 'Withdraw support and let it die. The leader will call the chancery.'}
              >
                {g.suppressed ? 'restore' : 'let it go'}
              </button>
            </li>
          );
        })}
      </ul>
      {founding ? (
        <p className="mt-3 text-xs text-stone-400">
          Founding a {groupTypeDefs.find((d) => d.type === founding.type)?.label.toLowerCase()}: {Math.max(0, founding.endWeek - game.clock.week)} weeks to go, {founding.apPerWeek} hours a week.
        </p>
      ) : picking ? (
        <div className="mt-3">
          <div className="text-xs text-stone-500 mb-1">Found what? Months of work, and it can fail.</div>
          <div className="flex flex-wrap gap-1">
            {groupTypeDefs
              .filter((d) => !existing.has(d.type))
              .map((d) => (
                <button
                  key={d.type}
                  className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:border-amber-600"
                  onClick={() => {
                    found(d.type as GroupType);
                    setPicking(false);
                  }}
                  title={`${d.founding.weeks} weeks at ${d.founding.apPerWeek} hours a week`}
                >
                  {d.label}
                </button>
              ))}
          </div>
          <button className="mt-2 text-xs text-stone-500" onClick={() => setPicking(false)}>never mind</button>
        </div>
      ) : (
        <button className="mt-3 text-xs text-stone-500 hover:text-stone-300" onClick={() => setPicking(true)}>
          Found a group
        </button>
      )}
    </Panel>
  );
}
