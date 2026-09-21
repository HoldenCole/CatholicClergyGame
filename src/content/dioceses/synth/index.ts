import raw from './pool.json';
import type { DiocesePreset, DioceseSize } from '@/types';

/** A real see city the generator can build a diocese around. Everything but the name and the place rolls. */
export interface SynthSee {
  id: string;
  name: string;
  see: string;
  state: string;
  region: string;
  lat: number;
  lon: number;
  size: DioceseSize;
  latinoShare: number;
  growth: DiocesePreset['growth'];
  climate: 'cold' | 'temperate' | 'hot' | 'desert' | 'mild';
}

export interface SynthPool {
  sees: SynthSee[];
  heritage: Record<string, Record<string, number>>;
  neighborhoods: string[];
  townPrefixes: string[];
  townSuffixes: string[];
  character: DiocesePreset['character'];
  complications: string[];
  hiddenComplications: string[];
  voice: Record<SynthSee['climate'], NonNullable<DiocesePreset['voice']>>;
  seminaries: string[];
}

export const synthPool: SynthPool = raw as unknown as SynthPool;

export function synthSeeById(id: string): SynthSee | undefined {
  return synthPool.sees.find((s) => s.id === id);
}
