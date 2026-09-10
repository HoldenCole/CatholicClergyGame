import { useGameStore } from '@/engine/store';
import { LLM_MODELS } from '@/llm/settings';
import Sheet from './Sheet';

export default function SettingsPanel() {
  const llm = useGameStore((s) => s.llm);
  const setLlm = useGameStore((s) => s.setLlm);
  return (
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
  );
}
