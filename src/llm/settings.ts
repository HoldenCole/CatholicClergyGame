/** Settings for the skinning layer. Kept in the browser, never in the save. */
export interface LlmSettings {
  /** CLAUDE.md: the game must be fully playable with this off. Default off. */
  enabled: boolean;
  apiKey: string;
  model: string;
}

export const DEFAULT_LLM: LlmSettings = { enabled: false, apiKey: '', model: 'claude-opus-5' };
export const LLM_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;
const KEY = 'vocation.llm';

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_LLM;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return { ...DEFAULT_LLM, ...parsed };
  } catch {
    return DEFAULT_LLM;
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
