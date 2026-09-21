import type { Rng } from '@/engine/rng';

/**
 * The electorate as a decision-maker. E3 §3.6 and §13.5: the promotion
 * system decides by one man's score; a chapter decides by many men's
 * ballots. This engine takes each elector's private scoring of every
 * eligible man and simulates the vote round by round: absolute majority in
 * the early rounds, narrowing after, electors shifting away from a fading
 * man toward a viable one, a friend, or a compromise. Deterministic from
 * the rng: the same electorate and seed give the same ballots every time.
 *
 * What an elector thinks of a man (respect, relationship, record,
 * alignment, seniority, need, perceived ambition) is the chapter engine's
 * business (R1.2); this file only counts.
 */
export interface Elector {
  id: string;
  /** His private score for each eligible man, any scale; higher is better. */
  scores: Record<string, number>;
  /** Men he would sooner move toward when his own choice fades. */
  friends?: string[];
  /** How readily he leaves a fading man, 0..1; the rules' rate when absent. */
  fickle?: number;
}

export interface BallotRules {
  /** Rounds that need an absolute majority before the field narrows. */
  majorityRounds: number;
  /** How many men stay in a narrowed field. */
  narrowTo: number;
  /** After this many rounds the leading man is taken on a plurality. */
  maxRounds: number;
  /** The chance an elector of a fading man moves in a round. */
  shiftRate: number;
  /** A man whose tally is under this share of the leader's is fading. */
  fadingBelow: number;
  /** Noise added once to every elector's scores, so equal men do not tie forever. */
  noise: number;
}

/** Defaults; a chapter's constitutions (OrderDef.governance) may override them. Invented. */
export const BALLOT: BallotRules = {
  majorityRounds: 3,
  narrowTo: 2,
  maxRounds: 8,
  shiftRate: 0.4,
  fadingBelow: 0.5,
  noise: 3,
};

export interface BallotRound {
  round: number;
  /** Candidate id -> votes. Every man in the field appears, at zero if no one voted for him. */
  tallies: Record<string, number>;
  /** Elector id -> the man he voted for. */
  votes: Record<string, string>;
  /** The men still in it this round. */
  field: string[];
  /** Whether this round needed an absolute majority. */
  absolute: boolean;
}

export interface ElectionResult {
  rounds: BallotRound[];
  electedId: string;
  /** How it ended: a majority, a narrowed vote, or the plurality when the rounds ran out. */
  ended: 'majority' | 'narrowed' | 'plurality';
  /** Ballots cast per round: the size of the electorate. */
  electors: number;
}

function best(scores: Record<string, number>, field: readonly string[]): string {
  let top = field[0]!;
  for (const id of field) if ((scores[id] ?? -Infinity) > (scores[top] ?? -Infinity)) top = id;
  return top;
}

function tally(votes: Record<string, string>, field: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of field) out[id] = 0;
  for (const v of Object.values(votes)) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function leaders(tallies: Record<string, number>, field: readonly string[]): string[] {
  return [...field].sort((a, b) => (tallies[b] ?? 0) - (tallies[a] ?? 0) || a.localeCompare(b));
}

/**
 * Run the election. `candidates` are the eligible men; every elector may
 * also be one. Throws on an empty electorate or field.
 */
export function runElection(rng: Rng, electors: readonly Elector[], candidates: readonly string[], rules: BallotRules = BALLOT): ElectionResult {
  if (!electors.length) throw new Error('runElection: no electors');
  if (!candidates.length) throw new Error('runElection: no candidates');
  // Each elector's view, jittered once so the same seed gives the same ballots and ties break the same way.
  const views = electors.map((e) => {
    const scores: Record<string, number> = {};
    for (const id of candidates) scores[id] = (e.scores[id] ?? 0) + rng.float(-rules.noise, rules.noise);
    return { ...e, scores };
  });
  let field = [...candidates];
  const rounds: BallotRound[] = [];
  let votes: Record<string, string> = {};
  for (const v of views) votes[v.id] = best(v.scores, field);
  const majority = Math.floor(electors.length / 2) + 1;
  for (let round = 1; round <= rules.maxRounds; round++) {
    const absolute = round <= rules.majorityRounds;
    const tallies = tally(votes, field);
    rounds.push({ round, tallies, votes: { ...votes }, field: [...field], absolute });
    const ranked = leaders(tallies, field);
    const top = ranked[0]!;
    if (absolute) {
      if ((tallies[top] ?? 0) >= majority) return { rounds, electedId: top, ended: 'majority', electors: electors.length };
    } else if (field.length <= rules.narrowTo) {
      // A narrowed field: the more votes wins; an exact tie goes on to the next round unless the rounds are out.
      const second = ranked[1];
      if (!second || (tallies[top] ?? 0) > (tallies[second] ?? 0)) return { rounds, electedId: top, ended: 'narrowed', electors: electors.length };
    }
    if (round === rules.maxRounds) return { rounds, electedId: top, ended: 'plurality', electors: electors.length };
    // Narrow after the majority rounds; then every elector picks his best of who is left.
    if (round === rules.majorityRounds) {
      const cut = tallies[ranked[rules.narrowTo - 1]!] ?? 0;
      field = ranked.filter((id) => (tallies[id] ?? 0) >= cut && (tallies[id] ?? 0) > 0);
      if (field.length < 2) field = ranked.slice(0, 2);
      const next: Record<string, string> = {};
      for (const v of views) next[v.id] = best(v.scores, field);
      votes = next;
      continue;
    }
    // Some electors move: those of a fading man, and, when the vote has stalled, those of any man not alone in the lead.
    // They go to a friend still viable, else to their best among the rest: the second choice that makes a compromise candidate.
    const leaderVotes = tallies[top] ?? 0;
    const previous = rounds.at(-2);
    const stalled = !!previous && (previous.tallies[top] ?? 0) >= leaderVotes;
    const viable = ranked.filter((id) => (tallies[id] ?? 0) >= leaderVotes * rules.fadingBelow);
    const aloneInLead = ranked.length < 2 || leaderVotes > (tallies[ranked[1]!] ?? 0);
    const next: Record<string, string> = { ...votes };
    for (const v of views) {
      const mine = votes[v.id]!;
      if (mine === v.id) continue;
      const fading = !viable.includes(mine);
      const deadlocked = stalled && !(mine === top && aloneInLead);
      if (!fading && !deadlocked) continue;
      const rate = (v.fickle ?? rules.shiftRate) * (fading ? 1 : 0.6);
      if (!rng.chance(rate)) continue;
      const friend = (v.friends ?? []).find((f) => viable.includes(f) && f !== v.id && f !== mine);
      const pool = (fading ? viable : field).filter((id) => id !== v.id && id !== mine);
      if (friend) next[v.id] = friend;
      else if (pool.length) next[v.id] = best(v.scores, pool);
    }
    votes = next;
  }
  const last = rounds.at(-1)!;
  return { rounds, electedId: leaders(last.tallies, last.field)[0]!, ended: 'plurality', electors: electors.length };
}

/** The share of the electorate a man holds in a round. */
export function shareOf(round: BallotRound, id: string): number {
  const cast = Object.keys(round.votes).length;
  return cast ? (round.tallies[id] ?? 0) / cast : 0;
}
