import type { GameState, Tenure } from '@/types';
import { sinceArrival } from './trajectory';
import { studyProgram } from '@/content/study';
import { placeVerdict } from './studyWeek';

const ROLE_LABEL: Record<string, string> = { parochial_vicar: 'Parochial vicar', administrator: 'Administrator', pastor: 'Pastor' };

/** The post he holds now, as a tenure not yet closed; null between posts. */
export function openTenure(state: GameState): Tenure | null {
  if (state.parish && state.assignment && state.world) {
    const rec = state.world.parishes.find((p) => p.id === state.assignment!.parishId);
    const traj = sinceArrival(state);
    return {
      kind: 'parish',
      label: ROLE_LABEL[state.assignment.role] ?? state.assignment.role,
      place: rec ? `${rec.name}, ${rec.place}` : 'a parish',
      role: state.assignment.role,
      parishId: state.assignment.parishId,
      startWeek: state.assignment.startWeek,
      endWeek: state.clock.week,
      ...(traj ? { verdict: traj.verdict, rows: traj.rows } : {}),
    };
  }
  if (state.study) {
    const program = studyProgram(state.study.program);
    return {
      kind: 'away',
      label: state.see ? `Bishop of ${state.see.see}` : state.study.label,
      place: state.see ? `${state.see.name}, ${state.see.region}` : program?.kind === 'post' ? state.study.residence : state.study.school,
      startWeek: state.study.startWeek,
      endWeek: state.clock.week,
      ...(placeVerdict(state) ? { verdict: placeVerdict(state)! } : {}),
    };
  }
  return null;
}

/** Close the post he holds and write it to the record. Call before the state that ends it is built. */
export function closeTenure(state: GameState, left: string): GameState {
  const open = openTenure(state);
  if (!open) return state;
  return { ...state, tenures: [...(state.tenures ?? []), { ...open, left }] };
}

/** Every post, the open one included, for the sheets and the ending. */
export function allTenures(state: GameState): Tenure[] {
  const closed = state.tenures ?? [];
  const open = openTenure(state);
  const last = closed[closed.length - 1];
  const already = !!open && !!last && last.startWeek === open.startWeek && last.place === open.place;
  return [...closed, ...(open && !already ? [{ ...open, left: 'still there' }] : [])];
}
