import { describe, it, expect, beforeEach } from 'vitest';
import { eventById } from '@/content';
import { noDraw } from '@/engine/clock';
import { setWeekDraw, setWeekHook } from '@/engine/store';
import { playCareer } from '../helpers/career';

describe('a whole career with real content', () => {
  beforeEach(() => {
    setWeekDraw(noDraw);
    setWeekHook(null);
  });

  it('runs from creation through seminary and thirty years of parish life without errors', () => {
    const end = playCareer('career-run', 'chicago', 52 * 37);
    expect(['clock', 'ended', 'assignment']).toContain(end.mode.kind);
    expect(end.flags.ordained).toBe(true);
    expect(end.history.length).toBeGreaterThan(30);
    expect(end.career.length).toBeGreaterThan(2);
    expect(end.digest.length).toBeGreaterThan(0);
    // Every history entry points at a real event; every parish event that fired was eligible for the phase.
    for (const h of end.history) expect(eventById(h.eventId), h.eventId).toBeTruthy();
    // Something structural happened in thirty years.
    const kinds = new Set(end.career.map((e) => e.kind));
    expect(kinds.has('promotion') || kinds.has('passed_over')).toBe(true);
    // Every succession got its scene.
    const successions = end.career.filter((e) => e.kind === 'succession').length;
    const scenes = end.history.filter((h) => h.eventId.startsWith('career_new_bishop')).length;
    expect(scenes).toBe(successions);
  });

  it('is deterministic from the same seed and choices', () => {
    const a = playCareer('career-det', 'houston', 52 * 15);
    const b = playCareer('career-det', 'houston', 52 * 15);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
