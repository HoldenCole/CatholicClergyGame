import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { careerYear } from '@/engine/career';
import { afar, homeSuccession, popeHomeYear } from '@/systems/homeFromAfar';
import { successionYear } from '@/systems/succession';
import { parishState } from './week.test';
import { elected } from '../helpers/pope';
import type { GameState } from '@/types';

/** The home bishop made very old, so that his see changes hands within a few years. */
function oldBishop(s: GameState): GameState {
  const id = s.world!.diocese.hidden.bishop.npcId;
  return { ...s, npcs: { ...s.npcs, [id]: { ...s.npcs[id]!, birthYear: 1900 } } };
}

/** A man with a see of his own, away from the diocese that ordained him. */
function bishopElsewhere(seed: string): GameState {
  const s = oldBishop(parishState(seed));
  return { ...s, see: { id: 'gaylord', name: 'the Diocese of Gaylord', see: 'Gaylord', region: 'Michigan', installedWeek: s.clock.week - 104, presbyterate: 0, people: 0, rome: 0, money: 0, shortage: 3, ordinations: 0, closings: 0, years: [] } };
}

/** The first of a run of years in which the home see changes hands. */
function firstChange<T>(run: (i: number) => T | null): T {
  for (let i = 0; i < 60; i++) {
    const out = run(i);
    if (out) return out;
  }
  throw new Error('the home see never changed hands');
}

describe('the home diocese from afar (E1 §9 E)', () => {
  it('is afar only for a bishop elsewhere or a pope', () => {
    expect(afar(parishState('afar-none'))).toBeNull();
    expect(afar(bishopElsewhere('afar-see'))).toBe('see');
    expect(afar(elected('afar-pope'))).toBe('pope');
  });

  it('changes hands while he holds a see elsewhere, as news from home, rereading nothing of his', () => {
    const s = bishopElsewhere('afar-news');
    const before = s.world!.diocese.hidden.bishop.npcId;
    const out = firstChange((i) => {
      const r = homeSuccession(s, createRng(`afar-news:${i}`));
      return r.letter ? r : null;
    });
    const now = out.state.world!.diocese.hidden.bishop.npcId;
    expect(now).not.toBe(before);
    expect(out.state.npcs[before]!.status).not.toBe('active');
    expect(out.letter!.title).toMatch(/^From home/);
    expect(out.letter!.body.join(' ')).toMatch(/brother bishop/);
    // Not his bishop: his standing with the chancery, his leave, and his count of bishops served are untouched.
    expect(out.state.character!.reputation.chancery).toBe(s.character!.reputation.chancery);
    expect(out.state.permissions).toEqual(s.permissions);
    expect(out.state.career.at(-1)!.kind).toBe('note');
    expect(out.state.flags.new_bishop_pending).toBeFalsy();
    expect(out.state.npcs[now]!.relationship).not.toBe(0);
  });

  it('comes through the year for a bishop elsewhere, and never as the succession turn', () => {
    const s = bishopElsewhere('afar-year');
    const before = s.world!.diocese.hidden.bishop.npcId;
    const out = firstChange((i) => {
      const next = careerYear({ ...s, clock: { ...s.clock, week: s.clock.week + i } }, createRng(`afar-year:${i}`));
      return next.world!.diocese.hidden.bishop.npcId !== before ? next : null;
    });
    expect(out.flags.new_bishop_pending).toBeFalsy();
    expect(out.beats.some((b) => b.kind === 'succession')).toBe(false);
    expect((out.letters ?? []).some((l) => l.title.startsWith('From home'))).toBe(true);
  });

  it('is still the priest\'s turn at home: a succession rereads a man who is not afar', () => {
    const s = oldBishop(parishState('afar-home'));
    const out = firstChange((i) => {
      const r = successionYear(s, createRng(`afar-home:${i}`));
      return r.newBishop ? r : null;
    });
    expect(out.letter?.title).toMatch(/^A new bishop/);
  });

  it('goes on under a pope: Rome follows his reading, and he signs the terna for the diocese that ordained him', () => {
    let s = elected('afar-reign', 70);
    s = oldBishop({ ...s, romeTemperament: -60 });
    const before = s.world!.diocese.hidden.bishop.npcId;
    const drifted = popeHomeYear(s, createRng('afar-reign:drift'));
    expect(drifted.state.romeTemperament).toBeGreaterThan(-60);
    const out = firstChange((i) => {
      const r = popeHomeYear(s, createRng(`afar-reign:${i}`));
      return r.state.world!.diocese.hidden.bishop.npcId !== before ? r : null;
    });
    expect(out.letter!.body.join(' ')).toMatch(/terna/);
    expect(out.lines.some((l) => l.startsWith('From home'))).toBe(true);
  });
});
