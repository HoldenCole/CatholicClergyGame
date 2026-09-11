import type { Effect } from './events';

/** Who a priest can have a word with. Group leaders are keyed by agenda. */
export type TalkWho =
  | 'pastor' | 'secretary' | 'dre' | 'music_director' | 'maintenance' | 'bishop' | 'brother_priest' | 'classmate'
  | 'leader_saintly' | 'leader_empire' | 'leader_political' | 'leader_tired' | 'leader_new' | 'leader_grieving';

export type TalkBand = 'cold' | 'neutral' | 'warm';

/** One authored exchange: an hour with a person of the parish or diocese. content/parish/talks.json */
export interface TalkDef {
  who: TalkWho;
  band: TalkBand;
  /** Variants; one is drawn. `{@who}` is the person. */
  text: string[];
  effects: Effect[];
  /** Extra effects per variant, aligned with `text`: a friend lets something slip in one telling and not another. */
  variantEffects?: (Effect[] | null)[];
}

export interface TalkRecord {
  week: number;
  npcId: string;
  text: string;
}

export interface TalksState {
  /** The week each person was last spoken with. */
  last: Record<string, number>;
  /** The exchanges, most recent last. */
  log: TalkRecord[];
}
