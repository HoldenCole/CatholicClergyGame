import type { Role } from './world';

/** What is being filled. DESIGN 7.1: every appointment is a decision about a specific opening. */
export type OpeningKind = 'pastor' | 'administrator' | 'parochial_vicar' | 'chancery';

export interface Opening {
  id: string;
  kind: OpeningKind;
  parishId: string | null;
  /** How badly the diocese needs this filled now, 0..100. */
  urgency: number;
  /** What the opening wants. */
  needsSpanish: boolean;
  needsAdmin: boolean;
  /** Alignment of the parish or post, if it matters. */
  alignment: number | null;
  /** Calendar week the opening appeared. */
  week: number;
  label: string;
  /** A priest of the deanery said to want it, if one is. */
  deaneryRivalId?: string;
  /** The player has put his name forward for it. */
  applied?: boolean;
}

/** A candidate as the personnel board sees him. Built from the player or from an NPC priest. */
export interface Candidate {
  id: string;
  isPlayer: boolean;
  name: string;
  stats: { administration: number; charisma: number; theology: number; knowledge: number; piety: number };
  credentials: string[];
  yearsOrdained: number;
  ordinationAge: number;
  age: number;
  alignment: number;
  outspokenness: number;
  chancery: number;
  bishopRelationship: number;
  /** Chancery officials who vouch (classmates, mentors). */
  vouchers: number;
  /** Track record at the current post: lay support. */
  results: number;
  speaksSpanish: boolean;
  /** Affiliation alignment (−1 traditional, 0 none, +1 progressive). */
  affiliation: number;
  /** Too useful where he is: the chancery would rather not move him. */
  indispensable: boolean;
  currentRole: Role | null;
}

export interface ScoreBreakdown {
  need: number;
  readiness: number;
  trust: number;
  fit: number;
  fitEffective: number;
  maturity: number;
  noise: number;
  total: number;
  reasons: string[];
}

export interface Decision {
  opening: Opening;
  winner: Candidate;
  ranked: { candidate: Candidate; score: ScoreBreakdown }[];
  /** Why, in the player's hindsight. */
  reasons: string[];
}
