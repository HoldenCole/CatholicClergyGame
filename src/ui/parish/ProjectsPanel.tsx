import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { availableProjects, projectCap, projectDef, projectsOf } from '@/systems/projects';
import { hoursOf } from '@/systems/week';
import Sheet from '../Sheet';

/** The pastor's projects: several at once, each of which can be pushed for money. */
export default function ProjectsPanel() {
  const game = useGameStore((s) => s.game);
  const start = useGameStore((s) => s.startProject);
  const push = useGameStore((s) => s.pushProject);
  const [picking, setPicking] = useState(false);
  if (!game?.parish || game.assignment?.role !== 'pastor') return null;
  const running = projectsOf(game);
  const cap = projectCap(game);
  const options = availableProjects(game);
  const canBegin = options.some((o) => o.available);
  return (
    <Sheet title="The pastor's projects">
      {running.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {running.map((project) => {
            const def = projectDef(project.type);
            const pushed = (project.pace ?? 1) === 2;
            return (
              <li key={project.type} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {def.label}: {Math.max(0, project.endWeek - game.clock.week)} weeks to go
                  {project.stalledWeeks > 0 ? `, stalled ${project.stalledWeeks} weeks for want of money` : ''}. {hoursOf(project.apPerWeek)} hours a week
                  {project.costPerWeek > 0 ? ` and $${(project.costPerWeek * (project.pace ?? 1)).toLocaleString()} a week` : ''}{pushed ? ', pushed' : ''}.
                </span>
                {(project.costPerWeek > 0 || project.type === 'debt_retirement') && (
                  <button className="pbtn-link text-xs" title={pushed ? 'Back to the ordinary pace: half the draw, twice the time' : 'Double the weekly draw and halve the time left'} onClick={() => push(project.type, !pushed)}>
                    {pushed ? 'ease off' : 'push it'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="ink-faint mt-1 text-xs">{cap === 1 ? 'One project at a time is what you can carry; more administration would carry more.' : `You can carry ${cap} at once.`}</p>
      {picking ? (
        <ul className="mt-2 flex flex-col gap-1">
          {options.map(({ def, available, why }) => (
            <li key={def.type}>
              <button disabled={!available} onClick={() => { start(def.type); setPicking(false); }} className="choice">
                <div className="text-sm">
                  {def.label} <span className="ink-faint text-xs">· {Math.round((def.weeks / 52) * 10) / 10} years, {hoursOf(def.apPerWeek)} hours a week{def.cost ? `, $${def.cost.toLocaleString()}` : ''}</span>
                </div>
                <div className="ink-muted text-xs">{why ?? def.blurb}</div>
              </button>
            </li>
          ))}
          <li><button className="pbtn-link" onClick={() => setPicking(false)}>never mind</button></li>
        </ul>
      ) : (
        canBegin && <button className="pbtn mt-2" onClick={() => setPicking(true)}>Begin a project</button>
      )}
    </Sheet>
  );
}
