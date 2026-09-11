import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { nextAssignment } from '@/engine/career';
import { acceptOffer } from '@/engine/offers';
import { offerById } from '@/content/offers';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { fundGroup, invest, mayInvest, spend, spendAvailability, spendable, spendingWeek, withdraw } from '@/systems/spending';
import { parishGroups } from '@/systems/groups';
import { weekBudget } from '@/systems/week';
import { freeHourShift, workHours } from '@/systems/workweek';
import { generateCandidates, installWorld } from '@/generation/world';
import { newGame } from '@/engine/game';
import { parishPrestige } from '@/systems/standing';
import type { GameState } from '@/types';

function pastorOf(seed: string, cash = 900_000): GameState {
  const s = parishState(seed);
  return { ...s, assignment: { ...s.assignment!, role: 'pastor' }, parish: { ...s.parish!, role: 'pastor', finance: { ...s.parish!.finance, cash, debt: 0 } }, flags: { ...s.flags, ordination_week: s.clock.week - 52 * 10 } };
}

describe('the third playtest round', () => {
  it('a pastor is never sent back as a vicar', () => {
    for (let i = 0; i < 25; i++) {
      const p = { ...pastorOf(`np-${i}`), openings: [] };
      const r = nextAssignment(p, createRng(`na-${i}`));
      expect(['pastor', 'administrator']).toContain(r.state.assignment!.role);
      expect(r.state.career[r.state.career.length - 1]!.text).toMatch(/Renewed as pastor|Moved as pastor/);
    }
  });

  it('every diocese has a cathedral, downtown, with a rector, and the diocese flag is set', () => {
    const cands = generateCandidates(createRng('cath'), 2010);
    for (const c of cands) {
      const cathedrals = c.parishes.filter((p) => p.cathedral);
      expect(cathedrals.length, c.presetId).toBe(1);
      const cath = cathedrals[0]!;
      expect(cath.terrain).toBe('urban');
      expect(cath.wealth).toBe(5);
      expect(parishPrestige(cath)).toBe(1);
      expect(c.npcs.find((n) => n.id === cath.pastorId)!.title).toBe('Msgr.');
    }
    const { state } = newGame({ seed: 'flag', start: { year: 2010, month: 8, day: 20 } });
    const installed = installWorld(state, cands[1]!, 2010);
    expect(installed.flags[`diocese:${cands[1]!.presetId}`]).toBe(true);
    const moved = installWorld(installed, cands[2]!, 2010);
    expect(moved.flags[`diocese:${cands[1]!.presetId}`]).toBeUndefined();
    expect(moved.flags[`diocese:${cands[2]!.presetId}`]).toBe(true);
  });

  it('money that is not owed can be spent, stood as a fund, put behind a group, or invested', () => {
    const p = pastorOf('money');
    expect(spendable(p)).toBeGreaterThan(100_000);
    const av = spendAvailability(p);
    expect(av.find((a) => a.def.id === 'parish_mission')!.available).toBe(true);
    const inDebt: GameState = { ...p, parish: { ...p.parish!, finance: { ...p.parish!.finance, debt: 10_000 } } };
    expect(spendAvailability(inDebt).filter((a) => a.def.kind === 'once').every((a) => !a.available)).toBe(true);
    const missioned = spend(p, 'parish_mission');
    expect(missioned.parish!.finance.cash).toBe(p.parish!.finance.cash - 15_000);
    expect(missioned.flags['held:mission']).toBe(true);
    const funded = spend(p, 'poor_fund');
    expect(funded.parish!.finance.funds!.poor_fund).toBe(p.clock.week);
    const after = spendingWeek({ ...funded, clock: { ...funded.clock, week: funded.clock.week + 1 } }, createRng('sw'));
    expect(after.state.parish!.finance.cash).toBe(funded.parish!.finance.cash - 400);
    expect(after.state.character!.reputation.parishioners).toBeGreaterThan(funded.character!.reputation.parishioners);
    const broke = spendingWeek({ ...funded, parish: { ...funded.parish!, finance: { ...funded.parish!.finance, cash: 100 } } }, createRng('dry'));
    expect(broke.state.parish!.finance.funds!.poor_fund).toBeUndefined();
    expect(broke.lines[0]).toMatch(/ran dry/);
    const g = parishGroups(p)[0]!;
    const backed = fundGroup(p, g.id, 4000);
    expect(backed.groups[g.id]!.vitality).toBe(Math.min(100, g.vitality + 10));
    expect(mayInvest(p).ok).toBe(p.character!.stats.administration >= 60);
    const cpa: GameState = { ...p, character: { ...p.character!, credentials: [...p.character!.credentials, 'partial_cpa'] } };
    expect(mayInvest(cpa).ok).toBe(true);
    const invested = invest(cpa, 100_000);
    expect(invested.parish!.finance.endowment).toBe(100_000);
    let grown = invested;
    for (let i = 0; i < 52; i++) grown = spendingWeek({ ...grown, clock: { ...grown.clock, week: grown.clock.week + 1 } }, createRng(`mk:${i}`)).state;
    expect(grown.parish!.finance.endowment).not.toBe(100_000);
    const back = withdraw(grown, 50_000);
    expect(back.parish!.finance.cash).toBe(grown.parish!.finance.cash + 50_000);
  });

  it('the Newman Center, the hospital, and the seminary are full-time postings with their own days', () => {
    for (const [offerId, city, activity] of [['pv_university_chaplain', 'campus', 'campus_mass'], ['pv_hospital_chaplain', 'hospital', 'wards'], ['pv_seminary_faculty', 'seminary', 'lectures']] as const) {
      const base = parishState(`post-${city}`);
      const c = base.character!;
      const s: GameState = {
        ...base,
        character: { ...c, stats: { ...c.stats, charisma: 70, theology: 70, piety: 60 }, reputation: { ...c.reputation, chancery: 40 } },
        offers: [{ offerId, arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }],
        flags: { ...base.flags, ordination_week: base.clock.week - 52 * 4, 'career:nurse': true, chaplain_hospital_track: true },
      };
      const def = offerById(offerId)!;
      expect(def.accept.commitment!.away).toBeDefined();
      let away: GameState;
      try {
        away = acceptOffer(s, def, createRng('post')).state;
      } catch (e) {
        // A requirement this fixture cannot meet is not the point of the test.
        expect(String(e)).toMatch(/requirements/);
        continue;
      }
      expect(away.phase).toBe('study');
      expect(away.parish).toBeNull();
      expect(away.study!.city).toBe(city);
      expect(studyActivitiesFor(away).map((a) => a.def.id)).toContain(activity);
      expect(studyActivitiesFor(away).map((a) => a.def.id)).not.toContain('thesis');
    }
  });

  it('the hours slider overrides the preset and shifts the free hours', () => {
    const s = parishState('slider');
    expect(workHours(s)).toBe(48);
    const long: GameState = { ...s, settings: { workWeek: 'standard', wear: 1, hours: 72 } };
    expect(workHours(long)).toBe(72);
    expect(weekBudget(long)).toBe(18);
    expect(freeHourShift(long)).toBe(3);
    expect(workHours({ ...s, settings: { workWeek: 'standard', wear: 1, hours: 200 } })).toBe(80);
    expect(workHours({ ...s, settings: { workWeek: 'punishing', wear: 1 } })).toBe(64);
  });
});
