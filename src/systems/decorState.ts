import type { DecorOption, DecorPlace, GameState, Parish, PlaceDecor } from '@/types';
import decor from '@/content/parish/decor.json';

export const decorOptions = decor as DecorOption[];

export function placeKey(state: GameState, place: DecorPlace): string {
  const pid = state.assignment?.parishId ?? 'none';
  switch (place) {
    case 'church':
    case 'office':
      return `parish:${pid}:${place}`;
    case 'rectory':
      return `rectory:${pid}`;
    case 'seminary_room':
      return 'seminary';
    case 'chancery':
      return 'chancery';
  }
}

/** What a church looks like before anyone changes it, from the parish record. Deterministic. */
export function defaultChurchDecor(parish: Parish): PlaceDecor {
  const a = parish.alignment;
  const trad = a <= -25;
  const prog = a >= 25;
  return {
    sanctuary: trad ? 'sanct_high_altar' : prog ? (parish.wealth >= 4 ? 'sanct_modern' : 'sanct_plain') : 'sanct_plain',
    altar_rail: trad ? (parish.wealth >= 4 ? 'rail_marble' : 'rail_wood') : 'rail_none',
    orientation: 'orient_populum',
    confessionals: trad || parish.generational === 'aging' ? 'conf_booths' : prog ? 'conf_room' : 'conf_both',
    choir: prog ? 'choir_front' : 'choir_loft',
    statues: parish.kind === 'struggling_urban' || parish.kind === 'immigrant_growing' || trad ? 'statues_many' : prog ? 'statues_few' : 'statues_many',
    tabernacle: prog && parish.wealth >= 3 ? 'tab_side' : 'tab_center',
    mass_form: 'mass_vernacular',
    music: parish.needsSpanish ? 'music_bilingual' : prog ? 'music_contemporary' : 'music_organ',
  };
}

export function defaultDecor(place: DecorPlace, parish: Parish | undefined): PlaceDecor {
  switch (place) {
    case 'church':
      return parish ? defaultChurchDecor(parish) : {};
    case 'office':
      return { wall: 'owall_crucifix', desk: 'odesk_inherited', corner: 'ocorner_files' };
    case 'rectory':
      return { wall: 'rwall_crucifix', corner: 'rcorner_tv' };
    default:
      return {};
  }
}

/** The current look of a place, defaults filled in. */
export function currentDecor(state: GameState, place: DecorPlace): PlaceDecor {
  const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  return { ...defaultDecor(place, parish), ...(state.decor[placeKey(state, place)] ?? {}) };
}

