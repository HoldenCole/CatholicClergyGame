import Anthropic from '@anthropic-ai/sdk';
import type { SkinContext } from './context';
import { SYSTEM_PROMPT, userPrompt } from './prompts';
import type { LlmSettings } from './settings';

/** Anything that turns a narrow context into prose. Tests use a fake. */
export interface Provider {
  skin(ctx: SkinContext): Promise<string>;
}

/**
 * The Anthropic Messages API from the browser. The key lives in the
 * player's own browser and is sent only to Anthropic.
 */
export function anthropicProvider(settings: LlmSettings): Provider {
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  return {
    async skin(ctx) {
      const response = await client.beta.messages.create({
        model: settings.model,
        max_tokens: 1200,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt(ctx) }],
      });
      if (response.stop_reason === 'refusal') throw new Error('the model declined');
      const text = response.content
        .filter((b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!text) throw new Error('empty response');
      return text;
    },
  };
}
