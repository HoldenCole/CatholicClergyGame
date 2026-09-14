import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { INTERESTS, interestsOf, parishInterest, setInterest } from '@/systems/interests';
import { offerById } from '@/content/offers';
import { offerWeight } from '@/engine/offers';
import { buildChoice } from '@/systems/choice';
import { languageDefs, learnWeek, learnable, setLearning, speaks } from '@/systems/languages';
import { seminaryActivities } from '@/content/seminary';
import { seminaryActivityOffered, setSeminaryActivity } from '@/systems/seminaryWeek';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { currentParish, dialAvailability, setDial } from '@/systems/liturgy';
import { setDiscretionary } from '@/engine/parish';
import { parishWeek } from '@/engine/parish';
import { clubsForPhase } from '@/systems/clubs';
import { actionById } from '@/content/parish';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState, Parish } from '@/types';

describe('indicate interest', () => {
  it('goes on file, three at most, one parish at a time, and makes the matching letter likelier', () => {
    let s = parishState('interest');
    s = setInterest(s, 'rome', true);
    s = setInterest(s, 'hospital', true);
    expect(interestsOf(s).sort()).toEqual(['hospital', 'rome']);
    const p1 = s.world!.parishes[3]!.id;
    const p2 = s.world!.parishes[4]!.id;
    s = setInterest(s, `parish:${p1}`, true);
    expect(() => setInterest(s, 'newman', true)).toThrow(/asking for everything/);
    s = setInterest(s, `parish:${p2}`, true);
    expect(parishInterest(s)).toBe(p2);
    expect(interestsOf(s).length).toBe(INTERESTS.max);
    const rome = offerById('pv_rome_study')!;
    expect(rome.interest).toBe('rome');
    const plain = setInterest(s, 'rome', false);
    expect(offerWeight(rome, s)).toBeCloseTo(offerWeight(rome, plain) * INTERESTS.offerWeight);
    expect(s.career.some((e) => /interested/.test(e.text))).toBe(true);
  });

  it('at ordination, a good record turns an interest into a choice: Rome, or the parish he asked for', () => {
    const sem: GameState = { ...seminaryState('choice-int'), flags: { rector_recommends: true } };
    const world = parishState('choice-int-world').world!;
    const withWorld: GameState = { ...sem, world };
    const fallback = { parishId: world.parishes[0]!.id, role: 'parochial_vicar' as const, startWeek: 0, letter: 'x', reasons: ['because'] };
    const none = buildChoice(withWorld, createRng('c'), 'ordination', fallback)!;
    expect(none.options.map((o) => o.id)).not.toContain('rome');
    const asked = setInterest(setInterest({ ...withWorld, flags: { ...withWorld.flags, rome_track: true } }, 'rome', true), `parish:${world.parishes[5]!.id}`, true);
    const choice = buildChoice(asked, createRng('c'), 'ordination', fallback)!;
    expect(choice.options.map((o) => o.id)).toContain('rome');
    expect(choice.options.find((o) => o.id === 'rome')!.posting).toBe('pv_rome_study');
    const askedOpt = choice.options.find((o) => o.id === 'asked');
    expect(askedOpt?.assignment.parishId).toBe(world.parishes[5]!.id);
  });
});

describe('the Latin Mass society, in these years', () => {
  it('costs nothing with the progressive wing, drifts alignment only gently, and the older Mass barely moves them', () => {
    const club = clubsForPhase(seminaryState('tlm')).find((c) => c.id === 'tlm_society')!;
    expect(club.weekly.some((e) => e.target === 'reputation' && e.key === 'progressive_bloc')).toBe(false);
    expect(Math.abs(club.weekly.find((e) => e.target === 'alignment')!.delta!)).toBeLessThanOrEqual(0.1);
    expect(club.blurb).toMatch(/compliment/);
    expect(offerById('sem_tlm_society')!.body).not.toMatch(/enemies/);
    const older = actionById('older_mass')!;
    expect(Math.abs(older.effectsPerAp.find((e) => e.key === 'progressive_bloc')!.delta!)).toBeLessThanOrEqual(0.03);
  });
});

describe('languages that stick', () => {
  it('a language held is not offered again, in seminary or in Rome', () => {
    const sem = seminaryState('lang');
    const italian = seminaryActivities.find((a) => a.id === 'italian')!;
    expect(seminaryActivityOffered(sem, italian)).toBe(true);
    const fluent: GameState = { ...sem, character: { ...sem.character!, credentials: [...sem.character!.credentials, 'italian'] } };
    expect(seminaryActivityOffered(fluent, italian)).toBe(false);
    expect(() => setSeminaryActivity(fluent, 'italian', 1)).toThrow(/already/);
    for (const id of ['french', 'german', 'polish', 'vietnamese', 'tagalog', 'korean']) expect(seminaryActivities.some((a) => a.id === id), id).toBe(true);
    // Rome: a man who learned Italian in seminary is not offered it again; French and German are there.
    const base = parishState('rome-lang');
    const c = base.character!;
    const s: GameState = { ...base, character: { ...c, stats: { ...c.stats, theology: 75, knowledge: 60 }, reputation: { ...c.reputation, chancery: 40 }, credentials: [...c.credentials, 'italian'] }, offers: [{ offerId: 'pv_rome_study', arrivedWeek: base.clock.week, expiresWeek: base.clock.week + 6, bindings: {} }], flags: { ...base.flags, ordination_week: base.clock.week - 52 * 3, rome_track: true } };
    const away = acceptAndGo(s, offerById('pv_rome_study')!, createRng('a')).state;
    const ids = studyActivitiesFor(away).filter((a) => a.available).map((a) => a.def.id);
    expect(ids).not.toContain('italian');
    expect(ids).toContain('french');
    expect(ids).toContain('german');
  });

  it('a priest takes up a language in the study hours and holds it when the hours are in', () => {
    let s = parishState('learn');
    expect(speaks(s, 'polish')).toBe(false);
    expect(learnable(s).some((l) => l.id === 'polish')).toBe(true);
    s = setLearning(s, 'polish');
    expect(s.flags.learning).toBe('polish');
    expect(() => setLearning({ ...s, character: { ...s.character!, credentials: ['polish'] } }, 'polish')).toThrow(/already/);
    const polish = languageDefs.find((l) => l.id === 'polish')!;
    const direct = learnWeek(s, 2);
    expect(direct.state.flags['language_hours:polish']).toBeGreaterThan(0);
    // Through the week itself: study blocks count.
    let t = setDiscretionary(s, 'study', 3);
    let weeks = 0;
    while (!speaks(t, 'polish') && weeks < 80) {
      t = parishWeek({ ...t, clock: { ...t.clock, week: t.clock.week + 1 } }, createRng(`w${weeks}`));
      weeks++;
    }
    expect(speaks(t, 'polish')).toBe(true);
    expect(weeks).toBeLessThan(80);
    expect(t.flags.learning).toBeUndefined();
    expect(t.career.some((e) => /learned an hour at a time/.test(e.text))).toBe(true);
    expect(learnable(t).some((l) => l.id === 'polish')).toBe(false);
    expect(polish.hours).toBe(70);
  });

  it("a community's Mass needs its language: held ones stay, new ones wait for it", () => {
    const base = parishState('needs-lang');
    const s: GameState = { ...base, assignment: { ...base.assignment!, role: 'pastor' } };
    const parish = currentParish(s)!;
    const latino: Parish = { ...parish, ethnic: { ...parish.ethnic, latino: 0.4, polish: 0.3 }, liturgy: { ...parish.liturgy!, communities: 'polish_mass' } };
    const t: GameState = { ...s, world: { ...s.world!, parishes: s.world!.parishes.map((p) => (p.id === parish.id ? latino : p)) } };
    const comm = dialAvailability(t).find((d) => d.def.id === 'communities')!;
    const spanish = comm.options.find((o) => o.def.id === 'spanish_mass')!;
    expect(spanish.available).toBe(false);
    expect(spanish.why).toMatch(/take up spanish/);
    // The Polish Mass the last pastor kept is held and can still be dropped.
    expect(comm.options.find((o) => o.def.id === 'polish_mass')!.available).toBe(true);
    expect(() => setDial(t, 'communities', 'spanish_mass')).toThrow(/take up spanish/);
    const fluent: GameState = { ...t, character: { ...t.character!, credentials: [...t.character!.credentials, 'spanish'] } };
    expect(dialAvailability(fluent).find((d) => d.def.id === 'communities')!.options.find((o) => o.def.id === 'spanish_mass')!.available).toBe(true);
    expect(currentParish(setDial(fluent, 'communities', 'spanish_mass'))!.liturgy!.communities).toContain('spanish_mass');
  });
});

describe('a finished language gives its hours back', () => {
  it('in seminary the routine drops the hours and says so, and the activity stays listed as completed', async () => {
    const { seminaryWeek, routineOf, routineHours, setSeminaryActivity } = await import('@/systems/seminaryWeek');
    const sem = seminaryState('free-hours');
    let s: GameState = { ...sem, seminary: { ...sem.seminary!, emphasis: { human: 3, spiritual: 3, intellectual: 2, pastoral: 2 }, routine: { latin: 2, spanish: 2 }, hoursLogged: { latin: 39 } } };
    const before = routineHours(s.seminary!);
    const week = seminaryWeek(s, createRng('w'));
    s = week.state;
    expect(s.character!.credentials).toContain('latin');
    expect(routineOf(s.seminary!).latin).toBeUndefined();
    expect(routineHours(s.seminary!)).toBe(before - 2);
    expect(week.line).toMatch(/hours are yours again/);
    // The finished one is not offered, and the freed hours can go elsewhere.
    expect(() => setSeminaryActivity(s, 'latin', 1)).toThrow(/already/);
    const moved = setSeminaryActivity(s, 'holy_hour', 2);
    expect(routineOf(moved.seminary!).holy_hour).toBe(2);
  });
});
