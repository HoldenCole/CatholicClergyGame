import type { Achievement, AmbientItem, Archetype, DecorOption, DecorPlace, DecorSlot, GameState, LiturgicalStance, LiturgicalTopic, Parish, Permission, PlaceDecor } from '@/types';
import type { Rng } from '@/engine/rng';
import decor from '@/content/parish/decor.json';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { clampSigned } from './reputation';

export const decorOptions = decor as DecorOption[];

export function optionsFor(place: DecorPlace, slot?: DecorSlot): DecorOption[] {
  return decorOptions.filter((o) => o.place === place && (!slot || o.slot === slot));
}

export function slotsFor(place: DecorPlace): DecorSlot[] {
  return [...new Set(optionsFor(place).map((o) => o.slot))];
}

export function placeKey(state: GameState, place: DecorPlace): string {
  const pid = state.assignment?.parishId ?? 'none';
  switch (place) {
    case 'church':
    case 'office':
      return `parish:${pid}:${place}`;
    case 'rectory':
      return `rectory:${pid}`;
    case 'seminary_room':
      return 'seminary';
    case 'chancery':
      return 'chancery';
  }
}

/** What a church looks like before anyone changes it, from the parish record. Deterministic. */
export function defaultChurchDecor(parish: Parish): PlaceDecor {
  const a = parish.alignment;
  const trad = a <= -25;
  const prog = a >= 25;
  return {
    sanctuary: trad ? 'sanct_high_altar' : prog ? (parish.wealth >= 4 ? 'sanct_modern' : 'sanct_plain') : 'sanct_plain',
    altar_rail: trad ? (parish.wealth >= 4 ? 'rail_marble' : 'rail_wood') : 'rail_none',
    orientation: 'orient_populum',
    confessionals: trad || parish.generational === 'aging' ? 'conf_booths' : prog ? 'conf_room' : 'conf_both',
    choir: prog ? 'choir_front' : 'choir_loft',
    statues: parish.kind === 'struggling_urban' || parish.kind === 'immigrant_growing' || trad ? 'statues_many' : prog ? 'statues_few' : 'statues_many',
    tabernacle: prog && parish.wealth >= 3 ? 'tab_side' : 'tab_center',
    mass_form: 'mass_vernacular',
  };
}

export function defaultDecor(place: DecorPlace, parish: Parish | undefined): PlaceDecor {
  switch (place) {
    case 'church':
      return parish ? defaultChurchDecor(parish) : {};
    case 'office':
      return { wall: 'owall_crucifix', desk: 'odesk_inherited', corner: 'ocorner_files' };
    case 'rectory':
      return { wall: 'rwall_crucifix', corner: 'rcorner_tv' };
    default:
      return {};
  }
}

/** The current look of a place, defaults filled in. */
export function currentDecor(state: GameState, place: DecorPlace): PlaceDecor {
  const parish = state.world?.parishes.find((p) => p.id === state.assignment?.parishId);
  return { ...defaultDecor(place, parish), ...(state.decor[placeKey(state, place)] ?? {}) };
}

/** Who may change what. DESIGN 8.1: the pastor has full authority over the liturgy and the building. */
export function mayFurnish(state: GameState, place: DecorPlace): { ok: boolean; why: string | null } {
  if (place === 'church') {
    if (state.assignment?.role === 'pastor') return { ok: true, why: null };
    return { ok: false, why: 'Only the pastor decides how the church looks.' };
  }
  if (place === 'chancery' && !Object.keys(state.flags).some((k) => k.startsWith('office:') && state.flags[k])) {
    return { ok: false, why: 'You have no office in the chancery.' };
  }
  return { ok: true, why: null };
}

export const TOPIC_LABEL: Record<LiturgicalTopic, string> = {
  ad_orientem: 'turning the altar east',
  latin_mass: 'the older form of the Mass',
  altar_rail: 'an altar rail',
  tabernacle: 'moving the tabernacle',
  renovation: 'a renovation of the sanctuary',
};

/** How long a refusal stands before the chancery will read a second letter. */
export const PERMISSION = {
  denialWeeks: 104,
  minAnswerWeeks: 3,
  maxAnswerWeeks: 8,
  baseChance: 0.4,
} as const;

export interface Gate {
  ok: boolean;
  why: string | null;
  stance: LiturgicalStance | null;
  permission: Permission | null;
  /** Whether a letter to the chancery is the next step. */
  canAsk: boolean;
}

function bishopName(state: GameState): string {
  const id = state.world?.diocese.hidden.bishop.npcId;
  const b = id ? state.npcs[id] : undefined;
  return b ? `${b.title} ${b.name.last}` : 'the bishop';
}

/** The bishop's standing on a topic, or null when there is no bishop yet. */
export function stanceFor(state: GameState, topic: LiturgicalTopic): LiturgicalStance | null {
  return state.world?.diocese.hidden.bishop.liturgy[topic] ?? null;
}

/**
 * Whether the diocese lets this option happen. The pastor governs the
 * parish, but the bishop governs the liturgy: some things he leaves to
 * pastors, some he must be asked for, some are closed under him.
 */
export function gateFor(state: GameState, option: DecorOption): Gate {
  const topic = option.policy;
  if (!topic) return { ok: true, why: null, stance: null, permission: null, canAsk: false };
  const stance = stanceFor(state, topic);
  const permission = state.permissions[topic] ?? null;
  if (stance === null || stance === 'free') return { ok: true, why: null, stance, permission, canAsk: false };
  if (permission?.status === 'granted') return { ok: true, why: null, stance, permission, canAsk: false };
  if (stance === 'forbidden') return { ok: false, why: `Not open in this diocese: ${bishopName(state)} does not permit ${TOPIC_LABEL[topic]}.`, stance, permission, canAsk: false };
  if (permission?.status === 'pending') {
    const weeks = state.clock.week - permission.askedWeek;
    return { ok: false, why: `You wrote to the chancery ${weeks === 0 ? 'this week' : `${weeks} week${weeks === 1 ? '' : 's'} ago`} about ${TOPIC_LABEL[topic]}. No answer yet.`, stance, permission, canAsk: false };
  }
  if (permission?.status === 'denied' && state.clock.week - permission.answerWeek < PERMISSION.denialWeeks) {
    const weeks = state.clock.week - permission.answerWeek;
    return { ok: false, why: `${bishopName(state)} said no to ${TOPIC_LABEL[topic]} ${weeks < 8 ? 'recently' : `${Math.round(weeks / 4)} months ago`}. Asking again now would not help.`, stance, permission, canAsk: false };
  }
  return { ok: false, why: `Needs the bishop's leave. Write to the chancery about ${TOPIC_LABEL[topic]}.`, stance, permission, canAsk: true };
}

/** Send the letter. The answer comes back through the week hook some weeks later. */
export function petition(state: GameState, topic: LiturgicalTopic, rng: Rng): FurnishResult {
  if (state.assignment?.role !== 'pastor') throw new Error('Only the pastor writes to the chancery about the liturgy.');
  const stance = stanceFor(state, topic);
  if (stance === null) throw new Error('There is no bishop to ask.');
  if (stance === 'forbidden') throw new Error(`${bishopName(state)} does not permit ${TOPIC_LABEL[topic]}.`);
  const existing = state.permissions[topic];
  if (existing?.status === 'pending') throw new Error('You have already written; wait for the answer.');
  if (existing?.status === 'granted' || stance === 'free') return { state, line: 'You already have leave for that.' };
  if (existing?.status === 'denied' && state.clock.week - existing.answerWeek < PERMISSION.denialWeeks) throw new Error('The chancery has answered that already.');
  const bishopId = state.world!.diocese.hidden.bishop.npcId;
  const permission: Permission = { topic, status: 'pending', bishopId, askedWeek: state.clock.week, answerWeek: state.clock.week + rng.int(PERMISSION.minAnswerWeeks, PERMISSION.maxAnswerWeeks) };
  const next: GameState = {
    ...state,
    permissions: { ...state.permissions, [topic]: permission },
    career: [...state.career, { week: state.clock.week, kind: 'note', text: `Wrote to the chancery for leave: ${TOPIC_LABEL[topic]}.` }],
  };
  return { state: next, line: `The letter goes out Monday. The chancery answers in its own time.` };
}

/** Topics that read as a traditional tilt when the bishop decides. */
const TOPIC_TILT: Record<LiturgicalTopic, number> = { ad_orientem: -1, latin_mass: -1, altar_rail: -1, tabernacle: 0, renovation: 0 };

/** The chance the bishop says yes: standing with him and the chancery, and how the ask sits with his own leanings. */
export function grantChance(state: GameState, topic: LiturgicalTopic): number {
  const profile = state.world!.diocese.hidden.bishop;
  const rel = state.npcs[profile.npcId]?.relationship ?? 0;
  const chancery = state.character?.reputation.chancery ?? 0;
  const lean = TOPIC_TILT[topic] * -profile.alignment / 300; // a traditional bishop warms to a traditional ask
  return Math.min(0.95, Math.max(0.05, PERMISSION.baseChance + rel / 250 + chancery / 250 + lean));
}

/** Answer any letters whose week has come. Called by the week hook. */
export function resolvePermissions(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  for (const p of Object.values(state.permissions)) {
    if (p.status !== 'pending' || p.answerWeek > state.clock.week || !next.world) continue;
    const granted = rng.chance(grantChance(next, p.topic));
    const answered: Permission = { ...p, status: granted ? 'granted' : 'denied', answerWeek: state.clock.week };
    const line = granted
      ? `A letter from the chancery: ${bishopName(next)} grants leave for ${TOPIC_LABEL[p.topic]}, "with the usual prudence."`
      : `A letter from the chancery: ${bishopName(next)} declines ${TOPIC_LABEL[p.topic]} "at this time."`;
    lines.push(line);
    next = {
      ...next,
      permissions: { ...next.permissions, [p.topic]: answered },
      flags: { ...next.flags, [`permission:${p.topic}`]: granted },
      career: [...next.career, { week: state.clock.week, kind: 'note', text: line }],
    };
  }
  return { state: next, lines };
}

/** The state as it would be with one option applied, for previews. Pure; costs nothing. */
export function previewState(state: GameState, place: DecorPlace, optionId: string): GameState {
  const option = decorOptions.find((o) => o.id === optionId);
  if (!option) return state;
  const key = placeKey(state, place);
  return { ...state, decor: { ...state.decor, [key]: { ...currentDecor(state, place), [option.slot]: option.id } } };
}

export interface FurnishResult {
  state: GameState;
  line: string;
}

/** Tunables for how a parish reacts to a change in its church. Invented. */
export const DECOR = {
  /** Lay support gained when a change matches the parish, lost as the gap widens. */
  parishionersBase: 3,
  parishionersPerGap: 1 / 12,
  blocPerAlignment: 1 / 8,
  parishDrift: 4,
} as const;

/**
 * Choose an option for a slot. Church changes cost parish cash and provoke a
 * reaction sized by the gap between the option and the parish; personal
 * items are free and quiet.
 */
export function furnish(state: GameState, place: DecorPlace, optionId: string): FurnishResult {
  const option = decorOptions.find((o) => o.id === optionId);
  if (!option || option.place !== place) throw new Error(`no such option ${optionId} for ${place}`);
  const allowed = mayFurnish(state, place);
  if (!allowed.ok) throw new Error(allowed.why ?? 'not allowed');
  if (!evaluateAll(option.requires, state)) throw new Error('That is not open to you yet.');
  const gate = gateFor(state, option);
  if (!gate.ok) throw new Error(gate.why ?? 'not permitted');
  const key = placeKey(state, place);
  const current = currentDecor(state, place);
  if (current[option.slot] === option.id) return { state, line: 'Nothing changed.' };

  let next: GameState = { ...state, decor: { ...state.decor, [key]: { ...current, [option.slot]: option.id } } };
  let line = `${option.label}.`;
  if (option.cost > 0) {
    if (!next.parish || next.parish.finance.cash < option.cost) throw new Error('The parish cannot pay for it.');
    next = applyEffects(next, [{ target: 'money', key: 'cash', delta: -option.cost }]);
  }
  if (place === 'church' && option.alignment !== null && next.world && next.parish && next.character) {
    const parish = next.world.parishes.find((p) => p.id === next.parish!.parishId)!;
    const gap = Math.abs(option.alignment - parish.alignment);
    const people = Math.round(DECOR.parishionersBase - gap * DECOR.parishionersPerGap);
    const bloc = Math.round(Math.abs(option.alignment) * DECOR.blocPerAlignment);
    next = applyEffects(next, [
      { target: 'reputation', key: 'parishioners', delta: people },
      { target: 'reputation', key: option.alignment < 0 ? 'traditional_bloc' : 'progressive_bloc', delta: bloc },
      { target: 'reputation', key: option.alignment < 0 ? 'progressive_bloc' : 'traditional_bloc', delta: -Math.round(bloc / 2) },
    ]);
    const drift = Math.sign(option.alignment - parish.alignment) * Math.min(DECOR.parishDrift, gap);
    const world = next.world!;
    next = {
      ...next,
      world: { ...world, parishes: world.parishes.map((p) => (p.id === parish.id ? { ...p, alignment: clampSigned(p.alignment + drift) } : p)) },
    };
    line = people >= 2 ? `${option.label}. The parish approves, mostly.` : people <= -2 ? `${option.label}. Letters will be written.` : `${option.label}. Some noticed; a few minded.`;
    next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Changed the church: ${option.label.toLowerCase()}.` }] };
  }
  if (option.effects) next = applyEffects(next, option.effects);
  return { state: next, line };
}

const ARCHETYPE_ITEM: Record<Archetype, AmbientItem> = {
  pastoral: { layer: 'archetype', variant: 'gifts', label: 'Gifts from parishioners: a carved bird, a child’s drawing, a bottle you will not open' },
  teaching: { layer: 'archetype', variant: 'chalkboard', label: 'A small chalkboard with Thursday’s lesson still on it' },
  theological: { layer: 'archetype', variant: 'journals', label: 'Stacks of journals, the newest on top, read' },
  administrative: { layer: 'archetype', variant: 'binders', label: 'Binders, labeled, in order' },
  missionary: { layer: 'archetype', variant: 'map', label: 'A map of somewhere far away, with pins' },
};

/** Achievements derived from the record. Shown as plaques, photographs, and frames. */
export function achievements(state: GameState): Achievement[] {
  const out: Achievement[] = [];
  const f = state.flags;
  const promotions = state.career.filter((e) => e.kind === 'promotion').length;
  const founded = Object.values(state.groups).filter((g) => g.foundedByPlayer).length;
  if (f.ordained) out.push({ id: 'ordained', label: 'The ordination photograph', art: 'photo' });
  if (promotions > 0) out.push({ id: 'pastorate', label: 'The letter of appointment, framed', art: 'frame' });
  if (f.hard_parish_turned) out.push({ id: 'hard_parish', label: 'A plaque from the parish everyone had written off', art: 'plaque' });
  if (f.published) out.push({ id: 'published', label: 'Your article, framed by someone else', art: 'frame' });
  if (f.rome_alumnus) out.push({ id: 'rome', label: 'A photograph on the Gregorian steps', art: 'photo' });
  if (founded >= 3) out.push({ id: 'founder', label: 'A plaque from the groups you founded', art: 'plaque' });
  if (Number(f.successions ?? 0) >= 2) out.push({ id: 'survivor', label: 'Photographs with three bishops', art: 'photo' });
  if (f.took_the_hard_parish) out.push({ id: 'volunteer', label: 'A thank-you letter from the chancery', art: 'frame' });
  if (Number(f.transfers ?? 0) >= 4) out.push({ id: 'moved', label: 'A shelf of parish bulletins from four parishes', art: 'frame' });
  return out;
}

/**
 * What the room shows because of who he is: books for the mind, a candle
 * for the prayer, clippings for the mouth, a photograph for the family,
 * and the archetype's own object. Derived from state, never stored.
 */
export function ambientFor(state: GameState, place: DecorPlace): AmbientItem[] {
  const c = state.character;
  if (!c) return [];
  const out: AmbientItem[] = [];
  const mind = (c.stats.theology + c.stats.knowledge) / 2;
  out.push({ layer: 'books', variant: mind >= 75 ? 'wall' : mind >= 60 ? 'many' : mind >= 45 ? 'some' : 'few', label: mind >= 60 ? 'Books, more than the shelves hold' : mind >= 45 ? 'A shelf of books from seminary' : 'A few books, mostly unread' });
  if (c.stats.piety >= 60) out.push({ layer: 'prayer', variant: 'candle', label: 'A candle, lit, and a breviary open on the sill' });
  else if (c.stats.piety <= 30) out.push({ layer: 'prayer', variant: 'cold', label: 'A breviary under a stack of mail' });
  if (c.outspokenness >= 50) out.push({ layer: 'clippings', variant: 'pinned', label: 'Newspaper clippings, yours, pinned up' });
  if (c.stats.administration >= 60) out.push({ layer: 'desk_state', variant: 'tidy', label: 'A desk with nothing on it that is not in progress' });
  else if (c.stats.administration <= 35) out.push({ layer: 'desk_state', variant: 'piles', label: 'Piles. The secretary has given up' });
  const fam = c.background.family;
  if (fam === 'supportive' || fam === 'large') out.push({ layer: 'family', variant: 'photo', label: 'A photograph of your family at the ordination' });
  if (fam === 'widowed_mother') out.push({ layer: 'family', variant: 'mother', label: 'Your mother, in a frame, watching the desk' });
  if (c.credentials.some((k) => ['STB', 'STL', 'JCL', 'MBA', 'STD', 'JCD'].includes(k))) out.push({ layer: 'diploma', variant: 'framed', label: `Degrees on the wall: ${c.credentials.filter((k) => /^[A-Z]{3}$/.test(k)).join(', ')}` });
  if (c.archetype) out.push(ARCHETYPE_ITEM[c.archetype]);
  if (place === 'office' || place === 'seminary_room' || place === 'chancery') {
    for (const a of achievements(state)) out.push({ layer: `achievement:${a.art}`, variant: a.id, label: a.label });
  }
  if (place === 'seminary_room' && state.seminary?.emphasis) {
    const e = state.seminary.emphasis;
    const top = (Object.entries(e) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top === 'human') out.push({ layer: 'room', variant: 'sports', label: 'Running shoes by the door, and a guitar' });
    if (top === 'spiritual') out.push({ layer: 'room', variant: 'kneeler', label: 'A kneeler under the window, worn' });
    if (top === 'intellectual') out.push({ layer: 'room', variant: 'papers', label: 'Papers, a lamp still on' });
    if (top === 'pastoral') out.push({ layer: 'room', variant: 'stole', label: 'A stole over the chair from the parish on Sunday' });
  }
  return out;
}
