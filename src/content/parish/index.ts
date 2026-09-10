import type { ActionDef, ObligationDef, SeasonalLoad } from '@/types';
import obligations from './obligations.json';
import actions from './actions.json';

export const obligationDefs = obligations as ObligationDef[];
export const actionDefs = actions as ActionDef[];

export function actionById(id: string): ActionDef | undefined {
  return actionDefs.find((a) => a.id === id);
}

/** DESIGN.md §2.5: extra mandatory AP by season. Invented values. */
export const SEASONAL_LOAD: SeasonalLoad = {
  advent: 1,
  christmas: 2,
  ordinary: 0,
  lent: 1,
  holy_week: 3,
  easter: 1,
};
