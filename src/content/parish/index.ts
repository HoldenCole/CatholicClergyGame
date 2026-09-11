import type { ActionDef, GroupTypeDef, ObligationDef, ProblemFixDef, SacrificeDef, SeasonalLoad } from '@/types';
import obligations from './obligations.json';
import actions from './actions.json';
import groups from './groups.json';
import sacrifices from './sacrifices.json';
import problems from './problems.json';

export const obligationDefs = obligations as ObligationDef[];
export const actionDefs = actions as ActionDef[];
export const groupTypeDefs = groups as GroupTypeDef[];
export const sacrificeDefs = sacrifices as SacrificeDef[];
export const problemFixes = (problems as { fixes: ProblemFixDef[] }).fixes;

export function problemFix(problem: string): ProblemFixDef | undefined {
  return problemFixes.find((f) => f.problem === problem);
}

export function groupTypeDef(type: GroupTypeDef['type']): GroupTypeDef {
  return groupTypeDefs.find((g) => g.type === type)!;
}

export function actionById(id: string): ActionDef | undefined {
  return actionDefs.find((a) => a.id === id);
}

/** DESIGN.md §2.5: extra mandatory AP by season. Invented values. */
export const SEASONAL_LOAD: SeasonalLoad = {
  advent: 1,
  christmas: 3,
  ordinary: 0,
  lent: 1,
  holy_week: 6,
  easter: 2,
};
