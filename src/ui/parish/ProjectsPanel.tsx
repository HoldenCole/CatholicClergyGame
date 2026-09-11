import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { availableProjects, projectDef } from '@/systems/projects';
import { hoursOf } from '@/systems/week';
import Sheet from '../Sheet';

export default function ProjectsPanel() {
  const game = useGameStore((s) => s.game);
  const start = useGameStore((s) => s.startProject);
  const [picking, setPicking] = useState(false);
  if (!game?.parish || game.assignment?.role !== 'pastor') return null;
  const project = game.project;
  const options = availableProjects(game);
  return (
    <Sheet title="The pastor's projects">
      {project ? (
        <p className="text-sm">
          {projectDef(project.type).label}: {Math.max(0, project.endWeek - game.clock.week)} weeks to go
          {project.stalledWeeks > 0 ? `, stalled ${project.stalledWeeks} weeks for want of money` : ''}. {hoursOf(project.apPerWeek)} hours a week
          {project.costPerWeek > 0 ? ` and $${project.costPerWeek.toLocaleString()} a week` : ''}.
        </p>
      ) : picking ? (
        <ul className="flex flex-col gap-1">
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
        <button className="pbtn" onClick={() => setPicking(true)}>Begin a project</button>
      )}
    </Sheet>
  );
}
