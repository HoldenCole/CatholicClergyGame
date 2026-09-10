import type { ActionLocation, ObligationKey } from '@/types';

/**
 * Scene definitions for the graphics layer. Every hotspot binds to data the
 * systems already own: a discretionary action (by location), an obligation
 * dial, a panel, or another scene. Coordinates are percentages of the scene.
 */
export type SceneId = 'church' | 'rectory' | 'office' | 'hall' | 'chapel' | 'street' | 'study' | 'seminary_room' | 'chancery';

export type HotspotBinding =
  | { kind: 'action'; actionId: string }
  | { kind: 'obligation'; key: ObligationKey }
  | { kind: 'panel'; panel: 'routine' | 'groups' | 'projects' | 'offers' | 'digest' | 'parish' | 'formation' }
  | { kind: 'furnish'; place: 'church' | 'office' | 'rectory' | 'seminary_room' | 'chancery' }
  | { kind: 'scene'; scene: SceneId };

export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  binds: HotspotBinding;
}

export interface SceneDef {
  id: SceneId;
  label: string;
  /** Which action locations this scene stands in for. */
  locations: ActionLocation[];
  hotspots: Hotspot[];
}

export const SCENES: SceneDef[] = [
  {
    id: 'church',
    label: 'The church',
    locations: ['church', 'sacristy', 'confessional'],
    hotspots: [
      { id: 'altar', label: 'The altar: Sunday Masses and the homily', x: 40, y: 50, w: 20, h: 18, binds: { kind: 'obligation', key: 'sunday_masses' } },
      { id: 'side_altar', label: 'The side altar: weekday Masses', x: 22, y: 18, w: 12, h: 30, binds: { kind: 'obligation', key: 'weekday_masses' } },
      { id: 'confessional', label: 'The confessional', x: 79, y: 34, w: 14, h: 34, binds: { kind: 'action', actionId: 'extra_confessions' } },
      { id: 'confessions_hours', label: 'The posted confession hours', x: 79, y: 26, w: 14, h: 8, binds: { kind: 'obligation', key: 'confessions' } },
      { id: 'baptistery', label: 'The baptistery: sacramental preparation', x: 6, y: 62, w: 14, h: 22, binds: { kind: 'obligation', key: 'sacramental_prep' } },
      { id: 'sacristy', label: 'The sacristy door', x: 62, y: 20, w: 14, h: 28, binds: { kind: 'scene', scene: 'chapel' } },
      { id: 'sanctuary', label: 'The sanctuary: how the church looks', x: 34, y: 12, w: 32, h: 36, binds: { kind: 'furnish', place: 'church' } },
      { id: 'doors', label: 'The doors: out to the street', x: 44, y: 86, w: 12, h: 14, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'rectory',
    label: 'The rectory',
    locations: ['rectory'],
    hotspots: [
      { id: 'table', label: 'The dinner table: time with brother priests', x: 24, y: 40, w: 52, h: 32, binds: { kind: 'action', actionId: 'brother_priests' } },
      { id: 'phone', label: 'The phone: the digest', x: 14, y: 46, w: 6, h: 10, binds: { kind: 'panel', panel: 'digest' } },
      { id: 'office_door', label: 'The office', x: 2, y: 14, w: 10, h: 60, binds: { kind: 'scene', scene: 'office' } },
      { id: 'study_door', label: 'The study, upstairs', x: 80, y: 8, w: 18, h: 36, binds: { kind: 'scene', scene: 'study' } },
      { id: 'mail', label: 'The mail on the sideboard: offers', x: 4, y: 48, w: 10, h: 12, binds: { kind: 'panel', panel: 'offers' } },
      { id: 'corner', label: 'The corner: how the rectory looks', x: 4, y: 70, w: 22, h: 28, binds: { kind: 'furnish', place: 'rectory' } },
      { id: 'front_door', label: 'The front door', x: 80, y: 46, w: 12, h: 22, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'office',
    label: 'The parish office',
    locations: ['office'],
    hotspots: [
      { id: 'papers', label: 'The papers on the desk: the standing routine', x: 24, y: 56, w: 30, h: 12, binds: { kind: 'panel', panel: 'routine' } },
      { id: 'left_drawer', label: 'The left drawer: administrative catch-up', x: 24, y: 70, w: 18, h: 14, binds: { kind: 'action', actionId: 'admin' } },
      { id: 'ledger', label: 'The ledger: the parish', x: 58, y: 70, w: 18, h: 14, binds: { kind: 'panel', panel: 'parish' } },
      { id: 'chair_left', label: 'The chair where the contractor sits: projects', x: 25, y: 42, w: 12, h: 16, binds: { kind: 'panel', panel: 'projects' } },
      { id: 'chair_right', label: 'The chair where the visitor sits: offers', x: 65, y: 42, w: 12, h: 16, binds: { kind: 'panel', panel: 'offers' } },
      { id: 'window', label: 'The window: the week', x: 36, y: 10, w: 28, h: 32, binds: { kind: 'panel', panel: 'digest' } },
      { id: 'crucifix', label: 'The crucifix: personal prayer', x: 22, y: 14, w: 12, h: 24, binds: { kind: 'action', actionId: 'prayer' } },
      { id: 'wall', label: 'The wall: how your office looks', x: 66, y: 14, w: 16, h: 20, binds: { kind: 'furnish', place: 'office' } },
      { id: 'door', label: 'The door: out into the street', x: 2, y: 20, w: 9, h: 60, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'hall',
    label: 'The parish hall',
    locations: ['hall', 'school'],
    hotspots: [
      { id: 'tables', label: 'The tables: the groups', x: 8, y: 68, w: 84, h: 30, binds: { kind: 'action', actionId: 'groups' } },
      { id: 'board', label: 'The bulletin board: the groups and their leaders', x: 3, y: 14, w: 22, h: 26, binds: { kind: 'panel', panel: 'groups' } },
      { id: 'kitchen', label: 'The kitchen: correspondence and the bulletin column', x: 74, y: 14, w: 22, h: 26, binds: { kind: 'action', actionId: 'writing' } },
      { id: 'exit', label: 'Out to the street', x: 44, y: 82, w: 12, h: 18, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'chapel',
    label: 'The chapel',
    locations: ['chapel'],
    hotspots: [
      { id: 'tabernacle', label: 'The tabernacle: personal prayer and adoration', x: 38, y: 10, w: 24, h: 40, binds: { kind: 'action', actionId: 'prayer' } },
      { id: 'kneeler', label: 'The kneelers', x: 22, y: 72, w: 56, h: 18, binds: { kind: 'action', actionId: 'prayer' } },
      { id: 'back', label: 'Back into the church', x: 3, y: 32, w: 12, h: 46, binds: { kind: 'scene', scene: 'church' } },
    ],
  },
  {
    id: 'street',
    label: 'The street',
    locations: ['street', 'hospital', 'chancery'],
    hotspots: [
      { id: 'car', label: 'The car: home and hospital visits', x: 8, y: 66, w: 28, h: 26, binds: { kind: 'action', actionId: 'visits' } },
      { id: 'hospital', label: 'The hospital', x: 90, y: 2, w: 10, h: 58, binds: { kind: 'action', actionId: 'visits' } },
      { id: 'city_hall', label: 'City hall and the Rotary: civic presence', x: 38, y: 8, w: 26, h: 24, binds: { kind: 'action', actionId: 'civic' } },
      { id: 'church_door', label: 'The church', x: 4, y: 8, w: 26, h: 52, binds: { kind: 'scene', scene: 'church' } },
      { id: 'hall_door', label: 'The hall', x: 38, y: 34, w: 26, h: 26, binds: { kind: 'scene', scene: 'hall' } },
      { id: 'rectory_door', label: 'The rectory', x: 65, y: 14, w: 24, h: 46, binds: { kind: 'scene', scene: 'rectory' } },
    ],
  },
  {
    id: 'study',
    label: 'The study',
    locations: ['study'],
    hotspots: [
      { id: 'shelves', label: 'The shelves: study', x: 6, y: 6, w: 36, h: 62, binds: { kind: 'action', actionId: 'study' } },
      { id: 'desk', label: 'The desk: correspondence and writing', x: 50, y: 48, w: 42, h: 30, binds: { kind: 'action', actionId: 'writing' } },
      { id: 'window', label: 'The window: the week', x: 60, y: 10, w: 24, h: 30, binds: { kind: 'panel', panel: 'digest' } },
      { id: 'door', label: 'Downstairs', x: 3, y: 70, w: 12, h: 28, binds: { kind: 'scene', scene: 'rectory' } },
    ],
  },
];

export const SEMINARY_SCENE: SceneDef = {
  id: 'seminary_room',
  label: 'Your room',
  locations: [],
  hotspots: [
    { id: 'desk', label: 'The desk: your formation', x: 50, y: 50, w: 42, h: 26, binds: { kind: 'panel', panel: 'formation' } },
    { id: 'window', label: 'The window: the week', x: 60, y: 10, w: 24, h: 32, binds: { kind: 'panel', panel: 'digest' } },
    { id: 'mail', label: 'The mail on the bed: offers', x: 6, y: 48, w: 36, h: 26, binds: { kind: 'panel', panel: 'offers' } },
    { id: 'shelf', label: 'The shelf', x: 6, y: 8, w: 30, h: 32, binds: { kind: 'furnish', place: 'seminary_room' } },
  ],
};

export const CHANCERY_SCENE: SceneDef = {
  id: 'chancery',
  label: 'Your office at the chancery',
  locations: ['chancery'],
  hotspots: [
    { id: 'desk', label: 'The desk: administrative catch-up', x: 26, y: 56, w: 48, h: 26, binds: { kind: 'action', actionId: 'admin' } },
    { id: 'window', label: 'The window: the week', x: 30, y: 10, w: 46, h: 34, binds: { kind: 'panel', panel: 'digest' } },
    { id: 'files', label: 'The files: the parish', x: 84, y: 26, w: 12, h: 40, binds: { kind: 'panel', panel: 'parish' } },
    { id: 'door', label: 'Back to the parish', x: 2, y: 22, w: 10, h: 56, binds: { kind: 'scene', scene: 'office' } },
  ],
};

export function sceneById(id: SceneId): SceneDef {
  if (id === 'seminary_room') return SEMINARY_SCENE;
  if (id === 'chancery') return CHANCERY_SCENE;
  return SCENES.find((s) => s.id === id)!;
}
