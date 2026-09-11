import type { ActionLocation, ObligationKey } from '@/types';

/**
 * Scene definitions for the graphics layer. Every hotspot binds to data the
 * systems already own: a discretionary action (by location), an obligation
 * dial, a panel, or another scene. Coordinates are percentages of the scene.
 */
export type SceneId = 'church' | 'rectory' | 'office' | 'hall' | 'chapel' | 'street' | 'study' | 'seminary_room' | 'seminary_hall' | 'chancery' | 'study_room' | 'study_city';

export type HotspotBinding =
  | { kind: 'action'; actionId: string }
  /** A seminarian's free-hour activity, by id in content/seminary/activities.json. */
  | { kind: 'seminary_action'; activityId: string }
  /** A priest-student's free hour, by id in content/study/activities.json. */
  | { kind: 'study_action'; activityId: string }
  | { kind: 'obligation'; key: ObligationKey }
  | { kind: 'panel'; panel: 'routine' | 'groups' | 'projects' | 'offers' | 'digest' | 'parish' | 'formation' | 'clubs' }
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
    { id: 'desk', label: 'The desk: writing', x: 50, y: 50, w: 42, h: 26, binds: { kind: 'seminary_action', activityId: 'writing' } },
    { id: 'crucifix', label: 'The crucifix: a holy hour in the chapel', x: 44, y: 10, w: 12, h: 30, binds: { kind: 'seminary_action', activityId: 'holy_hour' } },
    { id: 'window', label: 'The window: the week', x: 60, y: 10, w: 24, h: 32, binds: { kind: 'panel', panel: 'digest' } },
    { id: 'mail', label: 'The mail on the bed: letters', x: 6, y: 48, w: 36, h: 26, binds: { kind: 'panel', panel: 'offers' } },
    { id: 'shelf', label: 'The shelf: study, and how the room looks', x: 6, y: 8, w: 30, h: 32, binds: { kind: 'seminary_action', activityId: 'study' } },
    { id: 'frame', label: 'The frame: how the room looks', x: 39, y: 18, w: 8, h: 10, binds: { kind: 'furnish', place: 'seminary_room' } },
    { id: 'door', label: 'The door: the corridor', x: 88, y: 48, w: 10, h: 30, binds: { kind: 'scene', scene: 'seminary_hall' } },
  ],
};

export const SEMINARY_HALL: SceneDef = {
  id: 'seminary_hall',
  label: 'The corridor',
  locations: [],
  hotspots: [
    { id: 'chapel', label: 'The chapel: a holy hour', x: 34, y: 14, w: 32, h: 52, binds: { kind: 'seminary_action', activityId: 'holy_hour' } },
    { id: 'library', label: 'The library: study', x: 3, y: 18, w: 11, h: 44, binds: { kind: 'seminary_action', activityId: 'study' } },
    { id: 'director', label: "The spiritual director's door", x: 15, y: 20, w: 8, h: 38, binds: { kind: 'seminary_action', activityId: 'direction' } },
    { id: 'rector', label: "The rector's office: the sacristan's job", x: 77, y: 20, w: 8, h: 38, binds: { kind: 'seminary_action', activityId: 'sacristan' } },
    { id: 'common', label: 'The common room: the clubs', x: 86, y: 18, w: 11, h: 44, binds: { kind: 'panel', panel: 'clubs' } },
    { id: 'gym', label: 'The gym: basketball at four', x: 4, y: 66, w: 22, h: 26, binds: { kind: 'seminary_action', activityId: 'sports' } },
    { id: 'language', label: 'The language lab: Spanish', x: 74, y: 66, w: 22, h: 26, binds: { kind: 'seminary_action', activityId: 'spanish' } },
    { id: 'out', label: 'The front door: a parish weekend', x: 40, y: 70, w: 20, h: 26, binds: { kind: 'seminary_action', activityId: 'parish_weekend' } },
    { id: 'back', label: 'Back to your room', x: 26, y: 22, w: 7, h: 36, binds: { kind: 'scene', scene: 'seminary_room' } },
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

/** The room at the college: a desk, a bed, a window on the city. */
export const STUDY_ROOM: SceneDef = {
  id: 'study_room',
  label: 'Your room at the college',
  locations: [],
  hotspots: [
    { id: 'desk', label: 'The desk: the thesis', x: 48, y: 44, w: 44, h: 26, binds: { kind: 'study_action', activityId: 'thesis' } },
    { id: 'crucifix', label: 'The crucifix: the chapel', x: 44, y: 8, w: 12, h: 26, binds: { kind: 'study_action', activityId: 'holy_hour' } },
    { id: 'window', label: 'The window: the city', x: 60, y: 6, w: 24, h: 28, binds: { kind: 'scene', scene: 'study_city' } },
    { id: 'shelf', label: 'The shelf: the language', x: 6, y: 8, w: 30, h: 26, binds: { kind: 'study_action', activityId: 'italian' } },
    { id: 'bed', label: 'The bed: the week', x: 4, y: 46, w: 38, h: 22, binds: { kind: 'panel', panel: 'routine' } },
    { id: 'door', label: 'The door: the city', x: 88, y: 46, w: 10, h: 30, binds: { kind: 'scene', scene: 'study_city' } },
  ],
};

/** The city: the university, the hospital, a parish, the basilica, the office, the table. */
export const STUDY_CITY: SceneDef = {
  id: 'study_city',
  label: 'The city',
  locations: [],
  hotspots: [
    { id: 'university', label: 'The university: lectures and the thesis', x: 2, y: 14, w: 22, h: 48, binds: { kind: 'study_action', activityId: 'thesis' } },
    { id: 'basilica', label: 'The basilica: confessions', x: 36, y: 4, w: 28, h: 50, binds: { kind: 'study_action', activityId: 'confessions' } },
    { id: 'hospital', label: 'The hospital: chaplaincy', x: 70, y: 18, w: 16, h: 40, binds: { kind: 'study_action', activityId: 'hospital' } },
    { id: 'parish', label: 'A parish: Sunday supply', x: 86, y: 22, w: 12, h: 36, binds: { kind: 'study_action', activityId: 'parish_supply' } },
    { id: 'curia', label: 'The offices: work at the Holy See', x: 24, y: 24, w: 12, h: 30, binds: { kind: 'study_action', activityId: 'curia' } },
    { id: 'college', label: 'The college office', x: 64, y: 26, w: 7, h: 28, binds: { kind: 'study_action', activityId: 'college_office' } },
    { id: 'table', label: 'The trattoria: the Roman table', x: 62, y: 62, w: 20, h: 22, binds: { kind: 'study_action', activityId: 'table' } },
    { id: 'pilgrims', label: 'The piazza: pilgrims from home', x: 30, y: 62, w: 26, h: 22, binds: { kind: 'study_action', activityId: 'pilgrims' } },
    { id: 'field', label: 'The pitch: calcio', x: 4, y: 66, w: 20, h: 20, binds: { kind: 'study_action', activityId: 'calcio' } },
    { id: 'back', label: 'Back to your room', x: 86, y: 64, w: 12, h: 22, binds: { kind: 'scene', scene: 'study_room' } },
  ],
};

/** The Washington version binds the same spots to the city's own work. */
export const STUDY_CITY_DC: SceneDef = {
  ...STUDY_CITY,
  hotspots: STUDY_CITY.hotspots.map((h) =>
    h.id === 'basilica' ? { ...h, label: 'The Shrine: confessions', binds: { kind: 'study_action', activityId: 'shrine_confessions' } }
    : h.id === 'curia' ? { ...h, label: 'The tribunal', binds: { kind: 'study_action', activityId: 'tribunal' } }
    : h.id === 'pilgrims' ? { ...h, label: 'Fourth Street: the bishops\' conference', binds: { kind: 'study_action', activityId: 'conference' } }
    : h.id === 'table' ? { ...h, label: 'Dinner: the table' }
    : h,
  ),
};

/** The bishop's residence: the same room, and the house instead of a city. */
export const STUDY_ROOM_RESIDENCE: SceneDef = {
  ...STUDY_ROOM,
  label: 'Your room at the residence',
  hotspots: STUDY_ROOM.hotspots.map((h) =>
    h.id === 'desk' ? { ...h, label: "The desk: the bishop's calendar", binds: { kind: 'study_action', activityId: 'calendar' } }
    : h.id === 'crucifix' ? { ...h, label: 'The crucifix: the residence chapel', binds: { kind: 'study_action', activityId: 'residence_chapel' } }
    : h.id === 'shelf' ? { ...h, label: 'The shelf: the rubrics', binds: { kind: 'study_action', activityId: 'mc' } }
    : h.id === 'window' ? { ...h, label: 'The window: the house' }
    : h.id === 'door' ? { ...h, label: 'The door: the house' }
    : h,
  ),
};

export const STUDY_HOUSE: SceneDef = {
  id: 'study_city',
  label: "The bishop's house",
  locations: [],
  hotspots: [
    { id: 'desk', label: "The desk: the bishop's calendar", x: 26, y: 56, w: 48, h: 26, binds: { kind: 'study_action', activityId: 'calendar' } },
    { id: 'window', label: 'The window: the car and the door', x: 30, y: 10, w: 46, h: 34, binds: { kind: 'study_action', activityId: 'driving' } },
    { id: 'files', label: 'The files: the phone', x: 84, y: 26, w: 12, h: 40, binds: { kind: 'study_action', activityId: 'phone' } },
    { id: 'door', label: 'The door: weekend supply', x: 2, y: 22, w: 10, h: 56, binds: { kind: 'study_action', activityId: 'weekend_supply' } },
    { id: 'mc', label: 'The vestment case: master of ceremonies', x: 76, y: 66, w: 22, h: 20, binds: { kind: 'study_action', activityId: 'mc' } },
    { id: 'chapel', label: 'The residence chapel', x: 2, y: 80, w: 22, h: 16, binds: { kind: 'study_action', activityId: 'residence_chapel' } },
    { id: 'back', label: 'Back to your room', x: 30, y: 86, w: 40, h: 12, binds: { kind: 'scene', scene: 'study_room' } },
  ],
};

/** A posting's place: the same six spots, bound to that post's work. */
function postScene(label: string, room: string, ids: [string, string, string, string, string, string]): SceneDef {
  return {
    id: 'study_city',
    label,
    locations: [],
    hotspots: [
      { id: 'a', label: ids[0], x: 26, y: 56, w: 48, h: 26, binds: { kind: 'study_action', activityId: ids[0] } },
      { id: 'b', label: ids[1], x: 30, y: 10, w: 46, h: 34, binds: { kind: 'study_action', activityId: ids[1] } },
      { id: 'c', label: ids[2], x: 84, y: 26, w: 12, h: 40, binds: { kind: 'study_action', activityId: ids[2] } },
      { id: 'd', label: ids[3], x: 2, y: 22, w: 10, h: 56, binds: { kind: 'study_action', activityId: ids[3] } },
      { id: 'e', label: ids[4], x: 76, y: 66, w: 22, h: 20, binds: { kind: 'study_action', activityId: ids[4] } },
      { id: 'back', label: room, x: 30, y: 86, w: 40, h: 12, binds: { kind: 'scene', scene: 'study_room' } },
    ],
  };
}
export const STUDY_CAMPUS = postScene('The Newman Center', 'Back to your rooms', ['campus_door', 'campus_mass', 'campus_series', 'campus_parish', 'campus_faculty', 'campus_door']);
export const STUDY_HOSPITAL = postScene('The hospital', 'Back to your quarters', ['wards', 'hospital_chapel', 'ethics_committee', 'hospital_supply', 'night_pager', 'wards']);
export const STUDY_SEMINARY = postScene('The seminary', 'Back to your rooms', ['lectures', 'seminary_direction', 'formation_reports', 'seminary_supply', 'seminary_writing', 'lectures']);

export function sceneById(id: SceneId, city: 'rome' | 'washington' | 'residence' | 'campus' | 'hospital' | 'seminary' = 'rome'): SceneDef {
  if (id === 'study_room') return city === 'rome' || city === 'washington' ? STUDY_ROOM : { ...STUDY_ROOM_RESIDENCE, label: city === 'residence' ? STUDY_ROOM_RESIDENCE.label : 'Your rooms', hotspots: STUDY_ROOM_RESIDENCE.hotspots.map((h) => (h.binds.kind === 'study_action' ? { ...h, binds: { kind: 'panel', panel: 'routine' } as const, label: 'The desk: the week' } : h)) };
  if (id === 'study_city') return city === 'residence' ? STUDY_HOUSE : city === 'campus' ? STUDY_CAMPUS : city === 'hospital' ? STUDY_HOSPITAL : city === 'seminary' ? STUDY_SEMINARY : city === 'washington' ? STUDY_CITY_DC : STUDY_CITY;
  if (id === 'seminary_room') return SEMINARY_SCENE;
  if (id === 'seminary_hall') return SEMINARY_HALL;
  if (id === 'chancery') return CHANCERY_SCENE;
  return SCENES.find((s) => s.id === id)!;
}
