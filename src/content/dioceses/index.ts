import type { DiocesePreset } from '@/types';

const modules = import.meta.glob<{ default: DiocesePreset }>('./*.json', { eager: true });

/** The presets, in a fixed order so the preview is stable. */
export const diocesePresets: DiocesePreset[] = ['new_york', 'chicago', 'los_angeles', 'houston', 'washington', 'philadelphia', 'boston', 'san_francisco', 'miami', 'new_orleans']
  .map((id) => Object.values(modules).find((m) => m.default.id === id)?.default)
  .filter((p): p is DiocesePreset => !!p);

export function presetById(id: string): DiocesePreset | undefined {
  return diocesePresets.find((p) => p.id === id);
}

/** The land under each diocese: coast, water, rivers, highways, counties, towns, clipped from Natural Earth (public domain) and projected to map units. */
export interface DioceseMapData {
  water: [number, number][][][];
  lakes: { name: string; rings: [number, number][][] }[];
  rivers: { name: string; line: [number, number][] }[];
  roads: { kind: 'major' | 'minor'; name: string; line: [number, number][] }[];
  urban: [number, number][][];
  counties: [number, number][][];
  states: [number, number][][];
  towns: { name: string; x: number; y: number; rank: number }[];
  /** The diocese itself, from its counties: outer ring first, then holes. */
  diocese: [number, number][][][];
}

const maps = import.meta.glob<{ default: DioceseMapData }>('./maps/*.json', { eager: true });

export function mapDataById(id: string): DioceseMapData | undefined {
  return maps[`./maps/${id}.json`]?.default;
}
