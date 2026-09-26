/**
 * E1 — Rome. The papacy as the man lives under it: the real record as data
 * up to the last pope no longer living, generated popes after
 * (docs/EXPANSION-E1-ROME.md §3, §9 A).
 */
import type { LiturgicalStance, LiturgicalTopic } from './world';

export type PapacyEnd = 'died' | 'resigned';

export interface Papacy {
  /** 'hist:<key>' for the record, 'gen:<n>' for a generated pope. */
  id: string;
  /** The regnal name: "Francis", "Gregory XVII". */
  name: string;
  born: number;
  /** Day number (days since 1970-01-01) of the election. */
  electedDay: number;
  /** Day number the see fell vacant: fixed for the record, rolled at election for a generated pope. */
  endDay?: number;
  end?: PapacyEnd;
  /** Where he came from: "Argentina". */
  from: string;
  /** The game's one axis, as bishops and the man have it: −100 traditional .. +100 progressive. */
  temperament: number;
  historical: boolean;
  /** One line about him, for the record and the profile. */
  line?: string;
}

export interface Vacancy {
  /** Day number the see fell vacant. */
  sinceDay: number;
  /** Day number the white smoke rises. */
  electionDay: number;
  cause: PapacyEnd;
  /** The pope whose see it was. */
  priorId: string;
}

export interface RomeState {
  /** Every pope of his life, in order; the last reigns unless a vacancy is open. */
  popes: Papacy[];
  vacancy?: Vacancy;
  /** Regnal names taken by generated popes, with the ordinal last used. */
  ordinals?: Record<string, number>;
  /** How many popes have been generated in this world, for their seeds. */
  generated?: number;
  /** R1.1: where each policy axis stands, and which document put it there. */
  policies?: Record<string, PolicyStanding>;
  /** R1.1: the documents issued in the man's lifetime, in order. */
  issued?: IssuedDocument[];
  /** R1.1: the last day the documents were read through. */
  docsThrough?: number;
  /** R1.1: the document whose parish scene is waiting, and the week it is due. */
  cascade?: { index: number; dueWeek: number };
}

/**
 * E1 R1.1 — documents and the implementation cascade (§4). A document is
 * data; a policy axis is a named question the Church answers one way or
 * another, and the systems read where it stands.
 */
export type DocumentKind =
  | 'encyclical' | 'apostolic_exhortation' | 'apostolic_constitution' | 'apostolic_letter' | 'motu_proprio'
  | 'instruction' | 'declaration' | 'circular_letter' | 'bull' | 'missal' | 'synod' | 'responsum' | 'council';

/** How the diocesan bishop receives a document (§4.2). */
export type DiocesanNorm = 'enthusiastic' | 'faithful' | 'minimal' | 'slow';

/** What the man did with it in his parish (§4.2 step 3). */
export type Implementation = 'eager' | 'faithful' | 'minimal' | 'defiant';

export interface PolicyStanding {
  value: string;
  /** The title of the document that put it there, or null for the law as it stood. */
  by: string | null;
  /** That document's id ('hist:<key>' or 'gen:<n>'), and the value it moved the axis from. */
  docId?: string;
  from?: string | undefined;
  day: number;
}

export interface PolicyValueDef {
  key: string;
  /** −1 the traditional end .. +1 the progressive end. */
  lean: number;
  label: string;
  /** What a document that sets it is about: "opening the ministries of lector and acolyte to women". */
  gist: string;
  /** What changes in a parish, one sentence, for the letter. */
  change: string;
  /** The least restrictive stance the law leaves a bishop, on the liturgical topics this axis governs. */
  floor?: LiturgicalStance;
  /** The stance a bishop's reading sets, by norm, on those topics. */
  stances?: Partial<Record<DiocesanNorm, Partial<Record<LiturgicalTopic, LiturgicalStance>>>>;
}

export interface PolicyAxisDef {
  key: string;
  label: string;
  /** Where the axis stands before any document of the record moves it. */
  initial: string;
  values: PolicyValueDef[];
  /** Whether a generated pope may move it. */
  generated: boolean;
  /** The liturgical topics whose stance this axis governs (the older Mass: the parish Mass and the priest's faculties). */
  topics?: LiturgicalTopic[];
  /** The bishop's reading, by norm, with {bishop} and {doc}; the generic lines are used where absent. */
  readings?: Partial<Record<string, Partial<Record<DiocesanNorm, string>>>>;
}

/** A document of the record, as data. */
export interface HistoricalDocumentDef {
  key: string;
  kind: DocumentKind;
  title: string;
  /** ISO date it takes effect in the parishes. */
  date: string;
  /** The pope's key in history.json. */
  pope: string;
  /** "on the Church in the modern world" */
  gist: string;
  axis?: string;
  value?: string;
}

export interface IssuedDocument {
  /** 'hist:<key>' or 'gen:<n>'. */
  id: string;
  kind: DocumentKind;
  title: string;
  gist: string;
  day: number;
  week: number;
  popeId: string;
  axis?: string;
  value?: string;
  /** Where the axis stood before it. */
  from?: string;
  /** How the diocesan bishop received it, and who he was. */
  norm?: DiocesanNorm;
  bishopId?: string;
  /** What the man did with it, when a scene asked him. */
  implemented?: Implementation;
  implementedWeek?: number;
  parishId?: string;
}


/** A pope of the record, as data. */
export interface HistoricalPapacyDef {
  key: string;
  name: string;
  born: number;
  /** ISO dates. */
  elected: string;
  ended: string;
  end: PapacyEnd;
  from: string;
  temperament: number;
  line: string;
}
