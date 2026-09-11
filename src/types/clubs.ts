import type { Condition, Effect } from './events';

/**
 * A society a man can belong to: a seminary club or a priests' circle.
 * content/clubs/*.json. Requested in playtesting; numbers invented.
 */
export interface ClubDef {
  id: string;
  /** Who may belong. */
  phase: 'seminary' | 'priest';
  label: string;
  blurb: string;
  /** Free hours (seminary) or blocks (parish) a week it takes. */
  hours: number;
  /** Open to anyone who meets these; absent means open to all. */
  requires?: Condition[];
  /** By invitation only: the invitation is an offer whose accept effect joins the club. */
  inviteOnly?: boolean;
  /** Applied once on joining, and once on leaving. */
  onJoin?: Effect[];
  onLeave?: Effect[];
  /** Applied every week of membership. */
  weekly: Effect[];
  /** How many classmates (or brother priests) belong too; each warms a little every week. */
  fellows: number;
  /** Strain eased each week: the body kept in order. */
  stamina?: number;
  /** After so many weeks, something to show for it. */
  credentialAfter?: { weeks: number; credential?: string; flag?: string; line: string };
  /** What it builds, in words, for the sheet. */
  builds: string;
}

export interface ClubMembership {
  joinedWeek: number;
  weeks: number;
  /** NPC ids of fellow members. */
  fellows: string[];
  /** The credential line has been given. */
  earned?: boolean;
}

export interface ClubsState {
  memberships: Record<string, ClubMembership>;
  /** Clubs left or refused; not offered again for a while. */
  left: Record<string, number>;
}
