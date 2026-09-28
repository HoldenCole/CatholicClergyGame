import type { GameState, Letter, LiturgicalStance, LiturgicalTopic, Parish, SeeAct, SeeActDef, SignedAct } from '@/types';
import { seeAct, seeActs } from '@/content/see';
import { evaluateAll } from '@/engine/conditions';
import { applyEffects } from '@/engine/effects';
import { LITURGICAL_TOPICS } from '@/types';
import { closeSeeParish } from '@/engine/see';
import { councilCold, PRESBYTERATE } from './presbyterate';

export { closeSeeParish };

/**
 * E4 R1.1 — the bishop's desk: acts as data (content/see/acts.json), begun
 * from the see sheet, written in the desk's hours, signed when the blocks
 * are done. A decree on the liturgy sets the diocese's own policy, the one
 * the base game's pastors ask under; a closing takes a parish off the map.
 * The letter goes to the diocese and the record keeps the note.
 */
export const DESK_ACTIVITY = 'see_desk';

const STANCE_WORD: Record<LiturgicalStance, string> = { free: 'free to every pastor', by_permission: 'by the bishop\'s leave, asked for in writing', forbidden: 'not permitted' };
const TOPIC_WORD: Record<LiturgicalTopic, string> = { ad_orientem: 'Mass said facing east', latin_mass: 'the older form of the Mass in the parishes', altar_rail: 'the altar rail', tabernacle: 'the place of the tabernacle', renovation: 'the renovation of a church', older_form_faculty: 'a priest\'s faculties for the older form' };
const RESTRICT: Record<LiturgicalStance, number> = { free: 0, by_permission: 1, forbidden: 2 };

/** What a decree on the liturgy does to the dials, per step tightened, by the wings' shares: tightening costs the traditional wing and pleases the progressive. Invented. */
export const DECREE = { presbyterate: { progressive: 10, traditional: 15 }, people: { progressive: 6, traditional: 10 } } as const;

export function stanceWord(s: LiturgicalStance): string {
  return STANCE_WORD[s];
}
export function topicWord(t: LiturgicalTopic): string {
  return TOPIC_WORD[t];
}

/** The parishes a closing may name: every parish of the see but the cathedral, the smallest first. */
export function closableParishes(state: GameState): Parish[] {
  const world = state.world;
  if (!world || !state.see || world.diocese.presetId !== state.see.dioceseId) return [];
  return world.parishes.filter((p) => !p.cathedral).sort((a, b) => a.households - b.households || a.id.localeCompare(b.id));
}

/** Whether an act may be begun now, and why not. */
export function actAvailable(state: GameState, def: SeeActDef): { ok: boolean; why: string | null } {
  const see = state.see;
  if (!see) return { ok: false, why: 'No see.' };
  if (see.desk) return { ok: false, why: 'Something is already on the desk.' };
  const signed = (see.acts ?? []).filter((a) => a.actId === def.id);
  if (def.once && signed.length) return { ok: false, why: 'Once in a chair.' };
  const last = signed.at(-1);
  if (def.everyYears && last && state.clock.week - last.week < def.everyYears * 52) return { ok: false, why: `Not again for ${Math.ceil((def.everyYears * 52 - (state.clock.week - last.week)) / 52)} year${Math.ceil((def.everyYears * 52 - (state.clock.week - last.week)) / 52) === 1 ? '' : 's'}.` };
  if (def.target === 'parish' && !closableParishes(state).length) return { ok: false, why: 'No parish to close.' };
  if (!evaluateAll(def.requires, state)) return { ok: false, why: 'Not yet.' };
  return { ok: true, why: null };
}

export function actsFor(state: GameState): { def: SeeActDef; ok: boolean; why: string | null }[] {
  return seeActs.map((def) => ({ def, ...actAvailable(state, def) }));
}

/** Put an act on the desk. A targeted act names its parish, or its topic and stance. */
export function beginAct(state: GameState, actId: string, target: { parishId?: string; topic?: LiturgicalTopic; stance?: LiturgicalStance } = {}): GameState {
  const def = seeAct(actId);
  const see = state.see;
  if (!def || !see || !actAvailable(state, def).ok) return state;
  if (def.target === 'parish' && !closableParishes(state).some((p) => p.id === target.parishId)) return state;
  if (def.target === 'stance' && (!target.topic || !target.stance || !LITURGICAL_TOPICS.includes(target.topic))) return state;
  const act: SeeAct = { actId, startedWeek: state.clock.week, startedHours: state.study?.hoursLogged[DESK_ACTIVITY] ?? 0, ...(def.target === 'parish' ? { parishId: target.parishId! } : {}), ...(def.target === 'stance' ? { topic: target.topic!, stance: target.stance! } : {}) };
  return { ...state, see: { ...see, desk: act } };
}

/** Take the act off the desk unsigned. */
export function dropAct(state: GameState): GameState {
  if (!state.see?.desk) return state;
  const { desk: _d, ...see } = state.see;
  return { ...state, see };
}

/** Blocks written on the act so far, and what it needs. */
export function actProgress(state: GameState): { done: number; need: number } | null {
  const act = state.see?.desk;
  const def = act ? seeAct(act.actId) : undefined;
  if (!act || !def) return null;
  return { done: Math.max(0, (state.study?.hoursLogged[DESK_ACTIVITY] ?? 0) - act.startedHours), need: def.hours };
}

/** A decree on the liturgy: the diocese's policy is his, and the wings read it. */
function decreeStance(state: GameState, topic: LiturgicalTopic, stance: LiturgicalStance): GameState {
  const world = state.world;
  if (!world || !state.see) return state;
  const before = world.diocese.hidden.bishop.liturgy[topic];
  const steps = RESTRICT[stance] - RESTRICT[before];
  const f = world.diocese.hidden.factions;
  const presbyterate = Math.round(steps * (f.progressive * DECREE.presbyterate.progressive - f.traditional * DECREE.presbyterate.traditional));
  const people = Math.round(steps * (f.progressive * DECREE.people.progressive - f.traditional * DECREE.people.traditional));
  const liturgy = { ...world.diocese.hidden.bishop.liturgy, [topic]: stance };
  return {
    ...state,
    world: { ...world, diocese: { ...world.diocese, hidden: { ...world.diocese.hidden, bishop: { ...world.diocese.hidden.bishop, liturgy } } } },
    see: { ...state.see, presbyterate: Math.max(-100, Math.min(100, state.see.presbyterate + presbyterate)), people: Math.max(-100, Math.min(100, state.see.people + people)) },
  };
}

function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(see|parish|topic|stance)\}/g, (_, k: string) => tokens[k] ?? `{${k}}`);
}

/** The blocks are done: the act is signed, the target's consequence falls, the letter goes out, the record keeps it. */
export function signAct(state: GameState): { state: GameState; letter: Letter; line: string } | null {
  const act = state.see?.desk;
  const def = act ? seeAct(act.actId) : undefined;
  if (!act || !def || !state.see) return null;
  let next: GameState = state;
  let parishName: string | undefined;
  if (def.target === 'parish' && act.parishId) {
    const closed = closeSeeParish(next, act.parishId);
    next = closed.state;
    parishName = closed.parish?.name;
  }
  if (def.target === 'stance' && act.topic && act.stance) next = decreeStance(next, act.topic, act.stance);
  next = applyEffects(next, def.effects, {}, def.label);
  // The council of priests, heard and against it: a decree costs the presbyterate more, a closing more still. E4 R1.5.
  if ((def.target === 'stance' || def.target === 'parish') && councilCold(next) && next.see) {
    const cost = def.target === 'parish' ? PRESBYTERATE.coldCost.closing : PRESBYTERATE.coldCost.decree;
    next = { ...next, see: { ...next.see, presbyterate: Math.max(-100, next.see.presbyterate - cost) } };
  }
  const tokens: Record<string, string> = { see: next.see!.see, ...(parishName ? { parish: parishName } : {}), ...(act.topic ? { topic: topicWord(act.topic) } : {}), ...(act.stance ? { stance: stanceWord(act.stance) } : {}) };
  const signed: SignedAct = { actId: def.id, week: state.clock.week, ...(act.parishId ? { parishId: act.parishId } : {}), ...(parishName ? { parishName } : {}), ...(act.topic ? { topic: act.topic } : {}), ...(act.stance ? { stance: act.stance } : {}) };
  const { desk: _d, ...see } = next.see!;
  const note = fill(def.note, tokens);
  next = { ...next, see: { ...see, acts: [...(see.acts ?? []), signed] }, career: [...next.career, { week: state.clock.week, kind: 'note', text: note }] };
  return { state: next, letter: { sort: 'review', title: def.label, body: def.letter.map((l) => fill(l, tokens)), week: state.clock.week }, line: `Signed: ${def.label.toLowerCase()}.` };
}

/** The desk's week: an act whose blocks are written is signed. */
export function deskWeek(state: GameState): { state: GameState; line?: string; letter?: Letter } {
  const p = actProgress(state);
  if (!p || p.done < p.need) return { state };
  const out = signAct(state);
  return out ? { state: out.state, line: out.line, letter: out.letter } : { state };
}
