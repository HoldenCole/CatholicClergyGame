import { describe, expect, it } from 'vitest';
import { studySceneChance } from '@/engine/weekHook';
import { laneLabelFor } from '@/systems/digest';
import { sceneById } from '@/ui/scenes/scenes';
import { seminaryState } from '../helpers/fixtures';
import type { GameState, StudyState } from '@/types';

function away(city: StudyState['city'], religious = false): GameState {
  const s = seminaryState(`qa:${city}`);
  return { ...s, study: { offerId: 'x', program: 'x', city, label: 'x', school: 'x', residence: 'x', startWeek: 0, endWeek: 100, failed: false, routine: {}, hoursLogged: {}, taken: [], fromParishId: null }, ...(religious ? { religious: { order: 'OP' } as never } : {}) };
}

describe('Rome through the screens (E1 §11.8)', () => {
  it('a Roman posting draws a scene more often than a week away elsewhere; a friar keeps his own rates', () => {
    expect(studySceneChance(away('hospital'))).toBe(0.1);
    expect(studySceneChance(away('washington'))).toBe(0.1);
    for (const city of ['academy', 'nunciature', 'curia', 'college', 'vatican'] as const) expect(studySceneChance(away(city)), city).toBeGreaterThan(0.15);
    expect(studySceneChance(away('rome'))).toBeGreaterThan(0.1);
    expect(studySceneChance(away('generalate', true))).toBe(0.28);
    expect(studySceneChance(away('curia', true))).toBe(0.2);
    expect(studySceneChance(seminaryState('qa:none'))).toBe(0.1);
  });

  it('the room is named for the house, and the record reads the post for a man with no parish', () => {
    expect(sceneById('study_room', 'rome').label).toBe('Your room at the college');
    expect(sceneById('study_room', 'academy').label).toBe('Your room at the Academy');
    expect(sceneById('study_room', 'nunciature').label).toBe('Your room at the nunciature');
    expect(sceneById('study_room', 'curia').label).toBe('Your apartment near the Borgo');
    expect(sceneById('study_room', 'college').label).toBe('Your room on the faculty corridor');
    expect(sceneById('study_room', 'vatican').label).toBe('Your room at the Casa');
    expect(sceneById('study_room', 'residence').label).not.toMatch(/college/);
    expect(laneLabelFor('parish', false)).toBe('The parish');
    expect(laneLabelFor('parish', false, true)).toBe('The post');
    expect(laneLabelFor('around', false, true)).toBe('Around the post');
    expect(laneLabelFor('parish', true, true)).toBe('The house');
    expect(laneLabelFor('people', false, true)).toBe('The people');
  });
});
