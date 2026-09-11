import { describe, it, expect } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { clubAvailability, clubHours, clubsWeek, joinClub, leaveClub, leaveSeminaryClubs, staminaOf } from '@/systems/clubs';
import { seminaryBudget, setSeminaryActivity } from '@/systems/seminaryWeek';
import { planWeek, resolveWeek, strainAfterWeek } from '@/systems/week';
import { applyEffects } from '@/engine/effects';
import { seminaryWeekHook } from '@/engine/weekHook';
import { eventById, eventsForPhase } from '@/content';
import { offerById, offersForPhase } from '@/content/offers';
import { clubDefs } from '@/content/clubs';
import type { GameState } from '@/types';

describe('clubs and circles', () => {
  it('seminary clubs open from the second year, cost free hours, and the invite-only ones say so', () => {
    const y1 = seminaryState('c1');
    expect(clubAvailability(y1).every((a) => !a.open)).toBe(true);
    const y3: GameState = { ...y1, seminary: { ...y1.seminary!, year: 3 } };
    const av = clubAvailability(y3);
    expect(av.map((a) => a.def.id)).toContain('thomists');
    expect(av.find((a) => a.def.id === 'thomists')!.open).toBe(true);
    expect(av.find((a) => a.def.id === 'tlm_society')!.why).toBe('by invitation');
    expect(() => joinClub(y3, 'tlm_society', createRng('x'))).toThrow(/invitation/);
    let s = joinClub(y3, 'thomists', createRng('join'));
    expect(s.flags['club:thomists']).toBe(true);
    expect(s.clubs!.memberships.thomists!.fellows.length).toBeGreaterThan(0);
    expect(s.clubs!.memberships.thomists!.fellows.length).toBeLessThanOrEqual(4);
    expect(clubHours(s)).toBe(2);
    // The hours come off the top of the free hours.
    const budget = seminaryBudget(s);
    s = setSeminaryActivity(s, 'study', 3);
    s = setSeminaryActivity(s, 'holy_hour', 3);
    expect(Object.values(s.seminary!.routine ?? {}).reduce((a, b) => a + b, 0)).toBe(budget - 2);
    expect(s.career[s.career.length - 1]!.text).toMatch(/Joined The Thomists/);
  });

  it('a week of belonging builds what it says, warms the fellows, and pays off in time', () => {
    let s = joinClub({ ...seminaryState('c2'), seminary: { ...seminaryState('c2').seminary!, year: 3 } }, 'thomists', createRng('j'));
    const fellow = s.clubs!.memberships.thomists!.fellows[0]!;
    const rel = s.npcs[fellow]!.relationship;
    const theo = s.character!.stats.theology;
    for (let i = 0; i < 52; i++) s = clubsWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(s.character!.stats.theology).toBeGreaterThan(theo + 2);
    expect(s.npcs[fellow]!.relationship).toBeGreaterThan(rel + 10);
    expect(s.flags.read_the_summa).toBe(true);
    expect(s.clubs!.memberships.thomists!.earned).toBe(true);
    // Leaving costs what it costs and shuts the door for a year.
    const gone = leaveClub(s, 'thomists');
    expect(gone.clubs!.memberships.thomists).toBeUndefined();
    expect(gone.flags['club:thomists']).toBe(false);
    expect(clubAvailability(gone).find((a) => a.def.id === 'thomists')!.why).toMatch(/left/);
  });

  it('an invitation accepted joins through the club effect, and ordination ends the seminary clubs', () => {
    const base = seminaryState('c3');
    const y4: GameState = { ...base, seminary: { ...base.seminary!, year: 4 }, character: { ...base.character!, alignment: -30 } };
    const flagged = applyEffects(y4, [{ target: 'club', key: 'tlm_society', value: 'join' }]);
    expect(flagged.flags['club_pending:tlm_society']).toBe('join');
    const hook = seminaryWeekHook({ pool: eventsForPhase('seminary'), lookup: eventById, offers: offersForPhase('seminary'), offerLookup: offerById });
    const after = hook({ ...flagged, clock: { ...flagged.clock, week: flagged.clock.week + 1 } }, createRng('hook'), []);
    expect(after.clubs?.memberships.tlm_society).toBeDefined();
    expect(after.flags['club_pending:tlm_society']).toBeUndefined();
    expect(after.flags['club:tlm_society']).toBe(true);
    const left = leaveSeminaryClubs(after);
    expect(left.clubs!.memberships.tlm_society).toBeUndefined();
    expect(offerById('sem_tlm_society')!.accept.effects.some((e) => e.target === 'club')).toBe(true);
  });

  it("a priest's circles take blocks from the week, and the runners ease the strain", () => {
    const s = parishState('c4');
    const av = clubAvailability(s);
    expect(av.map((a) => a.def.id)).toContain('deanery_table');
    expect(av.map((a) => a.def.id)).not.toContain('thomists');
    let joined = joinClub(s, 'priests_running', createRng('run'));
    joined = joinClub(joined, 'deanery_table', createRng('table'));
    expect(planWeek(joined).mandatory).toBe(planWeek(s).mandatory + 2);
    expect(staminaOf(joined)).toBe(1.5);
    const cut: GameState = { ...s, parish: { ...s.parish!, routine: { ...s.parish!.routine, sacrifices: ['sleep'] } } };
    const cutRunner: GameState = { ...joined, parish: { ...joined.parish!, routine: { ...joined.parish!.routine, sacrifices: ['sleep'] } } };
    expect(strainAfterWeek(cutRunner, 2.5, 0)).toBeLessThan(strainAfterWeek(cut, 2.5, 0));
    const week = clubsWeek({ ...joined, clock: { ...joined.clock, week: joined.clock.week + 1 } }).state;
    expect(week.character!.reputation.brother_priests).toBeGreaterThan(joined.character!.reputation.brother_priests);
    expect(resolveWeek(joined, createRng('w')).ledger.apMandatory).toBe(planWeek(joined).mandatory);
    for (const def of clubDefs) expect(def.weekly.length, def.id).toBeGreaterThan(0);
  });
});
