import { useGameStore } from '@/engine/store';
import { actionDefs, obligationDefs } from '@/content/parish';
import { adminFloorFor, careOf, careOfPlan, efficiencyWords, hoursOf, obligationAp, planWeek, sacrificeAp, seasonalLoad, strainOf, strainWord, weekBudget, WEEK } from '@/systems/week';
import { sacrificeDefs, problemFix } from '@/content/parish';
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
  const toggleSacrifice = useGameStore((s) => s.toggleSacrifice);
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
  const strain = strainOf(game);
  const extra = sacrificeAp(game);
  const sacrificed = new Set(routine.sacrifices ?? []);
  const work = game.parish.work ? problemFix(game.parish.work.problem) : undefined;
  // The week as a bar: every hour accounted for.
  const segments: { label: string; ap: number; kind: 'season' | 'desk' | 'promise' | 'obligation' | 'action' | 'slack' }[] = [];
  const season = seasonalLoad(game);
  if (season > 0) segments.push({ label: 'The season', ap: season, kind: 'season' });
  const desk = adminFloorFor(game);
  if (desk > 0) segments.push({ label: 'The desk', ap: desk, kind: 'desk' });
  for (const cm of game.commitments) segments.push({ label: cm.label, ap: cm.apPerWeek, kind: 'promise' });
  if (game.founding) segments.push({ label: 'Founding a group', ap: game.founding.apPerWeek, kind: 'promise' });
  if (game.parish.work && work) segments.push({ label: work.label, ap: game.parish.work.apPerWeek, kind: 'promise' });
  for (const key of OBLIGATION_KEYS) {
    const def = obligationDefs.find((o) => o.key === key)!;
    segments.push({ label: def.label, ap: obligationAp(key, plan.obligations[key], 0, game.character?.stats), kind: 'obligation' });
  }
  for (const [id, ap] of Object.entries(plan.discretionary)) if (ap > 0) segments.push({ label: actionDefs.find((a) => a.id === id)?.label ?? id, ap, kind: 'action' });
  if (plan.slack > 0) segments.push({ label: 'Unspoken for', ap: plan.slack, kind: 'slack' });
  const barTotal = segments.reduce((n, x) => n + x.ap, 0) || 1;
  const COLOR: Record<(typeof segments)[number]['kind'], string> = { season: '#8a5a3c', desk: '#6b5a4a', promise: '#7a6a8a', obligation: '#3f5f7a', action: '#4f7a4f', slack: '#c9bfa8' };

  return (
    <>
      <Sheet title="The week">
        <p className="ink-muted text-xs leading-relaxed">
          A working week of about {hoursOf(budget)} hours, after the Office, meals, and sleep, which are not counted here
          {extra > 0 ? ` (${hoursOf(WEEK.baseAp[game.parish.role])} of them the diocese's, and ${hoursOf(extra)} you have taken from your own life)` : ''}. Obligations take {hoursOf(plan.mandatory)}
          {fixed > 0 ? ` (${hoursOf(fixed)} of that is the season, the desk, and what you have promised elsewhere)` : ''}, leaving {hoursOf(available)} for everything else
          {requested > available ? `; you have asked for ${hoursOf(requested)}, so it will be trimmed` : ''}. Every block below is four hours; the daily Mass is half an hour a day and is costed that way.
        </p>
        {efficiencyWords(game.character?.stats).length > 0 && <p className="ink-faint mt-1 text-xs">What you know saves you time: {efficiencyWords(game.character?.stats).join('; ')}.</p>}
        {game.assignment?.role === 'parochial_vicar' && <p className="ink-faint mt-1 text-xs">As vicar, the people are yours and the books are the pastor's: visits, confessions, and the groups count for more in your hands, and the desk for less.</p>}
        {requested > available && (
          <p className="ink-wine mt-1 text-xs">
            The week is full before you get to it: {hoursOf(requested - available)} hours short. Go minimum on an obligation, drop something you promised, or take hours from your own life below.
          </p>
        )}
        <div className="mt-2 flex h-5 w-full overflow-hidden rounded border rule" title="The week, hour by hour">
          {segments.map((x, i) => (
            <div key={i} style={{ width: `${(x.ap / barTotal) * 100}%`, background: COLOR[x.kind] }} className="h-full border-r border-black/20 last:border-r-0" title={`${x.label}: ${hoursOf(x.ap)} hours`} />
          ))}
        </div>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {segments.map((x, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[x.kind] }} />
              <span className="ink-muted">{x.label}</span> <span className="font-mono">{hoursOf(x.ap)}h</span>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet title="The standing routine">
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
                      const ap = def.ap[q] === undefined ? undefined : obligationAp(def.key, q, 0, game.character?.stats);
                      if (ap === undefined) return null;
                      return (
                        <button key={q} onClick={() => setObligation(key, q)} className={'pbtn whitespace-nowrap px-2 py-0.5 text-xs ' + (q === chosen ? 'pbtn-active' : '')} title={`${QUALITY_LABEL[q]}: ${def.blurb[q]}`}>
                          {QUALITY_SHORT[q]} <span className="opacity-70">{hoursOf(ap)}h</span>
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
                  <span className="ink-faint ml-2 text-xs">{feeds(a.id, a.effectsPerAp)}{ap > 0 && planned < ap ? ` · trimmed to ${hoursOf(planned)}h` : ''}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button className="pbtn px-2 py-0 text-xs" onClick={() => setDiscretionary(a.id, ap - 1)}>−</button>
                  <span className="w-7 text-center font-mono text-xs">{hoursOf(ap)}h</span>
                  <button className="pbtn px-2 py-0 text-xs" onClick={() => setDiscretionary(a.id, Math.min(a.maxAp, ap + 1))}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="ink-muted mt-3 text-xs">{careWord}{careTrend}. Hours with the people fill the pews, and full pews fill the basket; a parish that is looked after has fewer fires.</p>
      </Sheet>
      <Sheet title="The rest of your life">
        <p className="ink-muted text-xs leading-relaxed">
          More hours for the parish come from somewhere. You are {strainWord(strain)}{strain >= WEEK.strainSick ? ', and the body has started taking an hour back' : strain >= WEEK.strainWorn ? ', and it is beginning to cost you' : ''}.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {sacrificeDefs.map((d) => {
            const on = sacrificed.has(d.id);
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0" title={d.blurb}>
                  {d.label}
                  <span className="ink-faint ml-2 text-xs">+{hoursOf(d.ap)} hours a week · wears on you</span>
                </span>
                <button className={'pbtn shrink-0 px-2 py-0 text-xs ' + (on ? 'pbtn-active' : '')} onClick={() => toggleSacrifice(d.id)}>
                  {on ? 'take it back' : 'give it up'}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
