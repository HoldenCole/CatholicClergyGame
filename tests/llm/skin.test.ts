import { describe, it, expect, beforeEach } from 'vitest';
import { arcContext, eventContext, isSensitive } from '@/llm/context';
import { userPrompt, SYSTEM_PROMPT } from '@/llm/prompts';
import { _resetInFlight, arcKey, eventKey, skinArc, skinEvent, skinOutcome } from '@/llm/skin';
import type { Provider } from '@/llm/provider';
import { fireEvent } from '@/engine/events';
import { createRng } from '@/engine/rng';
import { seminaryState, testEvent } from '../helpers/fixtures';
import { parishState } from '../systems/week.test';

const skinnable = testEvent({
  id: 'sk',
  body: 'You meet {@rector} in the corridor and he asks about {@closest_classmate}.',
  flavorPrompt: 'A corridor, late afternoon.',
  choices: [{ id: 'a', label: 'A', outcome: 'You tell him the truth and he nods.', effects: [] }],
});

function fake(text = 'PROSE'): Provider & { calls: number } {
  const p = { calls: 0, skin: async () => { p.calls++; return text; } };
  return p;
}

describe('llm/context', () => {
  it('builds a narrow context: resolved people, place, season, authored text, and nothing else', () => {
    const state = seminaryState();
    const fired = fireEvent(state, skinnable, createRng('x'));
    const ctx = eventContext(fired.state, skinnable, fired.pending);
    expect(ctx.kind).toBe('event');
    expect(ctx.authored).toBe('You meet Msgr. Kearney in the corridor and he asks about Paul.');
    expect(ctx.people.map((p) => p.role).sort()).toEqual(['closest classmate', 'rector']);
    expect(ctx.people[0]!.standing).toMatch(/friend|warm|civil|cool|hostile/);
    const json = JSON.stringify(ctx);
    for (const forbidden of ['stats', 'reputation', 'alignment', 'flags', 'hidden', 'latentRisks', 'seed', 'effects']) {
      expect(json.includes(`"${forbidden}"`), forbidden).toBe(false);
    }
    const prompt = userPrompt(ctx);
    expect(prompt).toContain('Guidance: A corridor, late afternoon.');
    expect(prompt).toContain('Msgr. James Kearney');
    expect(SYSTEM_PROMPT).toMatch(/do not decide anything/i);
  });

  it('marks sensitive events and events without guidance as not for the model', () => {
    expect(isSensitive(skinnable)).toBe(false);
    expect(isSensitive(testEvent({ flavorPrompt: 'x', category: 'scandal' }))).toBe(true);
    expect(isSensitive(testEvent({ flavorPrompt: 'x', pressure: ['doubt'] }))).toBe(true);
    expect(isSensitive(testEvent({ flavorPrompt: 'x', pressure: ['body_vs_vow'] }))).toBe(true);
    expect(isSensitive(testEvent({}))).toBe(true);
  });

  it('the arc portrait context names the parish and the rectory', () => {
    const s = parishState('ctx');
    const ctx = arcContext(s)!;
    expect(ctx.kind).toBe('arc');
    expect(ctx.parish?.name).toBeTruthy();
    expect(ctx.people.some((p) => p.role === 'pastor')).toBe(true);
    expect(arcKey(s)).toMatch(/^arc:parish_\d+:\d+$/);
  });
});

describe('llm/skin', () => {
  beforeEach(() => _resetInFlight());

  it('skins an event once, caches by key, and never throws on provider failure', async () => {
    const state = seminaryState();
    const fired = fireEvent(state, skinnable, createRng('x'));
    const provider = fake();
    const cache: Record<string, string> = {};
    const r = await skinEvent(fired.state, skinnable, fired.pending, cache, provider);
    expect(r).toEqual({ key: eventKey(fired.pending), prose: 'PROSE' });
    cache[r!.key] = r!.prose;
    expect(await skinEvent(fired.state, skinnable, fired.pending, cache, provider)).toBeNull();
    expect(provider.calls).toBe(1);
    const failing: Provider = { skin: async () => { throw new Error('network'); } };
    expect(await skinEvent(fired.state, skinnable, fired.pending, {}, failing)).toBeNull();
  });

  it('refuses sensitive events and skins outcomes and arcs', async () => {
    const state = seminaryState();
    const sensitive = testEvent({ id: 'sens', flavorPrompt: 'x', pressure: ['doubt'] });
    const fired = fireEvent(state, sensitive, createRng('x'));
    const provider = fake();
    expect(await skinEvent(fired.state, sensitive, fired.pending, {}, provider)).toBeNull();
    expect(provider.calls).toBe(0);
    const ok = fireEvent(state, skinnable, createRng('y'));
    const out = await skinOutcome(ok.state, skinnable, ok.pending, 'a', {}, provider);
    expect(out?.key).toContain('outcome:sk:');
    const arc = await skinArc(parishState('arc'), {}, provider);
    expect(arc?.key).toMatch(/^arc:/);
  });

  it('a save round-trips the prose cache so a replayed week shows the same text', async () => {
    const { useGameStore, setProvider } = await import('@/engine/store');
    setProvider(fake('CACHED PROSE'));
    useGameStore.getState().newGame({ seed: 'prose', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.setState((s) => ({ prose: { ...s.prose, 'event:x:1': 'CACHED PROSE' } }));
    const json = useGameStore.getState().exportSave();
    useGameStore.getState().importSave(json);
    expect(useGameStore.getState().prose['event:x:1']).toBe('CACHED PROSE');
    setProvider(null);
  });
});
