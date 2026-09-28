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
  /** A religious pope: the key of his order ('SJ', 'OP', 'OSA', …), as the record and the College have it. E3 §16B. */
  order?: string;
  /** A pope who was a friar of the player's own province: the NPC he was. E3 §7.5, the rarest event. */
  confrereId?: string;
}

export interface Vacancy {
  /** Day number the see fell vacant. */
  sinceDay: number;
  /** Day number the white smoke rises. */
  electionDay: number;
  cause: PapacyEnd;
  /** The pope whose see it was. */
  priorId: string;
  /** R1.5: the cardinal the conclave elected, when it has voted: he is proclaimed on the election day. */
  winnerId?: string;
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
  /** R1.3: the apostolic nuncio of the day, and those before him in the man's life. */
  nuncio?: Nuncio;
  nuncios?: number;
  /** R1.3: the nuncio's processes for the sees of the region, open and closed. */
  ternas?: Terna[];
  /** R1.3: the nuncio's scene waiting for the man, and the week it is due. */
  nuncioScene?: { kind: NuncioSceneKind; dueWeek: number; ternaId?: string };
  /** R1.5: the College of Cardinals, living; the next consistory; and the conclave in session. */
  college?: Cardinal[];
  cardinalsMade?: number;
  nextConsistoryDay?: number;
  conclave?: Conclave;
  /** R1.5: the College's scene waiting for the man. */
  collegeScene?: { kind: CollegeSceneKind; dueWeek: number };
  /** R1.6: the man's own pontificate, while he reigns. */
  pontificate?: Pontificate;
  /** R1.7: the man in the Holy See's diplomatic service. */
  diplomacy?: Diplomacy;
}

/** E1 R1.7 — the diplomatic service (§11). */
export type DiplomatRank = 'student' | 'secretary2' | 'secretary1' | 'counsellor' | 'nuncio';
export type DiplomacySceneKind = 'mission' | 'rotation' | 'terna' | 'seventy_five';

/** A country of the service, as data (content/rome/nunciatures.json). */
export interface NunciatureDef {
  country: string;
  region: string;
  /** The credential that is its language, if the game has one. */
  language?: string;
  /** 1 a quiet post .. 3 a hard one: a war, a hostile government, a Church under pressure. */
  hardship: number;
  /** One line about the Church there. */
  church: string;
}

export interface Diplomacy {
  rank: DiplomatRank;
  /** The week the service began (after the Academy), and the week he was named nuncio. */
  since?: number;
  nuncioSince?: number;
  /** The country he serves in now, the week he came, and the week the Secretariat moves him. */
  country?: string;
  arrivedWeek?: number;
  rotateWeek?: number;
  /** The next country, chosen when the rotation scene is put to him. */
  next?: string;
  countries: string[];
  scene?: { kind: DiplomacySceneKind; dueWeek: number };
}

/** E1 R1.6 — the pontificate played (§10). */
export type PopeSceneKind = 'first' | 'journey' | 'anniversary' | 'laying_down';

/** A document on the pope's desk: the kind, the subject, and the writing done. */
export interface PapalDraft {
  kind: DocumentKind;
  title: string;
  gist: string;
  axis?: string;
  value?: string;
  from?: string;
  need: number;
  done: number;
  startedWeek: number;
}

export interface Pontificate {
  name: string;
  electedWeek: number;
  electedDay: number;
  /** The see or office he left for the chair, for the record. */
  from: string;
  draft?: PapalDraft;
  /** Ids of the documents he promulgated, in rome.issued. */
  written: string[];
  journey?: { where: string; region: string; dueWeek: number };
  journeys: { week: number; where: string }[];
  consistories: { week: number; created: string[] }[];
  /** The men put before him at a consistory he has called, until he creates them. */
  candidates?: Cardinal[];
  /** The College's electors on his election day, and how many of them his predecessors made. */
  electorsAtElection: number;
  scene?: { kind: PopeSceneKind; dueWeek: number };
}

/** E1 R1.5 — a cardinal of the College (§7): generated, created by a pope of the line, reading much as he did. */
export interface Cardinal {
  id: string;
  name: string;
  born: number;
  from: string;
  region: string;
  temperament: number;
  createdDay: number;
  /** The pope who created him. */
  createdBy: string;
  curial: boolean;
  /** How the College rates him as a possible pope, 0..1. */
  papabile: number;
  /** The day he dies, rolled when he is made. */
  diesDay: number;
  /** A religious cardinal: the key of his order ('SJ', 'OP', 'OSA', …). E3 §16B. */
  order?: string;
  /** A cardinal who is a friar of the player's own province: the NPC he was. E3 §7.5. */
  npcId?: string;
}

export type CollegeSceneKind = 'created' | 'titular' | 'eve' | 'after' | 'eighty' | 'consistory';

/** A conclave in session with the man inside it. */
export interface Conclave {
  /** The men who can be elected: the papabili, and the man himself if he is one. 'player' is the man. */
  candidateIds: string[];
  electorIds: string[];
  actions: { vote?: string; speech?: 'continuity' | 'reform' | 'pastor' | 'governance'; signal?: 'willing' | 'unwilling' };
  ballots?: { round: number; tallies: Record<string, number>; field: string[] }[];
  electedId?: string;
  /** He was elected and said no: the College votes again without him. */
  declined?: boolean;
}

/** E1 R1.3 — the apostolic nuncio (§5): a generated archbishop, rotating, with his own reading. */
export interface Nuncio {
  npcId: string;
  /** −100 traditional .. +100 progressive: the pope who sent him, and the man. */
  temperament: number;
  from: string;
  arrivedDay: number;
  leavesDay: number;
}

export type TernaCause = 'died' | 'retired' | 'transferred';

/** A see of the region falls vacant and the nuncio sends three names to Rome. */
export interface Terna {
  id: string;
  seeId: string;
  seeName: string;
  cause: TernaCause;
  openedWeek: number;
  /** The week the three names go to Rome, and the week the new bishop is named. */
  sendWeek: number;
  nameWeek: number;
  /** His own name is on it. */
  player: boolean;
  /** The priest he was asked about, if he was consulted. */
  consultedAbout?: string;
  /** Who was named: 'player', an npc id, or a stranger's name. */
  winner?: string;
  winnerName?: string;
  done?: boolean;
}

export type NuncioSceneKind = 'consulted' | 'about_you' | 'passed' | 'subject_named' | 'arrival' | 'remembers' | 'aux_request';

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
  /** E3 §16D: who reads a document on this axis in the man's world: the diocesan bishop (the default), or, for religious life, the provincial. */
  reader?: 'bishop' | 'provincial';
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
  /** How the diocesan bishop received it, and who he was; on an axis read by the provincial (E3 §16D), the provincial. */
  norm?: DiocesanNorm;
  bishopId?: string;
  /** What the man did with it, when a scene asked him. */
  implemented?: Implementation;
  implementedWeek?: number;
  parishId?: string;
  /** R1.2: the earlier document of his lifetime this one turns back, and what he had done with it (§4.3). */
  reverses?: { index: number; title: string; value: string; implemented: Implementation; week: number };
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
  /** A religious pope of the record: his order's key. */
  order?: string;
}
