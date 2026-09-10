import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { availableProjects, projectDef } from '@/systems/projects';
import Panel from '../Panel';

export default function ProjectsPanel() {
  const game = useGameStore((s) => s.game);
  const start = useGameStore((s) => s.startProject);
  const [picking, setPicking] = useState(false);
  if (!game?.parish || game.assignment?.role !== 'pastor') return null;
  const project = game.project;
  const options = availableProjects(game);
  return (
    <Panel title="The pastor's projects">
      {project ? (
        <p className="text-sm text-stone-300">
          {projectDef(project.type).label}: {Math.max(0, project.endWeek - game.clock.week)} weeks to go
          {project.stalledWeeks > 0 ? `, stalled ${project.stalledWeeks} weeks for want of money` : ''}. {project.apPerWeek} hours a week
          {project.costPerWeek > 0 ? ` and $${project.costPerWeek.toLocaleString()} a week` : ''}.
        </p>
      ) : picking ? (
        <ul className="flex flex-col gap-2">
          {options.map(({ def, available, why }) => (
            <li key={def.type}>
              <button
                disabled={!available}
                onClick={() => {
                  start(def.type);
                  setPicking(false);
                }}
                className={'w-full text-left rounded border p-2 ' + (available ? 'border-stone-700 hover:border-amber-600' : 'border-stone-900 text-stone-600')}
              >
                <div className="text-sm">{def.label} <span className="text-xs text-stone-500">· {Math.round(def.weeks / 52 * 10) / 10} years, {def.apPerWeek} hours a week{def.cost ? `, $${def.cost.toLocaleString()}` : ''}</span></div>
                <div className="text-xs text-stone-500">{why ?? def.blurb}</div>
              </button>
            </li>
          ))}
          <li><button className="text-xs text-stone-500" onClick={() => setPicking(false)}>never mind</button></li>
        </ul>
      ) : (
        <button className="text-xs text-stone-500 hover:text-stone-300" onClick={() => setPicking(true)}>Begin a project</button>
      )}
    </Panel>
  );
}
