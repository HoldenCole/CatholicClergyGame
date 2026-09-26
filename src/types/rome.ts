/**
 * E1 — Rome. The papacy as the man lives under it: the real record as data
 * up to the last pope no longer living, generated popes after
 * (docs/EXPANSION-E1-ROME.md §3, §9 A).
 */
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
