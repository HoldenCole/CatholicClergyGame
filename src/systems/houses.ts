import type { GameState, HouseArrangement, HouseAskId, HouseFavourId, HouseStanding, Npc, ObligationKey, ReligiousHouse } from '@/types';
import type { HouseAskDef, HouseFavourDef } from '@/types';
import type { Rng } from '@/engine/rng';
import { houseAsks as HOUSE_ASKS, houseFavours as HOUSE_FAVOURS } from '@/content/parish';
import { profileForHouse } from '@/content/orders';
import { applyEffects } from '@/engine/effects';
import { religiousRoleLine } from '@/generation/institutes';

/**
 * The order next door. DESIGN.md §9.4a.
 *
 * The house was here before the pastor and will be here after him, it answers
 * to a provincial in another state, and everything it does for his parish is a
 * favour rather than a duty. Standing is built by turning up and by saying yes
 * when they ask, and it is spent on help the diocese cannot give him. Numbers
 * invented; the asymmetries are the design's.
 */
export const HOUSES = {
  /** Regard an hour a week at the house is worth. */
  perHour: 0.9,
  /** Regard lost a week when nobody goes: they do not chase a parish priest. */
  driftPerWeek: 0.06,
  /** Regard a favour costs beyond its bar: asking spends what it took to build. */
  askCost: 6,
  /** Regard for saying yes to an ask of theirs, and for saying no. */
  yesRegard: 12,
  noRegard: -9,
  /** Weeks an ask stands before silence answers it. */
  askWeeks: 6,
  /** The chance a house asks the parish for something in a given year. */
  askPerYear: 0.5,
  /** The chance a provincial ends an arrangement in a given year, less the regard held. */
  withdrawPerYear: 0.12,
  withdrawPerRegard: 0.0009,
  /** Blocks of the week a religious priest in the rectory gives back. */
  vicarRelief: 2,
  /** What a standing confessor takes off the confessions obligation. */
  confessorRelief: 0.75,
  /** Weeks between missions: a parish mission is not an annual event. */
  missionCooldown: 52 * 4,
  /** What a chair at the Augustinians' table takes off the week's wear. DESIGN §9.4b. */
  tableRelief: 0.6,
} as const;

export function favourDef(id: HouseFavourId): HouseFavourDef | undefined {
  return HOUSE_FAVOURS.find((f) => f.id === id);
}

export function askDef(id: HouseAskId): HouseAskDef | undefined {
  return HOUSE_ASKS.find((a) => a.id === id);
}

export function housesOf(state: GameState): ReligiousHouse[] {
  return state.world?.diocese.visible.houses ?? [];
}

export function standingOf(state: GameState, houseId: string): HouseStanding {
  return state.houses?.[houseId] ?? { houseId, regard: 0, sinceWeek: state.clock.week, asked: 0, given: 0, arrangements: [] };
}

function withStanding(state: GameState, s: HouseStanding): GameState {
  return { ...state, houses: { ...(state.houses ?? {}), [s.houseId]: s } };
}

export function regardWord(v: number): string {
  return v >= 70 ? 'they count you one of their own' :
    v >= 45 ? 'they are glad when your car is in the yard' :
    v >= 20 ? 'they know you and would do you a favour' :
    v >= 5 ? 'you have been there once or twice' :
    v > -15 ? 'a name on the deanery list' :
    'they are careful with you';
}

export function hasArrangement(state: GameState, id: HouseFavourId): boolean {
  return Object.values(state.houses ?? {}).some((s) => s.arrangements.some((a) => a.id === id));
}

/** The house a standing arrangement comes from. */
export function houseWith(state: GameState, id: HouseFavourId): ReligiousHouse | undefined {
  const standing = Object.values(state.houses ?? {}).find((s) => s.arrangements.some((a) => a.id === id));
  return standing ? housesOf(state).find((h) => h.id === standing.houseId) : undefined;
}

/** What a standing confessor takes off the week. Merged with the groups' relief. */
export function houseRelief(state: GameState): Partial<Record<ObligationKey, number>> {
  return hasArrangement(state, 'confessor') ? { confessions: HOUSES.confessorRelief } : {};
}

/** Blocks of the week an order priest in the rectory gives back. */
export function houseHelp(state: GameState): number {
  return hasArrangement(state, 'vicar') ? HOUSES.vicarRelief : 0;
}

/** Whether a week away is covered by the house, so the parish pays no supply priest. */
export function houseCoversSupply(state: GameState): boolean {
  return hasArrangement(state, 'supply');
}

export interface FavourOffer {
  house: ReligiousHouse;
  def: HouseFavourDef;
  available: boolean;
  /** Why not, when it is not. */
  why: string;
  standing: boolean;
}

/** Every favour of every house, with what stands in the way of each. */
export function favourOffers(state: GameState): FavourOffer[] {
  const out: FavourOffer[] = [];
  for (const house of housesOf(state)) {
    const s = standingOf(state, house.id);
    for (const def of HOUSE_FAVOURS) {
      const running = s.arrangements.some((a) => a.id === def.id);
      const last = s.lastUsed?.[def.id];
      const why =
        def.order && def.order !== house.order ? `Only ${profileForHouse({ order: def.order })?.short ?? 'one order'} do that` :
        def.charism && def.charism !== house.charism ? `${house.charism === 'contemplative' ? 'A contemplative house does not do it' : 'An active house is not what this asks for'}` :
        running ? 'Running now' :
        s.regard < def.bar ? `Needs ${regardWord(def.bar)}` :
        def.cooldown && typeof last === 'number' && state.clock.week - last < def.cooldown ? `Not again for ${Math.ceil((def.cooldown - (state.clock.week - last)) / 52)} year${def.cooldown - (state.clock.week - last) > 52 ? 's' : ''}` :
        def.money && (state.parish?.finance.cash ?? 0) < def.money ? 'The parish cannot pay for it' :
        !state.parish ? 'You have no parish to bring them to' :
        '';
      out.push({ house, def, available: !why, why, standing: running });
    }
  }
  return out;
}

/** A man of the house, for an arrangement that is a man rather than a promise: the one whose job it is, when the order has one. */
function manOf(state: GameState, house: ReligiousHouse, rng: Rng, role?: string): Npc | undefined {
  const pool = Object.values(state.npcs).filter((n) => n.status === 'active' && n.role === 'religious' && (!house.instituteId || n.institute === house.instituteId));
  const own = role ? pool.find((n) => n.tags.includes(`religious:${role}`)) : undefined;
  if (own) return own;
  return pool.length ? rng.pick([...pool].sort((a, b) => a.id.localeCompare(b.id))) : undefined;
}

export interface FavourResult {
  state: GameState;
  line: string;
}

/** Ask, and be given. The asking itself spends some of what was built. */
export function askFavour(state: GameState, houseId: string, id: HouseFavourId, rng: Rng): FavourResult {
  const house = housesOf(state).find((h) => h.id === houseId);
  const def = favourDef(id);
  if (!house || !def) throw new Error('no such house or favour');
  const offer = favourOffers(state).find((o) => o.house.id === houseId && o.def.id === id);
  if (!offer?.available) throw new Error(offer?.why || 'they will not do that');
  const s = standingOf(state, houseId);
  const man = def.standing || def.role ? manOf(state, house, rng.derive(`man:${houseId}:${id}`), def.role) : undefined;
  const arrangement: HouseArrangement | null = def.standing ? { id, since: state.clock.week, ...(man ? { npcId: man.id } : {}) } : null;
  const next: HouseStanding = {
    ...s,
    regard: Math.max(-100, s.regard - HOUSES.askCost),
    asked: s.asked + 1,
    arrangements: arrangement ? [...s.arrangements, arrangement] : s.arrangements,
    lastUsed: { ...(s.lastUsed ?? {}), [id]: state.clock.week },
  };
  let out = withStanding(state, next);
  if (def.money && out.parish) {
    out = { ...out, parish: { ...out.parish, finance: { ...out.parish.finance, cash: out.parish.finance.cash - def.money } } };
  }
  // What the favour does to the parish is authored on it (CLAUDE.md rule 1); a running one leaves a flag scenes can read.
  if (def.effects?.length) out = applyEffects(out, def.effects, {}, def.label);
  if (arrangement) out = { ...out, flags: { ...out.flags, [`house:${id}`]: true } };
  const who = man ? `${man.title || 'Fr.'} ${man.name.last}` : house.name;
  const own = profileForHouse(house)?.lines[id];
  const line = own ? own.replace(/\{who\}/g, who).replace(/\{house\}/g, house.name) :
    id === 'prayers' ? `${house.name} has written the parish into the book, for a year, and the prior read the name out at Vespers on the day it went in.` :
    id === 'confessor' ? `${who} will drive out for the Saturday hours from now on, and says he would rather do that than most of what he is asked to do.` :
    id === 'retreat' ? `Eight days in the guest wing at ${house.name}, at their table, for nothing, with a director who has heard everything.` :
    id === 'mission' ? `${house.name} will preach the mission in Lent: five nights, their man, and confessions until it is finished.` :
    id === 'supply' ? `${house.name} will cover your Masses when you are away, and will not hear of a stipend for it.` :
    `The provincial has assigned ${who} to the parish. He keeps his rule and his habit and answers to a man in another state, and he is a second priest in the house.`;
  return { state: { ...out, career: [...out.career, { week: state.clock.week, kind: 'note', text: `Asked ${house.name}: ${def.label.toLowerCase()}.` }] }, line };
}

/** The house asks the parish for something. One at a time, per house. */
export function raiseHouseAsk(state: GameState, rng: Rng): { state: GameState; line: string | null } {
  const live = housesOf(state).filter((h) => {
    const s = standingOf(state, h.id);
    return !s.ask && s.regard >= 10;
  });
  if (!live.length || !state.parish) return { state, line: null };
  const house = rng.pick([...live].sort((a, b) => a.id.localeCompare(b.id)));
  const pool = HOUSE_ASKS.filter((a) => (!a.charism || a.charism === house.charism) && (!a.order || a.order === house.order));
  const ask = rng.pick(pool);
  const s = standingOf(state, house.id);
  return {
    state: withStanding(state, { ...s, ask: { id: ask.id, week: state.clock.week, dueWeek: state.clock.week + HOUSES.askWeeks } }),
    line: `${house.name} has asked the parish for something: ${ask.blurb}`,
  };
}

/** Yes or no to an ask. Silence is a no, and is answered by the clock. */
export function answerAsk(state: GameState, houseId: string, yes: boolean): { state: GameState; line: string } {
  const s = standingOf(state, houseId);
  const house = housesOf(state).find((h) => h.id === houseId);
  const def = s.ask ? askDef(s.ask.id) : undefined;
  if (!s.ask || !def || !house) return { state, line: '' };
  const { ask: _ask, ...rest } = s;
  let next = withStanding(state, { ...rest, regard: Math.max(-100, Math.min(100, s.regard + (yes ? HOUSES.yesRegard : HOUSES.noRegard))), given: s.given + (yes ? 1 : 0) });
  if (yes && def.money && next.parish) {
    next = { ...next, parish: { ...next.parish, finance: { ...next.parish.finance, cash: next.parish.finance.cash - def.money } } };
  }
  if (yes && def.ap) next = { ...next, flags: { ...next.flags, [`house:serving:${houseId}`]: true } };
  const line = yes
    ? `You said yes to ${house.name}. ${def.costs.charAt(0).toUpperCase()}${def.costs.slice(1)}: they will remember it for longer than you will.`
    : `You said no to ${house.name}, which is allowed and is noticed. Nobody is rude about it; the next favour is a little further away.`;
  return { state: { ...next, career: [...next.career, { week: next.clock.week, kind: 'note', text: `${yes ? 'Said yes to' : 'Refused'} ${house.name}: ${def.label.toLowerCase()}.` }] }, line };
}

/** An hour a week in the guesthouse or the priory parlor, and what it builds. */
export function houseWeek(state: GameState, hours: number): GameState {
  const houses = housesOf(state);
  if (!houses.length) return state;
  let next = state;
  for (const h of houses) {
    const s = standingOf(next, h.id);
    const running = s.arrangements.length > 0;
    // Nobody chases a parish priest: a relationship nobody keeps up cools toward indifference,
    // slower where a man of theirs is in the parish, and never past it into dislike.
    const drift = s.regard > 0 ? -Math.min(s.regard, HOUSES.driftPerWeek * (running ? 0.4 : 1)) : 0;
    const gain = hours > 0 && h.id === nearestHouse(next)?.id ? HOUSES.perHour * hours * 4 : 0;
    const regard = Math.max(-100, Math.min(100, s.regard + gain + drift));
    if (regard !== s.regard) next = withStanding(next, { ...s, regard });
  }
  // A chair at their table on Thursdays: the one arrangement that does nothing for the parish and something for the man.
  if (hasArrangement(next, 'common_table') && (next.strain ?? 0) > 0) next = { ...next, strain: Math.max(0, (next.strain ?? 0) - HOUSES.tableRelief) };
  return next;
}

/** The house an hour goes to: the one he already knows best, or the nearest kind of house to a parish. */
export function nearestHouse(state: GameState): ReligiousHouse | undefined {
  const houses = housesOf(state);
  if (!houses.length) return undefined;
  const known = [...houses].sort((a, b) => standingOf(state, b.id).regard - standingOf(state, a.id).regard)[0]!;
  return known;
}

/** A year: the provincial decides something, and a house may ask for something. */
export function housesYear(state: GameState, rng: Rng): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  for (const house of housesOf(next)) {
    const s = standingOf(next, house.id);
    if (!s.arrangements.length) continue;
    const chance = Math.max(0.02, HOUSES.withdrawPerYear - Math.max(0, s.regard) * HOUSES.withdrawPerRegard);
    if (!rng.derive(`withdraw:${house.id}:${next.clock.week}`).chance(chance)) continue;
    const gone = rng.derive(`which:${house.id}`).pick([...s.arrangements].sort((a, b) => a.id.localeCompare(b.id)));
    const npc = gone.npcId ? next.npcs[gone.npcId] : undefined;
    next = withStanding(next, { ...s, arrangements: s.arrangements.filter((a) => a !== gone) });
    const { [`house:${gone.id}`]: _ended, ...flags } = next.flags;
    next = { ...next, flags };
    lines.push(
      gone.id === 'vicar'
        ? `${house.name} has recalled ${npc ? `${npc.title || 'Fr.'} ${npc.name.last}` : 'their man'}: a chapter in another state, a house that needs him more, six weeks' notice. You are on your own again.`
        : gone.id === 'confessor'
          ? `The Saturday confessor will not be coming after Easter; their community is down two men and the provincial has done the arithmetic.`
          : gone.id === 'kitchen'
            ? `The friars have had to close the Tuesday kitchen in the hall: the brother who ran it has been moved, and the line down the block will find the friary's own door.`
            : gone.id === 'common_table'
              ? `The prior has written, kindly, that the table is the community's and the community has asked for it back. There is no Thursday now.`
              : `${house.name} has had to end the arrangement. Nobody is at fault and it is not appealable.`,
    );
  }
  const asked = rng.derive(`ask:${next.clock.week}`).chance(HOUSES.askPerYear) ? raiseHouseAsk(next, rng.derive(`which-ask:${next.clock.week}`)) : { state: next, line: null };
  next = asked.state;
  if (asked.line) lines.push(asked.line);
  return { state: next, lines };
}

/** An ask that was never answered: the clock says no for him. */
export function expireAsks(state: GameState): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  for (const s of Object.values(next.houses ?? {})) {
    if (!s.ask || next.clock.week < s.ask.dueWeek) continue;
    const answered = answerAsk(next, s.houseId, false);
    next = answered.state;
    const house = housesOf(next).find((h) => h.id === s.houseId);
    lines.push(`${house?.name ?? 'The house'} did not hear back about what they asked, and has made other arrangements.`);
  }
  return { state: next, lines };
}

/** The people of a house, for the sheet: the men and women tagged with it, and what each does. */
export function castOf(state: GameState, house: ReligiousHouse): { npc: Npc; line: string }[] {
  return Object.values(state.npcs)
    .filter((n) => n.status === 'active' && n.tags.includes(`house:${house.id}`))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((npc) => ({ npc, line: religiousRoleLine(npc) ?? 'of the house' }));
}

/** What kind of house it is, in the order's own words, when the order is one told apart. DESIGN §9.4b. */
export function houseKindLine(house: ReligiousHouse): string | undefined {
  const p = profileForHouse(house);
  if (!p) return undefined;
  return `A ${p.house} under a ${p.superior}; ${p.governance}. The family: ${p.family}. ${p.habit.charAt(0).toUpperCase()}${p.habit.slice(1)}.`;
}

/** How the thing stands, for the sheet. */
export function houseLine(state: GameState, house: ReligiousHouse): string {
  const s = standingOf(state, house.id);
  const running = s.arrangements.map((a) => favourDef(a.id)?.label.toLowerCase().replace(/^ask (the provincial )?for /, '').replace(/^ask them to /, '').replace(/^take your own /, '')).filter(Boolean);
  const years = s.regard !== 0 || s.asked ? Math.round((state.clock.week - s.sinceWeek) / 52) : 0;
  return `${regardWord(s.regard)}${years >= 2 ? `, ${years} years of it` : ''}${running.length ? `. Standing: ${running.join(', ')}` : ''}.`;
}
