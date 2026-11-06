import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { seminaryState, testNpc } from '../helpers/fixtures';
import { parishState } from './week.test';
import { NAC, atRome, italianAfterFirstYear, ordainedFromRome, rollUniversity, romeClassLine, sendToRome } from '@/systems/nac';
import { romeCollege, seminaryActivities, summerOptions } from '@/content/seminary';
import { seminaryActivityOffered } from '@/systems/seminaryWeek';
import { allEvents } from '@/content';
import { offerById } from '@/content/offers';
import { resolveSelector } from '@/engine/selectors';
import { massSaid } from '@/systems/massSaid';
import { evaluateAll } from '@/engine/conditions';
import { availableSummers } from '@/engine/seminary';
import type { GameState } from '@/types';

/** A diocesan seminarian in third year, with the house's formators tagged as the generator tags them. */
function thirdYear(seed: string): GameState {
  const base = seminaryState(seed);
  const npcs = {
    ...base.npcs,
    rector: { ...base.npcs.rector!, tags: ['rector', 'rector:pastoral'] },
    vice_rector: testNpc('vice_rector', { role: 'formator', title: 'Fr.', tags: ['vice_rector', 'vice_rector:enforcer'] }),
    formation_advisor: testNpc('formation_advisor', { role: 'formator', title: 'Fr.', tags: ['formation_advisor'] }),
    spiritual_director: testNpc('spiritual_director', { role: 'formator', title: 'Fr.', tags: ['spiritual_director'] }),
  };
  return { ...base, npcs, flags: { ...base.flags, 'rector:pastoral': true, 'vice_rector:enforcer': true }, seminary: { ...base.seminary!, year: 4 } };
}

describe('the North American College', () => {
  it('the College becomes his house: its own rector and vice-rector take the tags, the diocese keeps its men, and four men of the College sit at his table', () => {
    const s = thirdYear('nac:send');
    const { state, line } = sendToRome(s, createRng('nac'));
    expect(atRome(state.seminary)).toBe(true);
    expect(state.seminary!.name).toBe(romeCollege.name);
    expect(state.flags['seminary:rome']).toBe(true);
    expect(line).toMatch(/Janiculum/);
    // The tags the scenes read now point at the College's men; the diocese's keep theirs under home_.
    expect(resolveSelector(state, '@rector')!.id).toBe('nac_rector');
    expect(resolveSelector(state, '@vice_rector')!.id).toBe('nac_vice_rector');
    expect(state.npcs.rector!.tags).toContain('home_rector');
    expect(state.npcs.rector!.status).toBe('active');
    // The spiritual director stays his.
    expect(resolveSelector(state, '@spiritual_director')!.id).toBe('spiritual_director');
    // The house's style flags follow the house.
    expect(state.flags['rector:pastoral']).toBeUndefined();
    expect(Object.keys(state.flags).some((k) => k.startsWith('rector:'))).toBe(true);
    expect(state.flags['vice_rector:enforcer'] ?? Object.keys(state.flags).some((k) => k.startsWith('vice_rector:'))).toBeTruthy();
    // The men of the College.
    expect(state.seminary!.romeClassmateIds).toHaveLength(NAC.classmates);
    expect(resolveSelector(state, '@nac_classmate')).not.toBeNull();
    expect(state.seminary!.classmateIds).toEqual(s.seminary!.classmateIds);
    // Deterministic.
    expect(JSON.stringify(sendToRome(s, createRng('nac')).state)).toBe(JSON.stringify(state));
    // Sending him twice does nothing.
    expect(sendToRome(state, createRng('again')).state).toBe(state);
  });

  it('the university is one of the three, by share, leaned by the man', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 600; i++) counts[rollUniversity(createRng(`u${i}`), 0).id] = (counts[rollUniversity(createRng(`u${i}`), 0).id] ?? 0) + 1;
    expect(counts.gregorian!).toBeGreaterThan(counts.angelicum!);
    expect(counts.angelicum!).toBeGreaterThan(counts.santa_croce! * 0.8);
    let tradAngelicum = 0;
    let progAngelicum = 0;
    for (let i = 0; i < 600; i++) {
      if (rollUniversity(createRng(`t${i}`), -70).id !== 'gregorian') tradAngelicum++;
      if (rollUniversity(createRng(`t${i}`), 70).id !== 'gregorian') progAngelicum++;
    }
    expect(tradAngelicum).toBeGreaterThan(progAngelicum);
  });

  it("Rome's activities are Rome's and the diocese's are the diocese's; the classes, the day, and the Mass read the house", () => {
    const home = thirdYear('nac:acts');
    const rome = sendToRome(home, createRng('nac')).state;
    const city = seminaryActivities.find((a) => a.id === 'the_city')!;
    const weekend = seminaryActivities.find((a) => a.id === 'parish_weekend')!;
    expect(seminaryActivityOffered(home, city)).toBe(false);
    expect(seminaryActivityOffered(rome, city)).toBe(true);
    expect(seminaryActivityOffered(home, weekend)).toBe(true);
    expect(seminaryActivityOffered(rome, weekend)).toBe(false);
    expect(romeClassLine(rome.seminary!)).toMatch(/theology at the (Gregorian|Angelicum)|Santa Croce/);
    expect(massSaid(rome).line).toMatch(/Janiculum/);
    // The College's summers, and not the summer in Rome.
    const ids = availableSummers(rome).map((o) => o.option.id);
    expect(ids).toContain('nac_road');
    expect(ids).not.toContain('rome');
    expect(availableSummers(home).map((o) => o.option.id)).not.toContain('nac_road');
    expect(summerOptions.find((o) => o.id === 'nac_congregation')!.requires).toBeTruthy();
  });

  it('a year there gives him Italian, and ordination from the College marks him', () => {
    const rome = sendToRome(thirdYear('nac:it'), createRng('nac')).state;
    expect(rome.character!.credentials).not.toContain('italian');
    const after = italianAfterFirstYear(rome);
    expect(after.character!.credentials).toContain('italian');
    expect(italianAfterFirstYear(after)).toBe(after);
    const ordained = ordainedFromRome(after);
    expect(ordained.flags.nac_alumnus).toBe(true);
    expect(ordainedFromRome(thirdYear('nac:home')).flags.nac_alumnus).toBeUndefined();
  });

  it("the rector's letter and the College's scenes are gated as the design says", () => {
    const offer = offerById('sem_nac')!;
    expect(offer.yearGate).toEqual([3]);
    expect(offer.failure!.chance).toBeGreaterThan(0);
    expect(JSON.stringify(offer.bias)).toContain('rome_connection');
    const scenes = allEvents.filter((e) => e.id.startsWith('nac_'));
    expect(scenes.length).toBeGreaterThanOrEqual(10);
    for (const e of scenes) expect(e.requires?.some((c) => c.type === 'flag' && c.key === 'seminary:rome'), e.id).toBe(true);
    expect(scenes.find((e) => e.id === 'nac_diaconate_st_peters')!.beat).toBe('diaconate');
    // The diocese's connection to Rome is readable by content.
    const withWorld = parishState('nac:cond');
    const strong: GameState = { ...withWorld, world: { ...withWorld.world!, diocese: { ...withWorld.world!.diocese, hidden: { ...withWorld.world!.diocese.hidden, romeConnection: 5 } } } };
    const weak: GameState = { ...withWorld, world: { ...withWorld.world!, diocese: { ...withWorld.world!.diocese, hidden: { ...withWorld.world!.diocese.hidden, romeConnection: 1 } } } };
    expect(typeof withWorld.world!.diocese.hidden.romeConnection).toBe('number');
    expect(evaluateAll([{ type: 'diocese', key: 'rome_connection', min: 4 }], strong)).toBe(true);
    expect(evaluateAll([{ type: 'diocese', key: 'rome_connection', min: 4 }], weak)).toBe(false);
  });
});
