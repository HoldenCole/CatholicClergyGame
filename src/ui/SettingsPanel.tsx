import { useGameStore } from '@/engine/store';
import { LLM_MODELS } from '@/llm/settings';
import Panel from './Panel';

export default function SettingsPanel() {
  const llm = useGameStore((s) => s.llm);
  const setLlm = useGameStore((s) => s.setLlm);
  return (
    <Panel title="Prose">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={llm.enabled} onChange={(e) => setLlm({ enabled: e.target.checked })} />
        <span>Let a model rewrite scenes in richer prose</span>
      </label>
      <p className="mt-1 text-xs text-stone-500">
        Off by default. The game is complete without it; nothing the model writes changes what happens. Requests go from your browser to Anthropic with your own key.
      </p>
      {llm.enabled && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="password"
            placeholder="Anthropic API key"
            className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm font-mono"
            value={llm.apiKey}
            onChange={(e) => setLlm({ apiKey: e.target.value })}
          />
          <select className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm" value={llm.model} onChange={(e) => setLlm({ model: e.target.value })}>
            {LLM_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </Panel>
  );
}
