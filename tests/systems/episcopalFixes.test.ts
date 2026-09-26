import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById } from '@/content/offers';
import { canDefer } from '@/engine/offers';
import { endStudy } from '@/engine/study';
import type { GameState } from '@/types';
import { acceptAndGo } from '../helpers/appointment';

function candidate(seed: string, extra: Partial<GameState> = {}): GameState {
  const base = parishState(seed);
  const c = base.character!;
  return {
    ...base,
    phase: 'pastor',
    assignment: { ...base.assignment!, role: 'pastor' },
    character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, reputation: { ...c.reputation, chancery: 72, rome: 40 } },
    flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true },
    ...extra,
  };
}

describe('the episcopal tier, mended', () => {
  it('the nuncio\'s letters take yes or no, never not now', () => {
    expect(canDefer(offerById('ep_diocesan_bishop')!)).toBe(false);
    expect(canDefer(offerById('ep_translation')!)).toBe(false);
    expect(offerById('ep_translation')!.cluster).toBe('episcopal');
  });

  it('an auxiliary whose years end comes home as a pastor, never a vicar', () => {
    const s = candidate('aux-home', { offers: [{ offerId: 'ep_auxiliary_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }] });
    const away = acceptAndGo(s, offerById('ep_auxiliary_bishop')!, createRng('aux')).state;
    const ended = endStudy({ ...away, clock: { ...away.clock, week: away.study!.endWeek } }, offerById('ep_auxiliary_bishop')!, createRng('home'));
    expect(ended.flags.ordained_bishop).toBe(true);
    expect(ended.assignment?.role).toBe('pastor');
  });
});
