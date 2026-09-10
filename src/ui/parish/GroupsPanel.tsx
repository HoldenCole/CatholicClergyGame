import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { groupTypeDefs } from '@/content/parish';
import { parishGroups, vitalityBand } from '@/systems/groups';
import type { GroupType } from '@/types';
import Sheet from '../Sheet';

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
    <Sheet title="The groups">
      {sustain === 0 && groups.length > 0 && <p className="ink-wine mb-2 text-xs">Nothing in your routine goes to them. They will fade.</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {groups.map((g) => {
          const leader = game.npcs[g.leaderId];
          const band = vitalityBand(g.vitality);
          return (
            <li key={g.id} className="flex items-start justify-between gap-2">
              <div>
                <div>
                  {g.name}
                  <span className={'ml-2 text-xs ' + (band === 'thriving' ? 'text-emerald-800' : band === 'dying' ? 'ink-wine' : 'ink-faint')}>{band}</span>
                  {g.foundedByPlayer && <span className="ml-2 text-xs" style={{ color: '#8f6a1e' }}>yours</span>}
                  {g.hostile && <span className="ink-wine ml-2 text-xs">against you</span>}
                </div>
                {leader && (
                  <div className="ink-muted text-xs">
                    {leader.name.first} {leader.name.last} leads it and {AGENDA_TEXT[g.agenda]}.
                  </div>
                )}
              </div>
              <button className="pbtn-link shrink-0" onClick={() => suppress(g.id, !g.suppressed)} title={g.suppressed ? 'Restore your support' : 'Withdraw support and let it die. The leader will call the chancery.'}>
                {g.suppressed ? 'restore' : 'let it go'}
              </button>
            </li>
          );
        })}
      </ul>
      {founding ? (
        <p className="ink-muted mt-3 text-xs">
          Founding a {groupTypeDefs.find((d) => d.type === founding.type)?.label.toLowerCase()}: {Math.max(0, founding.endWeek - game.clock.week)} weeks to go, {founding.apPerWeek} hours a week.
        </p>
      ) : picking ? (
        <div className="mt-3">
          <div className="ink-muted mb-1 text-xs">Found what? Months of work, and it can fail.</div>
          <div className="flex flex-wrap gap-1">
            {groupTypeDefs
              .filter((d) => !existing.has(d.type))
              .map((d) => (
                <button key={d.type} className="pbtn px-2 py-0.5 text-xs" onClick={() => { found(d.type as GroupType); setPicking(false); }} title={`${d.founding.weeks} weeks at ${d.founding.apPerWeek} hours a week`}>
                  {d.label}
                </button>
              ))}
          </div>
          <button className="pbtn-link mt-2" onClick={() => setPicking(false)}>never mind</button>
        </div>
      ) : (
        <button className="pbtn mt-3" onClick={() => setPicking(true)}>Found a group</button>
      )}
    </Sheet>
  );
}
