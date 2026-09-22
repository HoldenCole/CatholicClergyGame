import type { Effect, GameState, HouseOfficeDef, Npc, OrderHouse, StatKey } from '@/types';
import { applyEffects } from '@/engine/effects';
import { priorDeskDefs, religiousOrder } from '@/content/religious';
import { currentHouse, membersOf, nudgeHouse, playerIsPrior, setHouse } from './house';

/**
 * The prior's desk. E3 §3.2: the house's observance is the prior's to set,
 * its budget is held in common and controlled by him, and the offices of
 * the house are in his gift (§3.10). While the player holds the office
 * these are his levers; the rest of the time the sheet only shows what the
 * house's prior has done with them. Every option is data in
 * content/religious/priorDesk.json; tunables here are invented.
 */
export const PRIOR_DESK = {
  /** Points of observance the house moves toward the rule a week. */
  ruleDrift: 0.6,
  /** A house being moved rubs: standing with the house and its cohesion, per week, per ten points still to go. */
  movingFriction: { community: -0.04, cohesion: -0.06 },
  /** Setting a rule: each man of a mind moves toward or away from the prior by this much, once. */
  ruleRegard: 3,
  /** How far off the line a man must be to have a view. */
  ruleMind: 20,
  /** A filled office of the house lifts where its cohesion rests, up to this many offices. */
  officersBond: 1.5,
  officersMax: 4,
  /** Naming a man: his regard, and the regard of the better-fitted man passed over. */
  named: 5,
  passedOver: -3,
  /** An office left vacant a long time: the house notices. Weeks. */
  vacantNoticed: 52,
} as const;

export interface HouseRuleDef {
  id: string;
  label: string;
  observance: number;
  line: string;
}

export interface PurseDef {
  id: string;
  label: string;
  blurb: string;
  cost: number;
  cooldown: number;
  effects: Effect[];
  house?: { cohesion?: number; observance?: number };
  line: string;
}

export function houseRules(): HouseRuleDef[] {
  return priorDeskDefs.rules;
}

export function ruleOf(house: Pick<OrderHouse, 'rule'>): HouseRuleDef | undefined {
  return house.rule ? priorDeskDefs.rules.find((r) => r.id === house.rule) : undefined;
}

/** Whether the desk is his: the prior of the house he lives in. */
export function mayGovern(state: GameState): { ok: boolean; why: string } {
  const house = currentHouse(state);
  if (!state.religious || !house) return { ok: false, why: 'No house' };
  if (!playerIsPrior(state, house)) return { ok: false, why: 'The prior decides this' };
  return { ok: true, why: '' };
}

/** Set the rule of the house. The men have views. */
export function setHouseRule(state: GameState, ruleId: string): { state: GameState; line: string } {
  const may = mayGovern(state);
  const house = currentHouse(state)!;
  const rule = priorDeskDefs.rules.find((r) => r.id === ruleId);
  if (!may.ok || !rule) return { state, line: may.why };
  if (house.rule === ruleId) return { state, line: '' };
  const from = ruleOf(house)?.observance ?? house.observance;
  const direction = Math.sign(rule.observance - from);
  const npcs = { ...state.npcs };
  let liked = 0;
  let disliked = 0;
  if (direction !== 0) {
    for (const m of membersOf(state, house)) {
      if (Math.abs(m.alignment) < PRIOR_DESK.ruleMind) continue;
      // The men of the old observance want it stricter; the men for this century want it lighter.
      const agrees = (m.alignment < 0) === (direction > 0);
      npcs[m.id] = { ...m, relationship: Math.max(-100, Math.min(100, m.relationship + (agrees ? PRIOR_DESK.ruleRegard : -PRIOR_DESK.ruleRegard))) };
      if (agrees) liked += 1; else disliked += 1;
    }
  }
  const next: GameState = setHouse({ ...state, npcs, career: [...state.career, { week: state.clock.week, kind: 'note', text: `Set the house to ${rule.label.toLowerCase()}.` }] }, { ...house, rule: ruleId });
  const who = direction === 0 ? '' : liked || disliked ? ` ${liked ? `${liked === 1 ? 'One man' : `${liked} men`} of the house wanted this.` : ''}${disliked ? ` ${disliked === 1 ? 'One' : disliked} did not, and will say so.` : ''}` : '';
  return { state: next, line: `${rule.line}${who}` };
}

// ---- The offices of the house, in his gift ----

export interface OfficerRow {
  def: HouseOfficeDef;
  holder: Npc | null;
  /** The men who could hold it, best fit first, with what each is short of. */
  candidates: { npc: Npc; fit: number; short: string | null }[];
}

function shortOf(npc: Npc, requires: HouseOfficeDef['requires']): string | null {
  for (const [k, v] of Object.entries(requires ?? {})) if (npc.stats[k as StatKey] < (v ?? 0)) return k;
  return null;
}

function fitOf(npc: Npc, def: HouseOfficeDef): number {
  const keys = Object.keys(def.requires ?? {}) as StatKey[];
  if (!keys.length) return npc.stats.administration / 2 + npc.stats.piety / 2;
  return keys.reduce((n, k) => n + npc.stats[k], 0) / keys.length;
}

function eligible(state: GameState, npc: Npc, def: HouseOfficeDef): boolean {
  if (def.ordained && npc.title !== 'Fr.') return false;
  if (def.vows === 'solemn' && !npc.tags.includes('vows:solemn')) return false;
  if (def.vows === 'simple' && !npc.tags.includes('vows:simple') && !npc.tags.includes('vows:solemn')) return false;
  if (npc.tags.includes('vows:novice')) return false;
  return npc.status === 'active' && npc.id !== (currentHouse(state)?.priorId ?? '');
}

/** The offices of the house, who holds each, and who could. */
export function officerRows(state: GameState): OfficerRow[] {
  const r = state.religious;
  const house = currentHouse(state);
  if (!r || !house) return [];
  const members = membersOf(state, house);
  const held = new Set(Object.values(house.officers ?? {}));
  return religiousOrder(r.order).houseOffices.map((def) => {
    const holderId = house.officers?.[def.id];
    const holder = holderId ? members.find((m) => m.id === holderId) ?? null : null;
    const candidates = members
      .filter((m) => eligible(state, m, def) && (!held.has(m.id) || m.id === holderId))
      .map((npc) => ({ npc, fit: fitOf(npc, def), short: shortOf(npc, def.requires) }))
      .sort((a, b) => (a.short ? 1 : 0) - (b.short ? 1 : 0) || b.fit - a.fit || a.npc.id.localeCompare(b.npc.id));
    return { def, holder, candidates };
  });
}

/** Name a man to an office of the house, or leave it vacant with null. */
export function nameOfficer(state: GameState, officeId: string, npcId: string | null): { state: GameState; line: string } {
  const may = mayGovern(state);
  if (!may.ok) return { state, line: may.why };
  const house = currentHouse(state)!;
  const row = officerRows(state).find((o) => o.def.id === officeId);
  if (!row) return { state, line: 'No such office' };
  const officers = { ...(house.officers ?? {}) };
  const before = officers[officeId];
  if (npcId === before || (!npcId && !before)) return { state, line: '' };
  const npcs = { ...state.npcs };
  let line: string;
  if (!npcId) {
    delete officers[officeId];
    line = `${row.def.label} is vacant; the house will manage, and notice.`;
  } else {
    const pick = row.candidates.find((c) => c.npc.id === npcId);
    if (!pick || pick.short) return { state, line: pick ? `He has not the ${pick.short} for it.` : 'Not a man of the house' };
    officers[officeId] = npcId;
    npcs[npcId] = { ...pick.npc, relationship: Math.min(100, pick.npc.relationship + PRIOR_DESK.named) };
    const best = row.candidates.find((c) => !c.short && c.npc.id !== npcId && c.npc.id !== before);
    if (best && best.fit > pick.fit + 8) npcs[best.npc.id] = { ...best.npc, relationship: Math.max(-100, best.npc.relationship + PRIOR_DESK.passedOver) };
    line = `${pick.npc.title} ${pick.npc.name.last} is ${row.def.label.toLowerCase()}. ${row.def.line}${best && best.fit > pick.fit + 8 ? ` ${best.npc.title} ${best.npc.name.last}, who was better fitted, has noticed.` : ''}`;
  }
  const next = setHouse({ ...state, npcs, career: [...state.career, { week: state.clock.week, kind: 'note', text: npcId ? `Named ${npcs[npcId]!.title} ${npcs[npcId]!.name.last} ${row.def.label.toLowerCase()} of ${house.name}.` : `Left the office of ${row.def.label.toLowerCase()} vacant.` }] }, { ...house, officers });
  return { state: next, line };
}

/** How many of the house's offices are filled, for the cohesion rest. */
export function officersFilled(house: Pick<OrderHouse, 'officers'>): number {
  return Math.min(PRIOR_DESK.officersMax, Object.keys(house.officers ?? {}).length);
}

// ---- The purse ----

export interface PurseOffer {
  def: PurseDef;
  available: boolean;
  why: string;
}

export function purseOffers(state: GameState): PurseOffer[] {
  const house = currentHouse(state);
  if (!house) return [];
  const may = mayGovern(state);
  return priorDeskDefs.purse.map((def) => {
    if (!may.ok) return { def, available: false, why: may.why };
    const last = house.purse?.[def.id];
    if (typeof last === 'number' && state.clock.week - last < def.cooldown) return { def, available: false, why: `Done already; not again for ${Math.ceil((last + def.cooldown - state.clock.week) / 4)} months` };
    if (def.cost > house.budget) return { def, available: false, why: 'The house cannot afford it' };
    return { def, available: true, why: '' };
  });
}

/** Spend from the house's purse. */
export function spendPurse(state: GameState, id: string): { state: GameState; line: string } {
  const offer = purseOffers(state).find((o) => o.def.id === id);
  const house = currentHouse(state);
  if (!offer?.available || !house) return { state, line: offer?.why ?? 'No house' };
  const def = offer.def;
  let next = setHouse(state, { ...house, budget: house.budget - def.cost, purse: { ...(house.purse ?? {}), [id]: state.clock.week } });
  if (def.effects.length) next = applyEffects(next, def.effects, {}, def.label.toLowerCase());
  if (def.house) next = nudgeHouse(next, house.id, def.house);
  next = { ...next, career: [...next.career, { week: state.clock.week, kind: 'note', text: `From the house's purse: ${def.label.toLowerCase()}.` }] };
  return { state: next, line: def.line };
}

/** The blocks an elected office takes, from the order's data. */
export function electedOfficeLoad(state: Pick<GameState, 'religious'>): number {
  const r = state.religious;
  if (!r?.office) return 0;
  return religiousOrder(r.order).offices.find((o) => o.id === r.office!.office)?.ap ?? 0;
}

/**
 * One week of the prior's rule: the house moves toward it, and a house being
 * moved rubs against the man moving it. Runs for any house with a rule,
 * whoever set it; the friction lands on the player only when the desk is his.
 */
export function ruleWeek(state: GameState): GameState {
  const house = currentHouse(state);
  const rule = house ? ruleOf(house) : undefined;
  if (!house || !rule) return state;
  const gap = rule.observance - house.observance;
  if (Math.abs(gap) < 0.5) return state;
  const step = Math.sign(gap) * Math.min(Math.abs(gap), PRIOR_DESK.ruleDrift);
  let next = nudgeHouse(state, house.id, { observance: step });
  if (Math.abs(gap) >= 5 && playerIsPrior(state, house)) {
    const tens = Math.abs(gap) / 10;
    next = nudgeHouse(next, house.id, { cohesion: PRIOR_DESK.movingFriction.cohesion * tens });
    next = applyEffects(next, [{ target: 'reputation', key: 'community', delta: PRIOR_DESK.movingFriction.community * tens }], {}, 'a house being moved');
  }
  return next;
}
