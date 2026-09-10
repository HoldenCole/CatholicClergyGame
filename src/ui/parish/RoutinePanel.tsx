import { useGameStore } from '@/engine/store';
import { actionDefs, obligationDefs } from '@/content/parish';
import { adminFloorFor, planWeek, seasonalLoad, weekBudget } from '@/systems/week';
import { commitmentAp } from '@/engine/offers';
import { OBLIGATION_KEYS, type Quality } from '@/types';
import Panel from '../Panel';

const QUALITIES: Quality[] = ['min', 'standard', 'invested'];
const QUALITY_LABEL: Record<Quality, string> = { min: 'Minimum', standard: 'Standard', invested: 'Invested' };

export default function RoutinePanel() {
  const game = useGameStore((s) => s.game);
  const setObligation = useGameStore((s) => s.setObligation);
  const setDiscretionary = useGameStore((s) => s.setDiscretionary);
  if (!game?.parish) return null;
  const plan = planWeek(game);
  const budget = weekBudget(game);
  const fixed = seasonalLoad(game) + adminFloorFor(game) + commitmentAp(game);
  const routine = game.parish.routine;
  const requested = Object.values(routine.discretionary).reduce((a, b) => a + b, 0);
  const available = Math.max(0, budget - plan.mandatory);

  return (
    <Panel title="The standing routine">
      <p className="text-xs text-stone-500">
        {budget} hours of you this week. Obligations take {plan.mandatory}
        {fixed > 0 ? ` (${fixed} of that is the season, the desk, and what you have promised elsewhere)` : ''}, leaving {available} for
        everything else{requested > available ? `; you have asked for ${requested}, so it will be trimmed` : ''}.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {OBLIGATION_KEYS.map((key) => {
          const def = obligationDefs.find((o) => o.key === key)!;
          const chosen = routine.obligations[key];
          const actual = plan.obligations[key];
          return (
            <li key={key} className="grid grid-cols-12 items-center gap-2 text-sm">
              <span className="col-span-4 text-stone-300">{def.label}</span>
              <div className="col-span-4 flex gap-1">
                {QUALITIES.map((q) => {
                  const ap = def.ap[q];
                  if (ap === null) return null;
                  return (
                    <button
                      key={q}
                      onClick={() => setObligation(key, q)}
                      className={
                        'rounded border px-2 py-0.5 text-xs ' +
                        (q === chosen ? 'border-amber-600 bg-amber-950/40 text-amber-100' : 'border-stone-700 text-stone-400 hover:bg-stone-800')
                      }
                      title={def.blurb[q]}
                    >
                      {QUALITY_LABEL[q]} · {ap}
                    </button>
                  );
                })}
              </div>
              <span className="col-span-4 text-xs text-stone-500">
                {actual !== chosen ? `This week: ${QUALITY_LABEL[actual].toLowerCase()} (the week did not fit)` : def.blurb[chosen]}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 text-xs uppercase tracking-wider text-stone-500">Everything else</div>
      <ul className="mt-1 flex flex-col gap-1">
        {actionDefs.map((a) => {
          const ap = routine.discretionary[a.id] ?? 0;
          const planned = plan.discretionary[a.id] ?? 0;
          return (
            <li key={a.id} className="grid grid-cols-12 items-center gap-2 text-sm">
              <span className="col-span-4 text-stone-300" title={a.blurb}>{a.label}</span>
              <div className="col-span-3 flex items-center gap-1">
                <button className="rounded border border-stone-700 px-2 text-xs hover:bg-stone-800" onClick={() => setDiscretionary(a.id, ap - 1)}>−</button>
                <span className="w-6 text-center font-mono text-xs">{ap}</span>
                <button className="rounded border border-stone-700 px-2 text-xs hover:bg-stone-800" onClick={() => setDiscretionary(a.id, Math.min(a.maxAp, ap + 1))}>+</button>
              </div>
              <span className="col-span-5 text-xs text-stone-500">
                {ap > 0 && planned < ap ? `trimmed to ${planned} this week · ` : ''}
                {a.location}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
