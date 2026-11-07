import { describe, expect, it } from 'vitest';
import { studyActivities, studyProgram } from '@/content/study';
import { offerById } from '@/content/offers';
import { beginStudy } from '@/engine/study';
import { createRng } from '@/engine/rng';
import { studyActivitiesFor } from '@/systems/studyWeek';
import { parishState } from '../systems/week.test';
import type { GameState, StudyActivityDef } from '@/types';

function posted(seed: string, offerId: string): GameState {
  const base = parishState(seed);
  const c = base.character!;
  const s: GameState = { ...base, flags: { ...base.flags, ordination_week: base.clock.week - 4 * 52, rome_alumnus: true, nac_alumnus: true }, character: { ...c, credentials: [...c.credentials, 'italian', 'STL'], reputation: { ...c.reputation, rome: 40 } } };
  return beginStudy(s, offerById(offerId)!, false, createRng(`${seed}:go`));
}

const CITIES: { city: string; offer: string; program: string }[] = [
  { city: 'academy', offer: 'rome_diplomatic_academy', program: 'diplomatic_academy' },
  { city: 'nunciature', offer: 'rome_diplomatic_academy', program: 'nunciature' },
  { city: 'curia', offer: 'rome_curia_official', program: 'curia_official' },
  { city: 'college', offer: 'rome_nac_formator', program: 'nac_formator' },
  { city: 'vatican', offer: 'rome_vatican_chaplain', program: 'vatican_chaplain' },
];

function ofCity(city: string): StudyActivityDef[] {
  return studyActivities.filter((a) => (Array.isArray(a.city) ? a.city.includes(city as never) : a.city === city));
}

describe("the Roman postings' hours (owner: more to do in Rome than the desk)", () => {
  it('every Roman posting has its hours: the desk, and a Mass, the box, and theology beside it', () => {
    for (const { city, program } of CITIES) {
      const acts = ofCity(city);
      expect(acts.length, city).toBeGreaterThanOrEqual(7);
      expect(acts.some((a) => /confession|box/i.test(a.label + a.blurb)), `${city} confessions`).toBe(true);
      expect(acts.some((a) => /theolog/i.test(a.label + a.blurb)), `${city} theology`).toBe(true);
      expect(acts.some((a) => /\bMass\b/.test(a.label + a.blurb)), `${city} a Mass`).toBe(true);
      expect(acts.some((a) => a.kind === 'study'), city).toBe(true);
      expect(acts.some((a) => a.kind === 'work'), city).toBe(true);
      // The dials and the book an activity moves are the program's own.
      const def = studyProgram(program)!;
      const dials = new Set(def.place?.dials.map((d) => d.id) ?? []);
      const book = new Set(def.place?.book?.map((b) => b.id) ?? []);
      for (const a of acts) {
        for (const k of Object.keys(a.place ?? {})) expect(dials.has(k), `${a.id} dial ${k}`).toBe(true);
        for (const k of Object.keys(a.record ?? {})) expect(book.has(k), `${a.id} book ${k}`).toBe(true);
        expect(a.digest.length, a.id).toBeGreaterThanOrEqual(2);
        expect(a.maxAp, a.id).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('a man in each posting is offered them, and may take an hour of each', () => {
    for (const { city, offer } of CITIES) {
      if (city === 'nunciature') continue; // the service begins after the Academy; its hours are the same table
      const s = posted(`hours:${city}`, offer);
      expect(s.study?.city).toBe(city);
      const offered = studyActivitiesFor(s);
      expect(offered.length, city).toBeGreaterThanOrEqual(7);
      expect(offered.filter((o) => o.available).length, city).toBeGreaterThanOrEqual(6);
    }
  });
});
