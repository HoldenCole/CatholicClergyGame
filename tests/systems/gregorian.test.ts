import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { parishState } from './week.test';
import { offerById } from '@/content/offers';
import { appointmentStep, askToGo, placeChance } from '@/engine/appointment';
import { ROME_CHOICE, romeChoiceChance } from '@/systems/choice';
import { NUNCIO } from '@/systems/rome/nuncio';
import { nuncioView } from '@/systems/rome/nuncioView';
import type { GameState } from '@/types';

/** A priest of ordinary gifts, mid-career: the man the Gregorian either makes a bishop of or does not. */
function ordinary(seed: string, roman: boolean): GameState {
  const s = parishState(seed);
  const c = s.character!;
  const bishopId = s.world!.diocese.hidden.bishop.npcId;
  return {
    ...s,
    character: {
      ...c,
      stats: { ...c.stats, administration: 50, charisma: 55, theology: roman ? 70 : 60 },
      reputation: { ...c.reputation, rome: roman ? 30 : 5, chancery: 30, bishops: 0 },
      credentials: roman ? ['italian', 'STL'] : [],
      positions: [],
    },
    flags: { ...s.flags, ...(roman ? { rome_alumnus: true, nac_alumnus: true } : {}) },
    npcs: { ...s.npcs, [bishopId]: { ...s.npcs[bishopId]!, relationship: 25 } },
  };
}

describe('the Gregorian after ordination', () => {
  it('Rome at ordination is rolled: a man of the College put forward for a fifth year has the best odds, the top of the class who only asked the worst', () => {
    const s = parishState('greg:choice');
    expect(romeChoiceChance(s)).toBe(0);
    expect(romeChoiceChance({ ...s, flags: { ...s.flags, rome_track: true } })).toBe(ROME_CHOICE.tracked);
    expect(romeChoiceChance({ ...s, flags: { ...s.flags, nac_alumnus: true, 'nac:wants_fifth_year': true } })).toBe(ROME_CHOICE.fifthYear);
    expect(ROME_CHOICE.fifthYear).toBeGreaterThan(ROME_CHOICE.tracked);
    expect(ROME_CHOICE.tracked).toBeGreaterThan(ROME_CHOICE.asked);
    expect(ROME_CHOICE.fifthYear).toBeLessThan(0.6);
  });

  it("the bishop's yes is not the Gregorian's: the place is rolled, and a man of the College keeps it more often", () => {
    const def = offerById('pv_rome_study')!;
    const s = parishState('greg:place');
    expect(placeChance(s, def)).toBe(0.5);
    expect(placeChance({ ...s, flags: { ...s.flags, nac_alumnus: true } }, def)).toBe(0.8);
    expect(placeChance(s, offerById('pv_hospital_chaplain')!)).toBe(1);
    // Over many years the letters come out as the numbers say.
    const count = (nac: boolean) => {
      let noPlace = 0;
      let went = 0;
      for (let i = 0; i < 200; i++) {
        const base: GameState = { ...s, flags: { ...s.flags, ...(nac ? { nac_alumnus: true } : {}) }, clock: { ...s.clock, week: s.clock.week + i * 7 } };
        const asked = askToGo(base, def, false, createRng(`ask${i}`));
        const due = { ...asked, clock: { ...asked.clock, week: asked.clock.week + 6 } };
        const res = appointmentStep(due, createRng(`step${i}`), (id) => offerById(id));
        if (res.letter === 'no_place') noPlace++;
        if (res.letter === 'go') went++;
        if (res.letter === 'no_place') expect(res.state.flags['no_place:rome_stl']).toBe(true);
      }
      return { noPlace, went };
    };
    const home = count(false);
    const college = count(true);
    expect(home.noPlace + home.went).toBe(200);
    expect(home.noPlace).toBeGreaterThan(70);
    expect(home.noPlace).toBeLessThan(130);
    expect(college.noPlace).toBeLessThan(home.noPlace);
    expect(college.noPlace).toBeGreaterThan(10);
  });

  it('the Gregorian\'s letter is rare, likelier for a man of the College, and promised only by the rector\'s plan', () => {
    const def = offerById('pv_rome_study')!;
    expect(def.weight).toBeLessThanOrEqual(10);
    expect(JSON.stringify(def.bias)).toContain('nac_alumnus');
    expect(JSON.stringify(def.guarantee)).not.toContain('rome_track');
    expect(JSON.stringify(def.guarantee)).toContain('rector_plan');
    const track = offerById('sem_rome_track')!;
    expect(track.weight).toBeLessThanOrEqual(15);
    expect(JSON.stringify(track.requires)).toContain('seminary:rome');
  });

  it('a Roman licentiate makes a bishop about half the time over a career; the same man without it, almost never', () => {
    const roman = nuncioView(ordinary('greg:view', true));
    const plain = nuncioView(ordinary('greg:view', false));
    expect(roman.good).toContain('the Roman degree');
    expect(roman.good).toContain("the College's years");
    expect(roman.value).toBeGreaterThan(plain.value + 20);
    // The nunciature's own arithmetic (systems/rome/nuncio.ts): a see falls vacant about this often; at the threshold his name goes
    // on the terna with one chance and Rome takes it with another, both rising with the reading; one terna at a time, forty-odd
    // weeks each; a man is a candidate from sixteen years ordained to sixty-two. Simulated here over the years such a man has.
    const named = (view: number, runs = 2000) => {
      const years = 19;
      const perVacancy = view < NUNCIO.candidate.view ? 0 : Math.min(NUNCIO.listCap, NUNCIO.onList + (view - NUNCIO.candidate.view) / NUNCIO.perView) * Math.min(NUNCIO.chosenCap, NUNCIO.chosen + (view - NUNCIO.candidate.view) / NUNCIO.perView);
      let hits = 0;
      for (let r = 0; r < runs; r++) {
        const rng = createRng(`mitre:${r}`);
        let busyUntil = 0;
        let done = false;
        for (let w = 0; w < years * 52 && !done; w++) {
          if (w < busyUntil) continue;
          if (!rng.chance(NUNCIO.vacancyPerYear / 52)) continue;
          busyUntil = w + rng.int(NUNCIO.sendAfter[0], NUNCIO.sendAfter[1]) + rng.int(NUNCIO.nameAfter[0], NUNCIO.nameAfter[1]);
          if (rng.chance(perVacancy)) done = true;
        }
        if (done) hits++;
      }
      return hits / runs;
    };
    const withDegree = named(roman.value);
    const without = named(plain.value);
    expect(withDegree).toBeGreaterThan(0.35);
    expect(withDegree).toBeLessThan(0.65);
    expect(without).toBeLessThan(0.1);
  });
});
