import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState } from '../helpers/fixtures';
import { religiousOrder } from '@/content/religious';
import { generateProvince } from '@/generation/province';
import { installProvince } from '@/systems/religious/install';
import { seminaryActivities } from '@/content/seminary';
import { seminaryActivityOffered, seminaryWeek, setSeminaryActivity } from '@/systems/seminaryWeek';
import { clubsForPhase, clubsWeek, joinClub } from '@/systems/clubs';
import { clubDef } from '@/content/clubs';
import { spendDef, spendOffered } from '@/systems/religious/spends';
import { allEvents } from '@/content';
import clubsSeminary from '@/content/clubs/seminary.json';
import clubsReligious from '@/content/clubs/religious.json';
import type { ClubDef, GameState, OrderKey } from '@/types';

function student(seed: string, order: OrderKey, year: number): GameState {
  const def = religiousOrder(order);
  const gen = generateProvince(createRng(`${seed}:province`), def, def.provinces[0]!, 2010);
  const first = (gen.houses.find((h) => h.kind === 'studium') ?? gen.houses[0]!).id;
  const base = seminaryState(seed);
  const s = installProvince(base, gen, 2010, first);
  return { ...s, seminary: { ...s.seminary!, year, emphasis: { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 } }, flags: { ...s.flags, [`order:${order}`]: true } };
}

/** Stat points a week per hour, summed over the club's stat and pillar effects. */
function perHour(c: ClubDef): number {
  return c.weekly.filter((e) => e.target === 'stat' || e.target === 'pillar').reduce((n, e) => n + Math.max(0, e.delta ?? 0), 0) / c.hours;
}

describe('the rite of the order: learned in formation, celebrated after', () => {
  it('the chapel activity is a Dominican student\'s, not a diocesan seminarian\'s nor an Augustinian\'s, and the hours earn the credential', () => {
    const def = seminaryActivities.find((a) => a.id === 'dominican_rite')!;
    expect(def.location).toBe('chapel');
    expect(seminaryActivityOffered(seminaryState('dio'), def)).toBe(false);
    expect(seminaryActivityOffered(student('osa', 'OSA', 3), def)).toBe(false);
    let s = student('op', 'OP', 3);
    expect(seminaryActivityOffered(s, def)).toBe(true);
    s = setSeminaryActivity(s, 'dominican_rite', 2);
    expect(s.seminary!.routine?.dominican_rite).toBe(2);
    let weeks = 0;
    while (!s.character!.credentials.includes('dominican_rite') && weeks < 60) {
      s = seminaryWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }, createRng(`w:${weeks}`)).state;
      weeks += 1;
    }
    expect(s.character!.credentials).toContain('dominican_rite');
    expect(s.flags.can_celebrate_dominican_rite).toBe(true);
    expect(weeks).toBeGreaterThanOrEqual(25);
    // Learned, it is not offered again.
    expect(seminaryActivityOffered(s, def)).toBe(false);
  });

  it('the students\' rite society is a Dominican club that earns the credential in a year, and the religious circles pay per hour as the diocesan ones do', () => {
    const op = student('club', 'OP', 3);
    const ids = clubsForPhase(op).map((c) => c.id);
    expect(ids).toContain('students_rite_society');
    expect(clubsForPhase(student('club-osa', 'OSA', 3)).map((c) => c.id)).not.toContain('students_rite_society');
    expect(clubsForPhase(seminaryState('club-dio')).map((c) => c.id)).not.toContain('students_rite_society');
    let s = joinClub(op, 'students_rite_society', createRng('join'));
    expect(s.flags['club:students_rite_society']).toBe(true);
    for (let i = 0; i < 52; i++) s = clubsWeek({ ...s, clock: { ...s.clock, week: s.clock.week + 1 } }).state;
    expect(s.character!.credentials).toContain('dominican_rite');
    expect(s.character!.stats.piety).toBeGreaterThan(op.character!.stats.piety);
    // Balance: no religious seminary circle pays less than two thirds of the weakest diocesan one per hour, and their average is within a fifth of the diocesan average.
    const dio = (clubsSeminary as ClubDef[]).filter((c) => c.phase === 'seminary');
    const rel = (clubsReligious as ClubDef[]).filter((c) => c.phase === 'seminary');
    const floor = Math.min(...dio.map(perHour));
    for (const c of rel) expect(perHour(c), c.id).toBeGreaterThanOrEqual(floor * 0.66);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(rel.map(perHour))).toBeGreaterThanOrEqual(avg(dio.map(perHour)) * 0.8);
    // Priests' circles: every religious one builds a stat, as the diocesan ones do.
    for (const c of (clubsReligious as ClubDef[]).filter((x) => x.phase === 'priest')) expect(c.weekly.some((e) => e.target === 'stat' && (e.delta ?? 0) > 0), c.id).toBe(true);
    expect(clubDef('students_rite_society')!.credentialAfter!.credential).toBe('dominican_rite');
  });

  it('after ordination the rite is a spend only for the man who learned it, and the scenes of the rite are Dominican and gated on the credential where they say it', () => {
    const def = spendDef('order_rite')!;
    const s = { ...student('spend', 'OP', 7), flags: { ...student('spend', 'OP', 7).flags, ordained: true } };
    expect(spendOffered(s, def).why).toBe('Not learned');
    const learned = { ...s, character: { ...s.character!, credentials: [...s.character!.credentials, 'dominican_rite'] } };
    expect(spendOffered(learned, def).ok).toBe(true);
    const scenes = allEvents.filter((e) => e.id.startsWith('opr_rite_'));
    expect(scenes.length).toBe(8);
    for (const e of scenes) {
      expect(e.campaign).toBe('religious');
      expect(JSON.stringify(e.requires)).toContain('order:OP');
    }
    const formation = scenes.filter((e) => e.phase.includes('seminary'));
    expect(formation.length).toBe(6);
    expect(new Set(formation.flatMap((e) => e.yearGate ?? []))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    for (const id of ['opr_rite_deacon_gospel', 'opr_rite_first_mass', 'opr_rite_asked_for']) expect(JSON.stringify(scenes.find((e) => e.id === id)!.requires)).toContain('dominican_rite');
  });
});
