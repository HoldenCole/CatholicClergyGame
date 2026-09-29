/**
 * E2 R1.2 — the national conference of bishops (docs/EXPANSION-E2-PROVINCE.md §2.3).
 * A temper, two assemblies a year, the documents it issues, its president,
 * and the offices a player-bishop may be elected to on the ballot engine.
 */
export type ConferenceOffice = 'committee' | 'chair' | 'secretary' | 'vice_president' | 'president';

export type ConferenceDocumentKind = 'statement' | 'pastoral_letter' | 'voting_guide' | 'guidelines';

/** A document the conference may issue, as data (content/conference/documents.json). */
export interface ConferenceDocumentDef {
  id: string;
  kind: ConferenceDocumentKind;
  title: string;
  /** "on the economy and the poor" */
  gist: string;
  /** What changes in a parish, one sentence, for the letter. */
  change: string;
  /** −1 the traditional end .. +1 the progressive end: which temper favours it. */
  lean: number;
  /** Years before the conference issues it (or its like) again. */
  years: number;
  /** Only in a presidential election year. */
  electionYear?: boolean;
  /** The position topic a bishop's vote on it, and a priest's stand, is recorded under. */
  topic: string;
  /** The letter that carries it home, with {bishop}, {title}. */
  letter: string[];
  /** The line the record keeps. */
  line: string;
}

/** The president or vice-president: a name and a reading, a man of the game when one holds it. */
export interface ConferenceOfficer {
  name: string;
  alignment: number;
  sinceWeek: number;
  /** 'player', or the NPC of the province who holds it. */
  npcId?: string;
}

export interface HeldOffice {
  office: ConferenceOffice;
  sinceWeek: number;
  endWeek: number;
}

/** An election the man stood in, or watched from the floor. */
export interface ConferenceElection {
  week: number;
  office: ConferenceOffice;
  winner: string;
  winnerName: string;
  /** He stood; and he won. */
  stood: boolean;
  won: boolean;
  rounds: number;
  ended: 'majority' | 'narrowed' | 'plurality';
  /** The last round's tallies, by name. */
  tallies: Record<string, number>;
}

export type ConferenceSceneKind = 'cascade' | 'assembly' | 'election' | 'result';

export interface ConferenceState {
  /** −100..100: where the conference reads, from the bishops the game knows and the national remainder. */
  temper: number;
  /** The rolled remainder: the bishops the game does not know. */
  remainder: number;
  president: ConferenceOfficer;
  vicePresident: ConferenceOfficer;
  /** Each assembly, and the document it issued, if one. */
  assemblies: { week: number; docId?: string }[];
  lastAssemblyWeek?: number;
  /** The player-bishop's office, and those he held. */
  held?: HeldOffice;
  past?: HeldOffice[];
  elections?: ConferenceElection[];
  /** The scene waiting for the man, and the week it is due; a cascade names its document in rome.issued. */
  scene?: { kind: ConferenceSceneKind; dueWeek: number; docIndex?: number };
}
