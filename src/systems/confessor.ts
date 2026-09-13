import type { GameState } from '@/types';
import { planWeek } from './week';

/**
 * Hours in the box build a name. Requested in playtesting: a weekly
 * commitment that changes the world. Numbers invented.
 */
export const CONFESSOR = {
  /** Per block of extra confessions a week. */
  perAp: 1.6,
  /** For the scheduled confessions at each quality. */
  quality: { min: -0.4, standard: 0.3, invested: 0.9 } as Record<string, number>,
  /** Lost each week, so the name is kept up or lost. */
  decay: 0.45,
  /** Known in the deanery; sought from across the diocese. */
  known: 30,
  sought: 60,
  /** Pull on the pews at full name: penitents come back on Sunday. */
  pull: 0.05,
  /** What the brother priests think of a man their people drive to, per week at full name. */
  brotherPerWeek: -0.04,
} as const;

export function confessorOf(state: GameState): number {
  return state.character?.confessor ?? 0;
}

export function confessorWord(n: number): string {
  return n >= CONFESSOR.sought ? 'a confessor people drive to' : n >= CONFESSOR.known ? 'known in the deanery as a confessor' : n >= 10 ? 'a light on in the box' : 'no name as a confessor yet';
}

/** Pull on attendance from the name: penitents who come back on Sunday. */
export function confessorPull(state: GameState): number {
  return CONFESSOR.pull * (confessorOf(state) / 100);
}

/** One parish week in the box: the name rises with the hours and falls without them; the thresholds are said once. */
export function confessorWeek(state: GameState): { state: GameState; line: string | null } {
  const c = state.character;
  if (!c || !state.parish || state.away) return { state, line: null };
  const plan = planWeek(state);
  const extra = plan.discretionary.extra_confessions ?? 0;
  const quality = plan.obligations.confessions;
  const before = c.confessor ?? 0;
  const after = Math.max(0, Math.min(100, before + extra * CONFESSOR.perAp + (CONFESSOR.quality[quality] ?? 0) - CONFESSOR.decay));
  let next: GameState = { ...state, character: { ...c, confessor: after } };
  const flags = { ...next.flags };
  let line: string | null = null;
  if (after >= CONFESSOR.known && !flags['confessor:known']) {
    flags['confessor:known'] = true;
    line = 'A woman from two parishes over was in your line on Saturday. She said someone at the deanery had told her about you.';
  } else if (after < CONFESSOR.known - 5 && flags['confessor:known']) {
    delete flags['confessor:known'];
    line = 'The Saturday line is the parish again, and short. The name fades when the light is off.';
  }
  if (after >= CONFESSOR.sought && !flags['confessor:sought']) {
    flags['confessor:sought'] = true;
    line = 'Cars with plates from across the diocese on Saturday afternoon, and a man who drove an hour and said so. You are the confessor people drive to now.';
  } else if (after < CONFESSOR.sought - 5 && flags['confessor:sought']) {
    delete flags['confessor:sought'];
  }
  next = { ...next, flags };
  if (after >= CONFESSOR.sought) {
    const r = next.character!.reputation;
    next = { ...next, character: { ...next.character!, reputation: { ...r, brother_priests: Math.max(-100, r.brother_priests + CONFESSOR.brotherPerWeek) } }, movers: [...(next.movers ?? []), { week: next.clock.week, key: 'brother_priests', delta: CONFESSOR.brotherPerWeek, why: 'their people drive to your box' }] };
  }
  return { state: next, line };
}
