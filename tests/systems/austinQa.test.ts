import { describe, expect, it } from 'vitest';
import { placePool } from '@/engine/seminary';
import { bondWord } from '@/systems/bonds';
import { setInterest } from '@/systems/interests';
import { offerById } from '@/content/offers';
import { eventById } from '@/content';
import { seminaryState } from '../helpers/fixtures';
import type { GameEvent } from '@/types';

const ev = (id: string, place?: GameEvent['place']): GameEvent => ({ id, title: id, body: id, phase: 'seminary', pressure: [], severity: 'ROUTINE', category: 'formation', choices: [], ...(place ? { place } : {}) } as unknown as GameEvent);

describe('Austin and the NAC, QA round', () => {
  it("the home house's scenes never draw in Rome, the College's never at home; unplaced scenes draw in both", () => {
    const pool = [ev('home_only', 'home'), ev('rome_only', 'rome'), ev('either')];
    const home = seminaryState('qa:place');
    const rome = { ...home, seminary: { ...home.seminary!, place: 'rome' as const } };
    expect(placePool(pool, home).map((e) => e.id)).toEqual(['home_only', 'either']);
    expect(placePool(pool, rome).map((e) => e.id)).toEqual(['rome_only', 'either']);
  });

  it("the review has a verb for every bond kind the scenes write", () => {
    expect(bondWord({ kind: 'formed', week: 0, who: 'the boy who served the eight o\'clock' })).toBe("formed the boy who served the eight o'clock");
    expect(bondWord({ kind: 'heard', week: 0, who: 'the father in the car park' })).toBe('heard the father in the car park');
    expect(bondWord({ kind: 'told', week: 0, who: 'you had asked to be moved' })).toBe('told you had asked to be moved');
    expect(bondWord({ kind: 'buried', week: 0, who: 'her husband' })).toBe('buried her husband');
  });

  it('the interest note keeps the proper noun', () => {
    const s = setInterest(seminaryState('qa:note'), 'nac', true);
    expect(s.career.at(-1)?.text).toBe('Told the chancery you would be interested: the North American College.');
  });

  it('the offers that move a man wait until he has been a year in his post', () => {
    for (const id of ['pv_hard_parish', 'pv_hospital_chaplain', 'pv_university_chaplain', 'pv_rome_study']) {
      const o = offerById(id)!;
      expect(o.requires.some((c) => c.type === 'weeks_served' && c.op === '>=' && c.value >= 40), id).toBe(true);
    }
  });

  it('the scenes of a life abroad stay abroad: Christmas in Rome in December, the far director only at a far posting', () => {
    const christmas = eventById('st_christmas_away')!;
    expect(christmas.requires?.some((c) => c.type === 'month' && c.op === '>=' && c.value === 12)).toBe(true);
    const director = eventById('sd_p_away_from_home')!;
    const far = director.requires?.find((c) => c.type === 'any');
    expect(far && far.type === 'any' ? far.inner.map((c) => (c.type === 'flag' ? c.key : '')) : []).toContain('study:rome');
    expect(far && far.type === 'any' ? far.inner.map((c) => (c.type === 'flag' ? c.key : '')) : []).not.toContain('study:college');
  });
});
