import { describe, it, expect, beforeEach } from 'vitest';
import { eventById } from '@/content';
import { noDraw } from '@/engine/clock';
import { setWeekDraw, setWeekHook } from '@/engine/store';
import { playFriar } from '../helpers/career';

describe('a friar\'s whole career through the store (E3 round 1)', () => {
  beforeEach(() => {
    setWeekDraw(noDraw);
    setWeekHook(null);
  });

  it('runs a Dominican from the novitiate through ordination, postings under obedience, and chapters without errors', () => {
    const end = playFriar('friar-run', 'OP', 52 * 22);
    expect(end.campaign).toBe('religious');
    expect(end.flags.ordained).toBe(true);
    expect(end.religious!.vows.solemnWeek).toBeDefined();
    expect(end.religious!.religiousName).toBe('Thomas');
    // Postings: the first after ordination, and at least one more as a term ran.
    expect(end.religious!.assignments.length).toBeGreaterThanOrEqual(3);
    expect(end.religious!.obedience.accepted).toBeGreaterThanOrEqual(1);
    // A chapter was held and closed.
    expect(Object.keys(end.flags).some((k) => k.startsWith('chapter:'))).toBe(true);
    if (end.mode.kind !== 'chapter') expect(end.religious!.chapter).toBeUndefined();
    // The scenes that fired were the friar's, never the base game's.
    for (const h of end.history) {
      const ev = eventById(h.eventId)!;
      expect(ev, h.eventId).toBeTruthy();
      expect(ev.campaign === 'religious' || ev.campaign === 'any', h.eventId).toBe(true);
    }
    expect(end.history.some((h) => h.eventId.startsWith('opf_') || h.eventId.startsWith('opc_'))).toBe(true);
    expect(['clock', 'ended', 'consultation', 'obedience_letter', 'chapter', 'term_end', 'bishop_ask', 'charter']).toContain(end.mode.kind);
  });

  it('runs an Augustinian the same way, and is deterministic from the same seed and choices', () => {
    const a = playFriar('friar-det', 'OSA', 52 * 12);
    expect(a.flags.ordained).toBe(true);
    expect(a.religious!.vows.renewals.length).toBeGreaterThanOrEqual(2);
    const b = playFriar('friar-det', 'OSA', 52 * 12);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
