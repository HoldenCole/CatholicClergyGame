import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { groupTypeDefs } from '@/content/parish';
import { groupTrend, mayReplaceLeader, parishGroups, vitalityBand } from '@/systems/groups';
import { hoursOf } from '@/systems/week';
import type { GroupType } from '@/types';
import Sheet from '../Sheet';
import TalkButton, { LastTalk } from './TalkButton';

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
  const focus = useGameStore((s) => s.focusGroup);
  const replace = useGameStore((s) => s.replaceLeader);
  const [picking, setPicking] = useState(false);
  if (!game?.parish) return null;
  const groups = parishGroups(game);
  const existing = new Set(groups.map((g) => g.type));
  const sustain = game.parish.routine.discretionary.groups ?? 0;
  const founding = game.founding;
  const focused = groups.filter((g) => g.focus && !g.suppressed && !g.hostile);
  const mayReplace = mayReplaceLeader(game);
  const trendWord = (d: number) => (d >= 1.5 ? 'coming back fast' : d >= 0.3 ? 'gaining' : d > -0.3 ? 'holding' : d > -1.5 ? 'fading' : 'withering');

  return (
    <Sheet title="The groups">
      {sustain === 0 && groups.length > 0 ? (
        <p className="ink-wine mb-2 text-xs">Nothing in your routine goes to them. They will fade.</p>
      ) : groups.length > 0 ? (
        <p className="ink-muted mb-2 text-xs">
          {hoursOf(sustain)} hours a week {focused.length ? `goes to the ${focused.length === 1 ? 'one you have singled out' : `${focused.length} you have singled out`}` : 'is spread across all of them'}.
          {focused.length === 0 && groups.length > 2 ? ' Single one or two out and it will show sooner.' : ''}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2 text-sm">
        {groups.map((g) => {
          const leader = game.npcs[g.leaderId];
          const band = vitalityBand(g.vitality);
          const trend = groupTrend(game, g, sustain);
          const weeksTo = (target: number) => (trend > 0.05 && g.vitality < target ? Math.ceil((target - g.vitality) / trend) : null);
          const nextBand = band === 'dying' ? 15 : band === 'declining' ? 40 : band === 'steady' ? 70 : null;
          const eta = nextBand ? weeksTo(nextBand) : null;
          return (
            <li key={g.id} className="flex items-start justify-between gap-2">
              <div>
                <div>
                  {g.name}
                  <span className={'ml-2 text-xs ' + (band === 'thriving' ? 'text-emerald-800' : band === 'dying' ? 'ink-wine' : 'ink-faint')}>{band}</span>
                  {!g.suppressed && <span className={'ml-1 text-xs ' + (trend >= 0.3 ? 'text-emerald-800' : trend <= -0.3 ? 'ink-wine' : 'ink-faint')}>· {trendWord(trend)}{eta && eta <= 104 ? `, ${band === 'steady' ? 'thriving' : band === 'declining' ? 'steady' : 'off the floor'} in ${eta} weeks` : ''}</span>}
                  {g.foundedByPlayer && <span className="ml-2 text-xs" style={{ color: '#8f6a1e' }}>yours</span>}
                  {g.hostile && <span className="ink-wine ml-2 text-xs">against you</span>}
                </div>
                {leader && (
                  <div className="ink-muted text-xs">
                    {leader.name.first} {leader.name.last} leads it and {AGENDA_TEXT[g.agenda]}.
                    {!g.suppressed && (
                      <button className="pbtn-link ml-2" disabled={!mayReplace.ok} title={mayReplace.ok ? 'Thank them and put someone else over it. The group dips, then follows the new leader; the old one may not take it well.' : mayReplace.why ?? ''} onClick={() => replace(g.id)}>
                        replace
                      </button>
                    )}
                    <span className="ml-2"><TalkButton npcId={leader.id} /></span>
                    <LastTalk npcIds={[leader.id]} />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {!g.suppressed && !g.hostile && (
                  <button className={'pbtn px-2 py-0 text-xs ' + (g.focus ? 'pbtn-active' : '')} onClick={() => focus(g.id, !g.focus)} title="Your sustaining hours go to the groups you single out">
                    {g.focus ? 'your time' : 'give it your time'}
                  </button>
                )}
                <button className="pbtn-link" onClick={() => suppress(g.id, !g.suppressed)} title={g.suppressed ? 'Restore your support' : 'Withdraw support and let it die. The leader will call the chancery.'}>
                  {g.suppressed ? 'restore' : 'let it go'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {founding ? (
        <p className="ink-muted mt-3 text-xs">
          Founding a {groupTypeDefs.find((d) => d.type === founding.type)?.label.toLowerCase()}: {Math.max(0, founding.endWeek - game.clock.week)} weeks to go, {hoursOf(founding.apPerWeek)} hours a week.
        </p>
      ) : picking ? (
        <div className="mt-3">
          <div className="ink-muted mb-1 text-xs">Found what? Months of work, and it can fail.</div>
          <div className="flex flex-wrap gap-1">
            {groupTypeDefs
              .filter((d) => !existing.has(d.type))
              .map((d) => (
                <button key={d.type} className="pbtn px-2 py-0.5 text-xs" onClick={() => { found(d.type as GroupType); setPicking(false); }} title={`${d.founding.weeks} weeks at ${hoursOf(d.founding.apPerWeek)} hours a week`}>
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
