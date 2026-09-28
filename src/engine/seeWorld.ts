import type { BishopProfile, GameState, Npc, SeeDef, SeeState, World } from '@/types';
import type { Rng } from './rng';
import { seeDef } from '@/content/sees';
import { presetById } from '@/content/dioceses';
import type { SynthSee } from '@/content/dioceses/synth';
import { generateDiocese } from '@/generation/diocese';
import { synthDiocese } from '@/generation/dioceseSynth';
import { namespaceDiocese } from '@/generation/province';
import { FAULTS, MANAGEMENT, PRIORITIES, TRAITS, rollLiturgicalPolicy, temperamentLine } from '@/generation/bishop';
import { dateOf } from './time';
import { seedSeminary } from '@/systems/bishop/seminary';
import { seedCouncil } from '@/systems/bishop/presbyterate';

/**
 * E4 R1.0 — the see as a place with people. A bishop's see is a world of its
 * own: a small see rolled by the diocese synthesizer from its city and
 * region, a great see its preset, with parishes, a presbyterate, a chancery,
 * and a bishop emeritus in the house behind the cathedral. The man is its
 * bishop: the hidden profile is his, the liturgical policy rolled around his
 * own reading. Home goes into the territory and waits, as a friar's other
 * dioceses do (E3 §3.1), and the selectors find his own priests.
 */
export const PLAYER_BISHOP_ID = 'player';

/** Where the man was ordained: the home diocese, by preset id, wherever `world` is now. */
export function homeDioceseId(state: GameState): string | undefined {
  return state.homeDioceseId ?? (state.see && state.world?.diocese.presetId === state.see.dioceseId ? undefined : state.world?.diocese.presetId);
}

/** The home diocese's world: `world` while he is at home, else its copy in the territory. */
export function homeWorld(state: GameState): World | undefined {
  const id = homeDioceseId(state);
  if (!id) return state.world ?? undefined;
  return state.world?.diocese.presetId === id ? state.world : state.territory?.[id];
}

/** The see's world, once it has been rolled: `world` while he holds it. */
export function seeWorld(state: GameState): World | undefined {
  const id = state.see?.dioceseId;
  if (!id) return undefined;
  return state.world?.diocese.presetId === id ? state.world : state.territory?.[id];
}

function synthSeeOf(def: SeeDef): SynthSee {
  const s = def.synth!;
  return { id: `see_${def.id}`, name: def.name.replace(/^the /, ''), see: def.see, state: s.state, region: s.region, lat: s.lat, lon: s.lon, size: s.size, latinoShare: s.latinoShare, growth: s.growth, climate: s.climate };
}

/** The bishop's own profile: his reading, a policy rolled around it, and the rest of a bishop's temper drawn once for the chair. */
export function playerBishopProfile(state: GameState, rng: Rng, year: number): BishopProfile {
  const c = state.character!;
  const alignment = c.alignment;
  const priorities = rng.shuffle(PRIORITIES).slice(0, 2) as [BishopProfile['priorities'][0], BishopProfile['priorities'][1]];
  const management = rng.pick(MANAGEMENT);
  const rewards = rng.pick(TRAITS);
  const cannotTolerate = rng.pick(FAULTS);
  return {
    npcId: PLAYER_BISHOP_ID,
    alignment,
    outspokenness: c.outspokenness,
    priorities,
    management,
    rewards,
    cannotTolerate,
    ambition: 0,
    knowsYou: 'none',
    installedYear: year,
    liturgy: rollLiturgicalPolicy(rng.derive('liturgy'), alignment, priorities, management),
  };
}

/** Roll the see's world, its people namespaced and tagged with the see so a selector knows whose priests are whose. */
export function generateSeeWorld(state: GameState, see: SeeState, rng: Rng): { world: World; npcs: Npc[]; presetId: string } {
  const def = seeDef(see.id);
  if (!def) throw new Error(`no see ${see.id}`);
  const year = dateOf(state.clock).year;
  const preset = presetById(def.id);
  const gen = preset ? { presetId: preset.id, preset, ...generateDiocese(rng.derive('diocese'), preset, year) } : synthDiocese(rng, synthSeeOf(def), year);
  const d = namespaceDiocese({ ...gen, generated: !preset });
  const world: World = { diocese: d.diocese, parishes: d.parishes, generatedYear: year, bishopHistory: [d.diocese.hidden.bishop.npcId], institutes: d.institutes ?? [] };
  return { world, npcs: d.npcs, presetId: d.presetId };
}

/** The people of the home diocese, tagged as its own before another diocese's come in beside them. */
function tagHome(npcs: Record<string, Npc>, homeId: string): Record<string, Npc> {
  const out = { ...npcs };
  for (const n of Object.values(out)) {
    if (!['priest', 'lay', 'official', 'bishop', 'religious'].includes(n.role)) continue;
    if (n.tags.some((t) => t.startsWith('diocese:'))) continue;
    // The people of a diocese, not the Church's: the nuncio, the Curia, the College, and an order's own government carry no diocese and keep none.
    if (n.tags.some((t) => ['nuncio', 'curia', 'cardinal', 'pope_secretary', 'visitor', 'general', 'provincial', 'commissary'].includes(t) || t.startsWith('curia') || t.startsWith('from:'))) continue;
    out[n.id] = { ...n, tags: [...n.tags, `diocese:${homeId}`] };
  }
  return out;
}

/**
 * Install the see as the man's world: the predecessor becomes bishop
 * emeritus, the man becomes the bishop of record, home (or the last see)
 * goes into the territory. Idempotent: a see already installed stays.
 */
export function installSeeWorld(state: GameState, rng: Rng): GameState {
  const see = state.see;
  if (!see || !state.world || !state.character) return state;
  if (see.dioceseId && state.world.diocese.presetId === see.dioceseId) return state;
  const year = dateOf(state.clock).year;
  const homeId = homeDioceseId(state) ?? state.world.diocese.presetId;
  const leaving = state.world;
  const territory = { ...(state.territory ?? {}) };
  const npcs = state.homeDioceseId ? { ...state.npcs } : tagHome(state.npcs, homeId);
  // A diocese he already holds in the territory (a friar's province spans it): it is the one he knows.
  const stashed = territory[see.id];
  let world: World;
  let presetId: string;
  if (stashed) {
    world = stashed;
    presetId = see.id;
    delete territory[see.id];
  } else {
    const gen = generateSeeWorld(state, see, rng.derive(`see-world:${see.id}`));
    world = gen.world;
    presetId = gen.presetId;
    for (const n of gen.npcs) npcs[n.id] = n;
  }
  // The man in the chair: the predecessor retires to the house behind the cathedral.
  const predecessorId = world.diocese.hidden.bishop.npcId;
  const pred = npcs[predecessorId];
  if (pred && pred.id !== PLAYER_BISHOP_ID) npcs[pred.id] = { ...pred, status: 'retired', tags: [...pred.tags.filter((t) => t !== 'bishop'), 'bishop_emeritus'] };
  const profile = playerBishopProfile(state, rng.derive(`bishop-profile:${see.id}`), year);
  const c = state.character;
  const age = year - (c.entryYear - c.background.entryAge);
  const diocese = {
    ...world.diocese,
    hidden: { ...world.diocese.hidden, bishop: profile },
    visible: { ...world.diocese.visible, bishop: { npcId: PLAYER_BISHOP_ID, name: `Bishop ${c.name.first} ${c.name.last}`, age, yearsInOffice: 0, temperamentLine: temperamentLine(rng.derive(`bishop-line:${see.id}`), profile), priorities: profile.priorities } },
  };
  const seeWorldNow: World = { ...world, diocese, bishopHistory: [...world.bishopHistory.filter((id) => id !== PLAYER_BISHOP_ID), PLAYER_BISHOP_ID] };
  territory[leaving.diocese.presetId] = leaving;
  const flags: GameState['flags'] = { ...state.flags };
  for (const k of Object.keys(flags)) if (k.startsWith('diocese:')) delete flags[k];
  flags[`diocese:${presetId}`] = true;
  const installed: GameState = { ...state, npcs, world: seeWorldNow, territory, flags, homeDioceseId: homeId, see: { ...see, dioceseId: presetId } };
  // The seminary as the chair finds it: men across the years. E4 R1.4.
  const withSeminary: GameState = { ...installed, see: { ...installed.see!, seminary: installed.see!.seminary ?? seedSeminary(installed, rng.derive(`seminary:${see.id}`)) } };
  // The council of priests as the chair finds it. E4 R1.5.
  return seedCouncil(withSeminary, rng.derive(`council:${see.id}`));
}
