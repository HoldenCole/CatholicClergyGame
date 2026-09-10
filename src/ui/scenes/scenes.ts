import type { ActionLocation, ObligationKey } from '@/types';

/**
 * Scene definitions for the graphics layer. Every hotspot binds to data the
 * systems already own: a discretionary action (by location), an obligation
 * dial, a panel, or another scene. Coordinates are percentages of the scene.
 */
export type SceneId = 'church' | 'rectory' | 'office' | 'hall' | 'chapel' | 'street' | 'study';

export type HotspotBinding =
  | { kind: 'action'; actionId: string }
  | { kind: 'obligation'; key: ObligationKey }
  | { kind: 'panel'; panel: 'routine' | 'groups' | 'projects' | 'offers' | 'digest' | 'parish' }
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
      { id: 'altar', label: 'The altar: Sunday Masses and the homily', x: 40, y: 22, w: 20, h: 22, binds: { kind: 'obligation', key: 'sunday_masses' } },
      { id: 'side_altar', label: 'The side altar: weekday Masses', x: 8, y: 34, w: 14, h: 18, binds: { kind: 'obligation', key: 'weekday_masses' } },
      { id: 'confessional', label: 'The confessional', x: 78, y: 40, w: 14, h: 30, binds: { kind: 'action', actionId: 'extra_confessions' } },
      { id: 'confessions_hours', label: 'The posted confession hours', x: 78, y: 28, w: 14, h: 8, binds: { kind: 'obligation', key: 'confessions' } },
      { id: 'baptistery', label: 'The baptistery: sacramental preparation', x: 8, y: 60, w: 16, h: 18, binds: { kind: 'obligation', key: 'sacramental_prep' } },
      { id: 'sacristy', label: 'The sacristy door', x: 62, y: 30, w: 10, h: 24, binds: { kind: 'scene', scene: 'chapel' } },
      { id: 'doors', label: 'The doors: out to the street', x: 44, y: 78, w: 12, h: 18, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'rectory',
    label: 'The rectory',
    locations: ['rectory'],
    hotspots: [
      { id: 'table', label: 'The dinner table: time with brother priests', x: 30, y: 52, w: 40, h: 22, binds: { kind: 'action', actionId: 'brother_priests' } },
      { id: 'phone', label: 'The phone: the digest', x: 6, y: 30, w: 10, h: 14, binds: { kind: 'panel', panel: 'digest' } },
      { id: 'office_door', label: 'The office', x: 78, y: 24, w: 12, h: 40, binds: { kind: 'scene', scene: 'office' } },
      { id: 'study_door', label: 'The study, upstairs', x: 58, y: 8, w: 18, h: 16, binds: { kind: 'scene', scene: 'study' } },
      { id: 'mail', label: 'The mail on the sideboard: offers', x: 8, y: 60, w: 14, h: 12, binds: { kind: 'panel', panel: 'offers' } },
      { id: 'front_door', label: 'The front door', x: 40, y: 80, w: 12, h: 16, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'office',
    label: 'The parish office',
    locations: ['office'],
    hotspots: [
      { id: 'desk', label: 'The desk: administrative catch-up', x: 28, y: 46, w: 44, h: 26, binds: { kind: 'action', actionId: 'admin' } },
      { id: 'calendar', label: 'The wall calendar: staff and parish meetings', x: 6, y: 14, w: 16, h: 22, binds: { kind: 'obligation', key: 'meetings' } },
      { id: 'ledger', label: 'The ledger: the parish', x: 76, y: 20, w: 16, h: 20, binds: { kind: 'panel', panel: 'parish' } },
      { id: 'routine', label: 'The week on the whiteboard: the standing routine', x: 30, y: 8, w: 40, h: 26, binds: { kind: 'panel', panel: 'routine' } },
      { id: 'plans', label: 'The plans on the side table: projects', x: 76, y: 50, w: 18, h: 26, binds: { kind: 'panel', panel: 'projects' } },
      { id: 'door', label: 'Back to the rectory', x: 4, y: 60, w: 12, h: 32, binds: { kind: 'scene', scene: 'rectory' } },
    ],
  },
  {
    id: 'hall',
    label: 'The parish hall',
    locations: ['hall', 'school'],
    hotspots: [
      { id: 'tables', label: 'The tables: the groups', x: 20, y: 42, w: 60, h: 30, binds: { kind: 'action', actionId: 'groups' } },
      { id: 'board', label: 'The bulletin board: the groups and their leaders', x: 6, y: 12, w: 22, h: 26, binds: { kind: 'panel', panel: 'groups' } },
      { id: 'kitchen', label: 'The kitchen: correspondence and the bulletin column', x: 74, y: 10, w: 20, h: 26, binds: { kind: 'action', actionId: 'writing' } },
      { id: 'exit', label: 'Out to the street', x: 44, y: 80, w: 12, h: 16, binds: { kind: 'scene', scene: 'street' } },
    ],
  },
  {
    id: 'chapel',
    label: 'The chapel',
    locations: ['chapel'],
    hotspots: [
      { id: 'tabernacle', label: 'The tabernacle: personal prayer and adoration', x: 38, y: 16, w: 24, h: 30, binds: { kind: 'action', actionId: 'prayer' } },
      { id: 'kneeler', label: 'The kneeler', x: 36, y: 60, w: 28, h: 16, binds: { kind: 'action', actionId: 'prayer' } },
      { id: 'back', label: 'Back into the church', x: 4, y: 40, w: 12, h: 40, binds: { kind: 'scene', scene: 'church' } },
    ],
  },
  {
    id: 'street',
    label: 'The street',
    locations: ['street', 'hospital', 'chancery'],
    hotspots: [
      { id: 'car', label: 'The car: home and hospital visits', x: 10, y: 60, w: 26, h: 22, binds: { kind: 'action', actionId: 'visits' } },
      { id: 'hospital', label: 'The hospital', x: 68, y: 14, w: 26, h: 34, binds: { kind: 'action', actionId: 'visits' } },
      { id: 'city_hall', label: 'City hall and the Rotary: civic presence', x: 38, y: 18, w: 26, h: 30, binds: { kind: 'action', actionId: 'civic' } },
      { id: 'church_door', label: 'The church', x: 4, y: 12, w: 24, h: 40, binds: { kind: 'scene', scene: 'church' } },
      { id: 'hall_door', label: 'The hall', x: 40, y: 60, w: 20, h: 22, binds: { kind: 'scene', scene: 'hall' } },
      { id: 'rectory_door', label: 'The rectory', x: 70, y: 58, w: 24, h: 26, binds: { kind: 'scene', scene: 'rectory' } },
    ],
  },
  {
    id: 'study',
    label: 'The study',
    locations: ['study'],
    hotspots: [
      { id: 'shelves', label: 'The shelves: study', x: 6, y: 8, w: 40, h: 60, binds: { kind: 'action', actionId: 'study' } },
      { id: 'desk', label: 'The desk: correspondence and writing', x: 52, y: 44, w: 40, h: 28, binds: { kind: 'action', actionId: 'writing' } },
      { id: 'window', label: 'The window: the week', x: 60, y: 8, w: 26, h: 28, binds: { kind: 'panel', panel: 'digest' } },
      { id: 'door', label: 'Downstairs', x: 4, y: 72, w: 14, h: 24, binds: { kind: 'scene', scene: 'rectory' } },
    ],
  },
];

export function sceneById(id: SceneId): SceneDef {
  return SCENES.find((s) => s.id === id)!;
}
