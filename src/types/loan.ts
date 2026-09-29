import type { Role } from './world';

/**
 * E2 R1.3 — a priest lent across diocesan lines (docs/EXPANSION-E2-PROVINCE.md §2.4).
 * A loan swaps the world as a friar's move does: the man lives the parish
 * loop in the borrowing diocese, under its bishop, and comes home, stays,
 * or asks to be let go.
 */
export type LoanKind = 'spanish' | 'canonist' | 'pastor';

export interface LoanState {
  /** The borrowing diocese's world id (its see's pool id), and its see of the province. */
  dioceseId: string;
  seeId: string;
  /** Home's world id. */
  homeId: string;
  kind: LoanKind;
  startWeek: number;
  endWeek: number;
  years: number;
  extended?: boolean;
  /** Home's standings the week he left, read back on his return. */
  homeFile: { chancery: number; brother_priests: number; bishopId: string; leftWeek: number };
  /** The rank he left home with; a pastor comes home a pastor. */
  leftAs: Role;
  /** Rolled at the term's end: the borrowing bishop would keep him. */
  wanted?: boolean;
  /** The scene waiting for him (the term's end), and its week. */
  scene?: { kind: 'end'; dueWeek: number };
  /** How it ended. */
  decided?: 'home' | 'stayed' | 'extended';
}

/** A man a see borrowed from a brother bishop, or lent to one. */
export interface SeeLoan {
  npcId: string;
  name: string;
  /** The other see's city. */
  see: string;
  sinceWeek: number;
  untilWeek: number;
}
