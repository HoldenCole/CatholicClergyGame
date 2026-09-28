import type { GameState, GeneralCuria, Npc } from '@/types';
import type { Rng } from '@/engine/rng';
import { createRng } from '@/engine/rng';
import { dateOf } from '@/engine/time';
import { religiousOrder } from '@/content/religious';
import { offerById } from '@/content/offers';
import { finishNpc, rollBaseStats } from '@/generation/npc';
import { rollMaleName } from '@/generation/names';
import { beginStudy } from '@/engine/study';
import { openChapter } from './chapter';
import { CAPITULAR_TAG, PLAYER_ID, playerLegibility } from './electorate';
export { nameableByTheOrder, orderLegibility } from './electorate';

/**
 * E3 §16A — the order beyond the province: its head, his term, and the
 * general chapter that elects him. The capitulars are generated for each
 * chapter from the seed and let go after it; the player is in the room as
 * provincial or as his province's delegate, and on the ballot when the
 * order can name him by something. Tunables are invented and flagged.
 */
export const GENERAL = {
  /** Provinces present at a chapter, sampled from the order's; each sends its provincial and a delegate. */
  provincesPresent: 20,
  /** The province sends him as its delegate: standing with it, legibility, and a roll. */
  delegate: { province: 30, legibility: 50, chance: 0.35 },
  /** What a capitular thinks of a man he has only heard of: the order's regard, and a regional roll. His legibility to the room is GENERAL_ELECTORATE's. */
  relationship: { fromOrder: 0.05, spread: 25 },
  /** The first general's term, at the world's start: some of it already served. */
  firstServedShare: 0.7,
} as const;

/** Where the order's men come from, for the capitulars' names and regions. Weights invented. */
const ORIGINS: { heritage: Parameters<typeof rollMaleName>[1]; from: string; region: string; weight: number }[] = [
  { heritage: 'italian', from: 'Italy', region: 'Europe', weight: 3 },
  { heritage: 'polish', from: 'Poland', region: 'Europe', weight: 2 },
  { heritage: 'german', from: 'Germany', region: 'Europe', weight: 1.5 },
  { heritage: 'irish', from: 'Ireland', region: 'Europe', weight: 1 },
  { heritage: 'mexican', from: 'Mexico', region: 'Latin America', weight: 2.5 },
  { heritage: 'filipino', from: 'the Philippines', region: 'Asia', weight: 2 },
  { heritage: 'indian', from: 'India', region: 'Asia', weight: 2 },
  { heritage: 'nigerian', from: 'Nigeria', region: 'Africa', weight: 2.5 },
  { heritage: 'lebanese', from: 'Lebanon', region: 'Asia', weight: 0.5 },
  { heritage: 'anglo', from: 'the United States', region: 'North America', weight: 1.5 },
];

function orderKey(state: GameState): string | undefined {
  return state.religious?.order;
}

/** The order's head as the world has him: seeded on first sight, an NPC of the seed some way into his term. */
export function ensureGeneralCuria(state: GameState): GameState {
  const key = orderKey(state);
  if (!key || state.generalCuria) return state;
  const def = religiousOrder(state.religious!.order);
  const rng = createRng(`${state.seed}:general:first`);
  const year = dateOf(state.clock).year;
  const origin = rng.weighted(ORIGINS, (o) => o.weight);
  const npc = finishNpc(rng, {
    id: `general_${key}_first`,
    name: rollMaleName(rng, origin.heritage, 'older'),
    role: 'official',
    title: 'Fr.',
    birthYear: year - rng.int(56, 66),
    origin: 'urban_ethnic',
    stats: rollBaseStats(rng, 50, 75),
    tags: ['religious', `order:${key}`, 'general', 'vows:solemn'],
    alignment: rng.int(-40, 40),
    relationship: 0,
    ambition: rng.int(20, 60),
  });
  const served = Math.round(def.governance.generalTermYears * 52 * GENERAL.firstServedShare * rng.next());
  const curia: GeneralCuria = { generalId: npc.id, since: state.clock.week - served, terms: 1, chaptersHeld: 0 };
  return { ...state, npcs: { ...state.npcs, [npc.id]: npc }, generalCuria: curia };
}

/** Whether the head's term has run and the order must elect. */
export function generalChapterDue(state: GameState): boolean {
  const gc = state.generalCuria;
  if (!gc || !state.religious) return false;
  const years = religiousOrder(state.religious.order).governance.generalTermYears;
  return state.clock.week - gc.since >= years * 52;
}

/** What a capitular thinks of the player: what the order has heard of him, and where the man is from. */
function regard(state: GameState, rng: Rng): number {
  const order = state.character?.reputation.order ?? 0;
  return Math.max(-100, Math.min(100, Math.round(order * GENERAL.relationship.fromOrder + rng.gaussian() * GENERAL.relationship.spread)));
}

/** The chapter's capitulars: a provincial and a delegate from each province present, men of the seed and the week. */
export function makeCapitulars(state: GameState, week: number): Npc[] {
  const key = orderKey(state)!;
  const rng = createRng(`${state.seed}:capitulars:${week}`);
  const year = dateOf(state.clock).year;
  const out: Npc[] = [];
  for (let p = 0; p < GENERAL.provincesPresent; p++) {
    const origin = rng.weighted(ORIGINS, (o) => o.weight);
    for (const kind of ['provincial', 'delegate'] as const) {
      const r = rng.derive(`${p}:${kind}`);
      const id = `capitular_${week}_${p}_${kind}`;
      out.push(finishNpc(r, {
        id,
        name: rollMaleName(r, origin.heritage, kind === 'provincial' ? 'older' : 'younger'),
        role: 'official',
        title: 'Fr.',
        birthYear: year - (kind === 'provincial' ? r.int(46, 66) : r.int(38, 62)),
        origin: 'urban_ethnic',
        stats: rollBaseStats(r, kind === 'provincial' ? 55 : 35, kind === 'provincial' ? 85 : 65),
        // A provincial was a prior first, nearly always: the room can name him by both.
        tags: ['religious', `order:${key}`, CAPITULAR_TAG, 'vows:solemn', `from:${origin.from}`, `region:${origin.region}`, ...(kind === 'provincial' ? ['provincial', 'prior'] : [])],
        alignment: Math.max(-100, Math.min(100, Math.round(r.gaussian() * 35))),
        relationship: regard(state, r.derive('regard')),
        ambition: kind === 'provincial' ? r.int(10, 60) : r.int(10, 80),
      }));
    }
  }
  return out;
}

/**
 * Open the elective general chapter: the capitulars come into the world,
 * the province decides whether he goes as its delegate, and the chapter
 * sits on the engine with level `general`.
 */
export function openGeneralChapter(state: GameState, rng: Rng, opts: { exclude?: string[] } = {}): GameState {
  const r = state.religious;
  if (!r) return state;
  let s = ensureGeneralCuria(state);
  const week = s.clock.week;
  const capitulars = makeCapitulars(s, week);
  const npcs = { ...s.npcs };
  for (const n of capitulars) npcs[n.id] = n;
  const flags: GameState['flags'] = { ...s.flags, 'chapter:general': week };
  delete flags['general:delegate'];
  // The province sends its delegate: a man it can describe, in good standing, more often than not when the roll says so.
  const province = s.character?.reputation.province ?? 0;
  const provincial = r.office?.office === 'provincial';
  // Not the man who has just laid the office down: the chapter that replaces him sits without him.
  const excluded = !!opts.exclude?.includes(PLAYER_ID);
  if (!provincial && !excluded && !s.flags.ordained_bishop && province >= GENERAL.delegate.province && playerLegibility(s) >= GENERAL.delegate.legibility && rng.derive(`delegate:${week}`).chance(GENERAL.delegate.chance)) flags['general:delegate'] = true;
  s = { ...s, npcs, flags };
  return openChapter(s, 'general', r.order, 'general', opts);
}

/** The chapter's capitulars go home: every one but the man elected. */
export function dismissCapitulars(state: GameState): GameState {
  const keep = state.generalCuria?.generalId;
  const npcs: GameState['npcs'] = {};
  for (const [id, n] of Object.entries(state.npcs)) if (!n.tags.includes(CAPITULAR_TAG) || id === keep) npcs[id] = n;
  const flags = { ...state.flags };
  delete flags['general:delegate'];
  return { ...state, npcs, flags };
}

/**
 * Elected and seated: he goes to Rome on the posting machinery, the term
 * and the posting ending together. A re-election extends both.
 */
export function beginGeneralate(state: GameState): GameState {
  const r = state.religious;
  const office = r?.office;
  if (!r || !office || office.office !== 'general') return state;
  const base = offerById('fr_general_elected');
  if (!base?.accept.commitment) return state;
  // The term's length is the order's, not the letter's: the posting is as long as the office.
  const def = { ...base, accept: { ...base.accept, commitment: { ...base.accept.commitment, weeks: office.endWeek - state.clock.week } } };
  if (state.study?.city === 'generalate') {
    // A second term: the posting runs on with the office.
    const beats = state.beats.map((b) => (b.kind === 'assignment' && b.week === state.study!.endWeek ? { ...b, week: office.endWeek } : b)).sort((a, b) => a.week - b.week);
    return { ...state, study: { ...state.study, endWeek: office.endWeek }, beats };
  }
  const away = beginStudy({ ...state, offerHistory: [...state.offerHistory, { offerId: def.id, week: state.clock.week, decision: 'accepted' }] }, def, false, createRng(`${state.seed}:generalate:${state.clock.week}`));
  const beats = away.beats.map((b) => (b.kind === 'assignment' && b.week === away.study!.endWeek ? { ...b, week: office.endWeek, label: 'The term as head of the order ends' } : b)).sort((a, b) => a.week - b.week);
  return { ...away, study: { ...away.study!, endWeek: office.endWeek }, beats };
}

/** The general's title in the order's own words. */
export function generalTitle(state: GameState): string {
  return state.religious ? religiousOrder(state.religious.order).governance.generalTitle : 'head of the order';
}
