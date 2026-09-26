import type { GameState } from '@/types';
import { sceneTerna, seeCity } from './nuncio';
import { viewLine } from './nuncioView';

/** {nuncio_view}, {see}, {see_city}, {named}: the words a nuncio's scene needs. E1 R1.3. */
export function nuncioTokens(state: GameState): Record<string, string> {
  if (!state.rome?.nuncio) return {};
  const t = sceneTerna(state);
  return {
    nuncio_view: viewLine(state),
    ...(t ? { see: t.seeName, see_city: seeCity(t.seeId), named: t.winnerName ?? 'the man Rome chose' } : {}),
  };
}
