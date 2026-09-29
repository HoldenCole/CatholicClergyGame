import type { SeeDef } from '@/types';
import sees from './sees.json';
import { diocesePresets } from './dioceses';
import { synthSeeById } from './dioceses/synth';

/** The small sees a man is first named to. */
export const smallSees = (sees as { sees: SeeDef[] }).sees;

/** The ten dioceses of the game as sees: the great ones a bishop may be translated to, or, rarely, named to first. */
export const presetSees: SeeDef[] = diocesePresets.map((p) => ({
  id: p.id,
  name: p.name,
  see: p.see,
  region: p.region,
  character: p.character.base[0] ?? '',
  priests: Math.round(p.parishSeeds.length * 1.4),
  parishes: p.parishSeeds.length,
  leans: {
    shortage: Math.max(-1, Math.min(1, (p.shortageBias - 3) / 2)),
    money: Math.max(-1, Math.min(1, (p.financialWeights.healthy - p.financialWeights.crisis) / 3)),
    rome: Math.max(-1, Math.min(1, (p.romeConnection - 3) / 4)),
    people: 0,
    presbyterate: 0,
  },
  great: true,
}));

export const seeDefs: SeeDef[] = [...smallSees, ...presetSees];

/** A see of the synth pool as a see def, so a vacancy in the province can be a man's first see. E2 §2.1. */
export function poolSeeDef(id: string): SeeDef | undefined {
  const s = synthSeeById(id);
  if (!s) return undefined;
  const parishes = { small: 14, medium: 20, large: 28, huge: 36 }[s.size];
  return { id: s.id, name: s.name, see: s.see, region: s.region, character: '', priests: Math.round(parishes * 1.4), parishes, leans: { shortage: s.growth === 'shrinking' ? 1 : 0 }, synth: { state: s.state, region: s.region, lat: s.lat, lon: s.lon, size: s.size, latinoShare: s.latinoShare, growth: s.growth, climate: s.climate } };
}

export function seeDef(id: string): SeeDef | undefined {
  return seeDefs.find((s) => s.id === id) ?? poolSeeDef(id);
}
