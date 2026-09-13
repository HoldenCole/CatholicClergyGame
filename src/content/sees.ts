import type { SeeDef } from '@/types';
import sees from './sees.json';
import { diocesePresets } from './dioceses';

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

export function seeDef(id: string): SeeDef | undefined {
  return seeDefs.find((s) => s.id === id);
}
