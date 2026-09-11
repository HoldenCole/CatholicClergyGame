import { useGameStore } from '@/engine/store';
import { LLM_MODELS } from '@/llm/settings';
import { HOURS_RANGE, settingsOf, WEAR_LEVELS, WORK_WEEKS, workHours } from '@/systems/workweek';
import { strainOf, strainWord } from '@/systems/week';
import type { WorkWeek } from '@/types';
import Sheet from './Sheet';

export default function SettingsPanel() {
  const llm = useGameStore((s) => s.llm);
  const setLlm = useGameStore((s) => s.setLlm);
  const game = useGameStore((s) => s.game);
  const setSettings = useGameStore((s) => s.setSettings);
  const settings = game ? settingsOf(game) : null;
  return (
    <>
    {game && settings && (
      <Sheet title="The week">
        <label className="flex flex-col gap-1 text-sm">
          <span>How long a week you work</span>
          <select className="pinput" value={settings.workWeek} onChange={(e) => setSettings({ workWeek: e.target.value as WorkWeek })}>
            {(Object.keys(WORK_WEEKS) as WorkWeek[]).map((k) => (
              <option key={k} value={k}>{WORK_WEEKS[k].label}</option>
            ))}
          </select>
          <span className="ink-faint text-xs">{WORK_WEEKS[settings.workWeek].blurb}</span>
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span>Or set the hours yourself: {workHours(game)} a week{typeof settings.hours === 'number' ? '' : ' (from the preset above)'}</span>
          <input type="range" min={HOURS_RANGE.min} max={HOURS_RANGE.max} step={HOURS_RANGE.step} value={workHours(game)} onChange={(e) => setSettings({ hours: Number(e.target.value) })} />
          <span className="ink-faint text-xs">
            Every four hours past 48 wears at the rate below; in seminary and away, every eight hours past 48 is one more free hour. Sacrifices add on top.
            {typeof settings.hours === 'number' && <button className="pbtn-link ml-1" onClick={() => setSettings({ hours: 0 })}>use the preset</button>}
          </span>
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span>How much a long week wears on you</span>
          <select className="pinput" value={String(settings.wear)} onChange={(e) => setSettings({ wear: Number(e.target.value) })}>
            {WEAR_LEVELS.map((w) => (
              <option key={w.value} value={String(w.value)}>{w.label}</option>
            ))}
          </select>
          <span className="ink-faint text-xs">{WEAR_LEVELS.find((w) => w.value === settings.wear)?.blurb ?? ''} You are {strainWord(strainOf(game))}.</span>
        </label>
        <p className="ink-faint mt-2 text-xs">Both change the seminary's free hours, the hours away, and the parish week alike, and are kept in the save.</p>
      </Sheet>
    )}
    <Sheet title="Prose">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={llm.enabled} onChange={(e) => setLlm({ enabled: e.target.checked })} />
        <span>Let a model rewrite scenes in richer prose</span>
      </label>
      <p className="ink-faint mt-1 text-xs leading-relaxed">
        Off by default. The game is complete without it; nothing the model writes changes what happens. Requests go from your browser to Anthropic with your own key.
      </p>
      {llm.enabled && (
        <div className="mt-3 flex flex-col gap-2">
          <input type="password" placeholder="Anthropic API key" className="pinput font-mono" value={llm.apiKey} onChange={(e) => setLlm({ apiKey: e.target.value })} />
          <select className="pinput" value={llm.model} onChange={(e) => setLlm({ model: e.target.value })}>
            {LLM_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </Sheet>
    </>
  );
}
