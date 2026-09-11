import { useGameStore } from '@/engine/store';
import { actionDefs, obligationDefs } from '@/content/parish';
import { adminFloorFor, careOf, careOfPlan, planWeek, seasonalLoad, weekBudget } from '@/systems/week';
import type { Effect } from '@/types';
import { commitmentAp } from '@/engine/offers';
import { OBLIGATION_KEYS, type Quality } from '@/types';
import Sheet from '../Sheet';

const QUALITIES: Quality[] = ['min', 'standard', 'invested'];
const FEEDS: Record<string, string> = {
  'reputation:parishioners': 'the people', 'reputation:chancery': 'the chancery', 'reputation:brother_priests': 'brother priests', 'reputation:public': 'the town',
  'stat:piety': 'piety', 'stat:charisma': 'presence', 'stat:theology': 'theology', 'stat:knowledge': 'learning', 'stat:administration': 'order',
};
const PEWS = new Set(['visits', 'extra_confessions', 'groups']);

/** What an hour here feeds, in words. */
function feeds(id: string, effects: Effect[]): string {
  const words = effects.filter((e) => (e.delta ?? 0) > 0).map((e) => FEEDS[`${e.target}:${e.key}`]).filter((w): w is string => !!w);
  if (id === 'groups') words.unshift('the groups');
  if (PEWS.has(id)) words.push('the pews');
  return words.join(', ');
}
const QUALITY_LABEL: Record<Quality, string> = { min: 'Minimum', standard: 'Standard', invested: 'Invested' };
const QUALITY_SHORT: Record<Quality, string> = { min: 'Min', standard: 'Std', invested: 'Full' };

/** The standing routine: what the week goes to unless something interrupts it. */
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
  const careNow = careOfPlan(plan);
  const care = careOf(game);
  const careWord = careNow >= 0.8 ? 'The people see a great deal of you' : careNow >= 0.45 ? 'The people see a fair amount of you' : careNow >= 0.2 ? 'The people see a little of you' : 'The people see almost nothing of you outside Mass';
  const careTrend = careNow > care + 0.05 ? ', and it is beginning to show in the pews' : careNow < care - 0.05 ? ', less than they did' : '';

  return (
    <>
      <Sheet title="The standing routine">
        <p className="ink-muted text-xs leading-relaxed">
          {budget} hours of you this week. Obligations take {plan.mandatory}
          {fixed > 0 ? ` (${fixed} of that is the season, the desk, and what you have promised elsewhere)` : ''}, leaving {available} for
          everything else{requested > available ? `; you have asked for ${requested}, so it will be trimmed` : ''}.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {OBLIGATION_KEYS.map((key) => {
            const def = obligationDefs.find((o) => o.key === key)!;
            const chosen = routine.obligations[key];
            const actual = plan.obligations[key];
            return (
              <li key={key} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate" title={def.label}>{def.label}</span>
                  <div className="flex gap-1">
                    {QUALITIES.map((q) => {
                      const ap = def.ap[q];
                      if (ap === null) return null;
                      return (
                        <button key={q} onClick={() => setObligation(key, q)} className={'pbtn whitespace-nowrap px-2 py-0.5 text-xs ' + (q === chosen ? 'pbtn-active' : '')} title={`${QUALITY_LABEL[q]}: ${def.blurb[q]}`}>
                          {QUALITY_SHORT[q]} <span className="opacity-70">{ap}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="ink-faint text-xs">
                  {actual !== chosen ? `This week: ${QUALITY_LABEL[actual].toLowerCase()} (the week did not fit)` : def.blurb[chosen]}
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <Sheet title="Everything else">
        <ul className="flex flex-col gap-1.5">
          {actionDefs.map((a) => {
            const ap = routine.discretionary[a.id] ?? 0;
            const planned = plan.discretionary[a.id] ?? 0;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0" title={a.blurb}>
                  {a.label}
                  <span className="ink-faint ml-2 text-xs">{feeds(a.id, a.effectsPerAp)}{ap > 0 && planned < ap ? ` · trimmed to ${planned}` : ''}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button className="pbtn px-2 py-0 text-xs" onClick={() => setDiscretionary(a.id, ap - 1)}>−</button>
                  <span className="w-5 text-center font-mono text-xs">{ap}</span>
                  <button className="pbtn px-2 py-0 text-xs" onClick={() => setDiscretionary(a.id, Math.min(a.maxAp, ap + 1))}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="ink-muted mt-3 text-xs">{careWord}{careTrend}. Hours with the people fill the pews, and full pews fill the basket; a parish that is looked after has fewer fires.</p>
      </Sheet>
    </>
  );
}
