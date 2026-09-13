import type { Effect, GameState, Group, GroupType, LeaderAgenda, Npc, Parish, Vitality } from '@/types';
import type { Rng } from '@/engine/rng';
import { groupTypeDef, groupTypeDefs } from '@/content/parish';
import { applyEffects } from '@/engine/effects';
import { generateParishPeople } from '@/generation/parishPeople';

/** Tunables. DESIGN §10; numbers invented. */
export const GROUPS = {
  perParish: [3, 6] as [number, number],
  /** Vitality lost per week with no attention. */
  decayPerWeek: 0.5,
  /** Vitality gained per AP of sustaining, before friction. */
  vitalityPerAp: 4,
  /** Alignment gap beyond which sustaining is half as effective and the leader cools. */
  frictionGap: 50,
  suppressedDecay: 3,
  /** Chance per week that the leader of a suppressed group calls the chancery. */
  suppressedComplaintChance: 0.08,
  /** Founding: chance a leader is found, from charisma and lay support. */
  foundingBase: 0.35,
} as const;

export function vitalityBand(v: number): Vitality {
  if (v >= 70) return 'thriving';
  if (v >= 40) return 'steady';
  if (v >= 15) return 'declining';
  return 'dying';
}

const BAND_SCALE: Record<Vitality, number> = { thriving: 1, steady: 0.5, declining: 0, dying: -0.3 };
const AGENDAS: LeaderAgenda[] = ['saintly', 'empire', 'political', 'tired', 'new', 'grieving'];

/** A lay leader NPC for a group, drawn from the parish's people or made fresh. */
function makeLeader(rng: Rng, state: GameState, parish: Parish, group: Pick<Group, 'id' | 'alignment'>, year: number): Npc {
  const presetId = state.world!.diocese.presetId;
  const fresh = generateParishPeople(rng.derive(`leader:${group.id}`), parish, presetId, year).filter((n) => n.tags.includes('parishioner'))[0]!;
  return {
    ...fresh,
    id: `${group.id}_leader`,
    alignment: Math.max(-100, Math.min(100, group.alignment + rng.int(-15, 15))),
    tags: [`leader:${group.id}`, `parish:${parish.id}`, 'lay_leader'],
  };
}

/** Three to six groups for a parish, each with a named leader. DESIGN §10 */
export function generateGroups(rng: Rng, state: GameState, parish: Parish, year: number): { groups: Group[]; leaders: Npc[] } {
  const count = rng.int(GROUPS.perParish[0], GROUPS.perParish[1]);
  const defs = groupTypeDefs.filter((d) => (d.weights[parish.kind] ?? 0) > 0);
  const chosen: GroupType[] = [];
  let pool = defs;
  while (chosen.length < count && pool.length) {
    const d = rng.weighted(pool, (x) => x.weights[parish.kind] ?? 0);
    chosen.push(d.type);
    pool = pool.filter((x) => x.type !== d.type);
  }
  const groups: Group[] = [];
  const leaders: Npc[] = [];
  chosen.forEach((type, i) => {
    const def = groupTypeDef(type);
    const id = `${parish.id}_g${i + 1}`;
    const alignment = Math.max(-100, Math.min(100, Math.round(def.alignmentMean + parish.alignment * 0.3 + rng.gaussian() * 20)));
    const partial = { id, alignment };
    const leader = makeLeader(rng, state, parish, partial, year);
    const name = type === 'ethnic_community' ? ethnicName(parish, rng, def.names) : rng.pick(def.names);
    groups.push({
      id,
      parishId: parish.id,
      type,
      name,
      size: rng.int(6, Math.max(8, Math.round(parish.households / 40))),
      vitality: rng.int(15, 90),
      leaderId: leader.id,
      agenda: rng.pick(AGENDAS),
      alignment,
      foundedByPlayer: false,
      foundedWeek: state.clock.week - rng.int(52, 52 * 25),
      suppressed: false,
      hostile: false,
    });
    leaders.push(leader);
  });
  return { groups, leaders };
}

function ethnicName(parish: Parish, rng: Rng, names: string[]): string {
  const top = Object.entries(parish.ethnic).sort((a, b) => b[1] - a[1])[0]?.[0];
  const map: Record<string, string> = { latino: 'Hispanic Community', vietnamese: 'Vietnamese Community', filipino: 'Filipino Community', polish: 'Polish Community', nigerian: 'Nigerian Community', korean: 'Korean Community', indian: 'Syro-Malabar Community' };
  return (top && map[top]) ?? rng.pick(names);
}

export function parishGroups(state: GameState): Group[] {
  const pid = state.assignment?.parishId;
  return Object.values(state.groups).filter((g) => g.parishId === pid).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Mean vitality of the groups the player still supports, or 50 with none. */
export function averageVitality(state: GameState): number {
  const live = parishGroups(state).filter((g) => !g.suppressed);
  if (live.length === 0) return 50;
  return live.reduce((n, g) => n + g.vitality, 0) / live.length;
}

/**
 * How the sustaining hours are shared out: focused groups take all of it
 * between them; with none focused, every group the player still supports
 * gets an equal share.
 */
export function sustainShares(state: GameState, sustainAp: number): Record<string, number> {
  const active = parishGroups(state).filter((g) => !g.suppressed && !g.hostile);
  const focused = active.filter((g) => g.focus);
  const takers = focused.length ? focused : active;
  const out: Record<string, number> = {};
  if (!takers.length || sustainAp <= 0) return out;
  for (const g of takers) out[g.id] = sustainAp / takers.length;
  return out;
}

function frictionFor(g: Group, playerAlignment: number): number {
  return Math.abs(g.alignment - playerAlignment) > GROUPS.frictionGap ? 0.5 : 1;
}

/** Expected vitality change a week for a group under the current routine; what the sheet shows. */
export function groupTrend(state: GameState, g: Group, sustainAp: number): number {
  if (g.suppressed) return -(GROUPS.decayPerWeek + GROUPS.suppressedDecay);
  if (g.hostile || !state.character) return -GROUPS.decayPerWeek;
  const share = sustainShares(state, sustainAp)[g.id] ?? 0;
  return share * GROUPS.vitalityPerAp * frictionFor(g, state.character.alignment) - GROUPS.decayPerWeek;
}

/** Single a group out for the sustaining hours, or stop. */
export function focusGroup(state: GameState, groupId: string, focus = true): GameState {
  const g = state.groups[groupId];
  if (!g) return state;
  return { ...state, groups: { ...state.groups, [groupId]: { ...g, focus } } };
}

/** AP of obligation relief thriving groups provide. DESIGN §10.2 */
export function groupRelief(state: GameState): Partial<Record<'sacramental_prep' | 'confessions' | 'meetings', number>> {
  const out: Partial<Record<'sacramental_prep' | 'confessions' | 'meetings', number>> = {};
  for (const g of parishGroups(state)) {
    const def = groupTypeDef(g.type);
    if (def.relieves && vitalityBand(g.vitality) === 'thriving' && !g.hostile) out[def.relieves] = 1;
  }
  return out;
}

function scaled(effects: Effect[], factor: number): Effect[] {
  return effects.map((e) => (e.delta !== undefined ? { ...e, delta: e.delta * factor } : e));
}

/**
 * One week of group life: decay, the sustaining AP spread across the
 * groups, alignment friction, benefits by band, and suppressed groups
 * withering while their leaders complain.
 */
export function groupsWeek(state: GameState, sustainAp: number, rng: Rng): { state: GameState; lines: string[] } {
  const groups = parishGroups(state);
  if (groups.length === 0 || !state.character) return { state, lines: [] };
  const lines: string[] = [];
  let next = state;
  const shares = sustainShares(state, sustainAp);
  const updated: Record<string, Group> = { ...state.groups };
  const playerAlignment = state.character.alignment;

  for (const g of groups) {
    let v = g.vitality - GROUPS.decayPerWeek;
    if (g.suppressed) {
      v -= GROUPS.suppressedDecay;
      if (rng.chance(GROUPS.suppressedComplaintChance)) {
        next = applyEffects(next, [
          { target: 'reputation', key: 'chancery', delta: -2 },
          { target: 'reputation', key: 'parishioners', delta: -1 },
        ]);
        lines.push(`${g.name}: its leader has written to the chancery about you.`);
      }
    } else if (!g.hostile && (shares[g.id] ?? 0) > 0) {
      const gap = Math.abs(g.alignment - playerAlignment);
      v += shares[g.id]! * GROUPS.vitalityPerAp * frictionFor(g, playerAlignment);
      if (gap > GROUPS.frictionGap) {
        const leader = next.npcs[g.leaderId];
        if (leader) next = { ...next, npcs: { ...next.npcs, [leader.id]: { ...leader, relationship: Math.max(-100, leader.relationship - 0.3) } } };
      }
    }
    v = Math.max(0, Math.min(100, v));
    const band = vitalityBand(v);
    const def = groupTypeDef(g.type);
    if (!g.suppressed) next = applyEffects(next, scaled(def.benefit, BAND_SCALE[band]), {}, g.name);
    if (vitalityBand(g.vitality) !== band) {
      lines.push(`${g.name} is ${band === 'dying' ? 'dying' : band === 'declining' ? 'fading' : band === 'steady' ? 'steady again' : 'thriving'}.`);
    }
    updated[g.id] = { ...g, vitality: v };
    if (v <= 0 && g.suppressed) {
      delete updated[g.id];
      lines.push(`${g.name} has quietly ceased to exist.`);
    }
  }
  return { state: { ...next, groups: updated }, lines };
}

/** Withdraw support. Politically expensive: the leader will call the chancery. DESIGN §10.1 */
export function suppressGroup(state: GameState, groupId: string, suppressed = true): GameState {
  const g = state.groups[groupId];
  if (!g) return state;
  return { ...state, groups: { ...state.groups, [groupId]: { ...g, suppressed } } };
}

/** Begin founding a group: months of AP, and it can fail. DESIGN §10.1 */
export function startFounding(state: GameState, type: GroupType): GameState {
  if (state.founding || !state.parish) throw new Error('already founding something');
  if (parishGroups(state).some((g) => g.type === type)) throw new Error('the parish already has one');
  const def = groupTypeDef(type);
  return {
    ...state,
    founding: { type, startWeek: state.clock.week, endWeek: state.clock.week + def.founding.weeks, apPerWeek: def.founding.apPerWeek, leaderFound: null },
  };
}

/** Resolve a founding that has run its course. */
export function finishFounding(state: GameState, rng: Rng, year: number): { state: GameState; line: string | null } {
  const f = state.founding;
  if (!f || state.clock.week < f.endWeek || !state.parish || !state.world || !state.character) return { state, line: null };
  const parish = state.world.parishes.find((p) => p.id === state.parish!.parishId)!;
  const c = state.character;
  const chance = Math.min(0.95, GROUPS.foundingBase + c.stats.charisma / 200 + c.reputation.parishioners / 250);
  const found = rng.chance(chance);
  const def = groupTypeDef(f.type);
  if (!found) {
    return {
      state: { ...state, founding: null, flags: { ...state.flags, [`founding_failed:${f.type}`]: true } },
      line: `No one would lead the ${def.label.toLowerCase()}; it did not take.`,
    };
  }
  const id = `${parish.id}_p${state.clock.week}`;
  const alignment = Math.round((def.alignmentMean + c.alignment) / 2);
  const leader = makeLeader(rng, state, parish, { id, alignment }, year);
  const group: Group = {
    id,
    parishId: parish.id,
    type: f.type,
    name: rng.pick(def.names),
    size: rng.int(5, 12),
    vitality: 55,
    leaderId: leader.id,
    agenda: 'new',
    alignment,
    foundedByPlayer: true,
    foundedWeek: state.clock.week,
    suppressed: false,
    hostile: false,
  };
  return {
    state: { ...state, founding: null, groups: { ...state.groups, [id]: group }, npcs: { ...state.npcs, [leader.id]: leader } },
    line: `${group.name} met for the first time; ${leader.name.first} ${leader.name.last} agreed to lead it.`,
  };
}

/** Replacing a leader costs the parish something and the old leader more. Invented. */
export const REPLACE = { vitalityDip: 10, oldLeaderRelationship: -35, hostileChance: { empire: 0.6, political: 0.45, saintly: 0.25, grieving: 0.2, new: 0.15, tired: 0.05 } as Record<LeaderAgenda, number>, peopleCost: -2, pull: 0.4 } as const;

/** Who may replace a leader: the pastor, or a vicar the pastor trusts with the groups. */
export function mayReplaceLeader(state: GameState): { ok: boolean; why: string | null } {
  if (!state.parish) return { ok: false, why: null };
  if (state.parish.role !== 'parochial_vicar') return { ok: true, why: null };
  const rec = state.world?.parishes.find((p) => p.id === state.parish!.parishId);
  const pastor = rec ? state.npcs[rec.pastorId] : undefined;
  if (pastor && pastor.relationship < 30) return { ok: false, why: `The groups are ${pastor.title} ${pastor.name.last}'s to staff, not yours. Earn his trust first.` };
  return { ok: true, why: null };
}

/**
 * Put a new leader over a group. The old one is hurt and may turn; the
 * group dips, then follows the new leader, who is nearer to the pastor's
 * own mind. Some people liked the old one.
 */
export function replaceLeader(state: GameState, groupId: string, rng: Rng, year: number): { state: GameState; line: string } {
  const g = state.groups[groupId];
  const parish = state.world?.parishes.find((p) => p.id === g?.parishId);
  const c = state.character;
  if (!g || !parish || !c) throw new Error('no such group');
  const may = mayReplaceLeader(state);
  if (!may.ok) throw new Error(may.why ?? 'not yours to do');
  const old = state.npcs[g.leaderId];
  const alignment = Math.round(g.alignment + (c.alignment - g.alignment) * REPLACE.pull);
  const fresh = makeLeader(rng, state, parish, { id: `${g.id}_${state.clock.week}`, alignment }, year);
  const leader: Npc = { ...fresh, id: `${g.id}_leader_${state.clock.week}`, relationship: 15 };
  const hostile = old ? rng.chance(REPLACE.hostileChance[g.agenda]) : false;
  const npcs = { ...state.npcs, [leader.id]: leader };
  if (old) npcs[old.id] = { ...old, relationship: Math.max(-100, old.relationship + REPLACE.oldLeaderRelationship), tags: old.tags.filter((t) => !t.startsWith('leader:')) };
  const group: Group = { ...g, leaderId: leader.id, agenda: 'new', alignment, vitality: Math.max(0, g.vitality - REPLACE.vitalityDip), hostile: g.hostile || hostile };
  let next: GameState = { ...state, npcs, groups: { ...state.groups, [g.id]: group } };
  if (g.agenda !== 'empire' && g.agenda !== 'tired') next = applyEffects(next, [{ target: 'reputation', key: 'parishioners', delta: REPLACE.peopleCost }]);
  const oldName = old ? `${old.name.first} ${old.name.last}` : 'the old leader';
  const line = hostile
    ? `${oldName} was thanked for years of service to ${g.name} and did not take it well. ${leader.name.first} ${leader.name.last} has the keys; ${oldName} has the phone tree.`
    : g.agenda === 'tired'
      ? `${oldName} handed ${g.name} to ${leader.name.first} ${leader.name.last} with something like relief.`
      : `${leader.name.first} ${leader.name.last} leads ${g.name} now. ${oldName} was thanked from the pulpit and sat very still.`;
  next = { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `Put ${leader.name.first} ${leader.name.last} over ${g.name}.` }] };
  return { state: next, line };
}
