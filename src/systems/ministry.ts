import type { GameState, Ministry, MinistryKey, Parish, Quality } from '@/types';
import { MINISTRY_KEYS } from '@/types';
import { studyProgram } from '@/content/study';

/**
 * The book: what a ministry adds up to. DESIGN.md §8.6.
 *
 * Counted from the week as it was actually worked, not rolled: the same seed
 * and the same choices give the same book. Rates are per thousand households
 * per year, drawn from what an American parish of that size actually records,
 * and shared out among the priests in the house.
 */
export const MINISTRY = {
  /** Per thousand households a year, at ordinary attendance. */
  perThousand: {
    baptisms: 22,
    firstCommunions: 20,
    confirmations: 17,
    weddings: 8,
    funerals: 15,
    anointings: 30,
    converts: 3,
  } as Record<MinistryKey, number>,
  /** An aging parish buries and a young one baptizes; both marry about the same. */
  generational: {
    aging: { baptisms: 0.6, firstCommunions: 0.65, confirmations: 0.7, funerals: 1.7, weddings: 0.8, anointings: 1.5, converts: 0.9 },
    mixed: { baptisms: 1, firstCommunions: 1, confirmations: 1, funerals: 1, weddings: 1, anointings: 1, converts: 1 },
    young: { baptisms: 1.5, firstCommunions: 1.35, confirmations: 1.25, funerals: 0.55, weddings: 1.3, anointings: 0.7, converts: 1.2 },
  } as Record<string, Partial<Record<MinistryKey, number>>>,
  /** Attendance the rates are quoted at: the pews decide how much of the parish actually asks. */
  attendanceBase: 0.45,
  /** Masses a week: the Sunday ones and the daily one, by what the routine keeps. */
  masses: { sunday: { min: 2, standard: 3, invested: 3 }, weekday: { min: 2, standard: 5, invested: 6 } } as Record<string, Record<Quality, number>>,
  /** Penitents a week at the scheduled hour, and per extra block given to it. */
  confessions: { scheduled: { min: 5, standard: 12, invested: 20 } as Record<Quality, number>, perBlock: 9 },
  /** A pastor takes the weddings and the funerals; his vicar takes the baptisms. */
  share: {
    pastor: { weddings: 0.6, funerals: 0.6, baptisms: 0.4, anointings: 0.5 },
    parochial_vicar: { weddings: 0.4, funerals: 0.4, baptisms: 0.6, anointings: 0.5 },
  } as Record<string, Partial<Record<MinistryKey, number>>>,
  /** What a week in a posting counts, by program: the wards are not a parish. */
  posts: {
    hospital_chaplain: { masses: 8, confessions: 14, anointings: 11, funerals: 0.4, baptisms: 0.3, converts: 0.12 },
    university_chaplain: { masses: 7, confessions: 9, baptisms: 0.2, converts: 0.3, weddings: 0.2 },
    bishops_secretary: { masses: 7, confessions: 2, weddings: 0.1, funerals: 0.1 },
    seminary_faculty: { masses: 7, confessions: 6 },
    vicar_general: { masses: 7, confessions: 2, confirmations: 1.2, funerals: 0.2 },
    rome_stl: { masses: 7, confessions: 1, baptisms: 0.05 },
    cua_jcl: { masses: 7, confessions: 2, weddings: 0.1, funerals: 0.1 },
  } as Record<string, Partial<Record<MinistryKey, number>>>,
  /** A bishop's week: the confirmations of a whole diocese, and the ordinations of one June. */
  see: { masses: 8, confirmations: 22, ordinations: 0.06, funerals: 0.2 } as Partial<Record<MinistryKey, number>>,
} as const;

export function emptyMinistry(): Ministry {
  return { masses: 0, confessions: 0, baptisms: 0, firstCommunions: 0, confirmations: 0, weddings: 0, funerals: 0, anointings: 0, converts: 0, ordinations: 0 };
}

export function ministryOf(state: GameState): Ministry {
  return { ...emptyMinistry(), ...(state.ministry ?? {}) };
}

function add(book: Ministry, gained: Partial<Record<MinistryKey, number>>): Ministry {
  const out = { ...book };
  for (const k of MINISTRY_KEYS) out[k] = (out[k] ?? 0) + (gained[k] ?? 0);
  return out;
}

/** How many priests are in the house to share the work. */
export function priestsInHouse(state: GameState): number {
  const p = state.parish;
  if (!p) return 1;
  const pastorToo = p.role !== 'pastor' ? 1 : 0;
  const vicar = p.vicarId && state.npcs[p.vicarId]?.status === 'active' ? 1 : 0;
  const resident = p.resident && state.npcs[p.resident.npcId]?.status === 'active' ? 0.4 : 0;
  return 1 + pastorToo + vicar + resident;
}

/** What one week in the parish counted, before it is added to the book. */
export function parishWeekBook(state: GameState, obligations: Record<string, Quality>, extraConfessionBlocks = 0): Partial<Record<MinistryKey, number>> {
  const ps = state.parish;
  const record = state.world?.parishes.find((p: Parish) => p.id === ps?.parishId);
  if (!ps || !record) return {};
  const scale = (record.households / 1000) * ((ps.attendance ?? MINISTRY.attendanceBase) / MINISTRY.attendanceBase);
  const gen = MINISTRY.generational[record.generational] ?? MINISTRY.generational.mixed!;
  const share = MINISTRY.share[ps.role === 'parochial_vicar' ? 'parochial_vicar' : 'pastor'] ?? {};
  const priests = priestsInHouse(state);
  const out: Partial<Record<MinistryKey, number>> = {};
  for (const key of ['baptisms', 'firstCommunions', 'confirmations', 'weddings', 'funerals', 'anointings', 'converts'] as MinistryKey[]) {
    const yearly = (MINISTRY.perThousand[key] ?? 0) * scale * (gen[key] ?? 1);
    // A man takes his share of what the parish asks; where the book says nothing, the priests divide it.
    const mine = share[key] ?? 1 / priests;
    out[key] = (yearly / 52) * (priests > 1 ? mine : 1);
  }
  const sunday = MINISTRY.masses.sunday![obligations.sunday_masses as Quality] ?? 3;
  const weekday = MINISTRY.masses.weekday![obligations.weekday_masses as Quality] ?? 5;
  out.masses = sunday + weekday;
  out.confessions = (MINISTRY.confessions.scheduled[obligations.confessions as Quality] ?? 12) + extraConfessionBlocks * MINISTRY.confessions.perBlock;
  return out;
}

/** The week is over: what it counted goes into the book. */
export function ministryWeek(state: GameState, obligations: Record<string, Quality>, extraConfessionBlocks = 0): GameState {
  const gained = parishWeekBook(state, obligations, extraConfessionBlocks);
  if (Object.keys(gained).length === 0) return state;
  return { ...state, ministry: add(ministryOf(state), gained) };
}

/** A week away: the wards, the campus, the residence, or a see of his own, at that place's rates. */
export function ministryAwayWeek(state: GameState): GameState {
  if (state.see) return { ...state, ministry: add(ministryOf(state), MINISTRY.see) };
  const program = state.study ? studyProgram(state.study.program) : undefined;
  const rates = program ? MINISTRY.posts[program.id] : undefined;
  if (!rates) return state;
  return { ...state, ministry: add(ministryOf(state), rates) };
}

/** The parishes a hard case is written into: a turnaround only counts where the place was hard. */
const HARD = new Set(['difficult', 'struggling_urban', 'rural']);

/**
 * What a life adds up to besides the sacraments, for content to read:
 * posts held, men formed, parishes turned, vocations sent, offices held.
 */
export function lifeCount(state: GameState, key: 'posts' | 'formed' | 'turnarounds' | 'vocations' | 'offices'): number {
  switch (key) {
    case 'posts':
      return (state.tenures ?? []).length + (state.parish || state.study ? 1 : 0);
    case 'formed':
      return (state.formed ?? []).length;
    case 'vocations':
      return Number(state.flags['vocation:entered'] ?? 0);
    case 'offices':
      return Object.keys(state.flags).filter((k) => (k.startsWith('office:') || k.startsWith('held:office:')) && state.flags[k]).length;
    case 'turnarounds':
      return (state.tenures ?? []).filter((t) => {
        if (t.kind !== 'parish' || !/^(turning|coming along)/i.test(t.verdict ?? '')) return false;
        const parish = t.parishId ? state.world?.parishes.find((p) => p.id === t.parishId) : undefined;
        return !!parish && HARD.has(parish.kind);
      }).length;
  }
}

export const MINISTRY_LABEL: Record<MinistryKey, string> = {
  masses: 'Masses celebrated',
  confessions: 'Confessions heard',
  baptisms: 'Baptisms',
  firstCommunions: 'First communions',
  confirmations: 'Confirmations prepared',
  weddings: 'Weddings',
  funerals: 'Funerals',
  anointings: 'Anointings',
  converts: 'Received into the Church',
  ordinations: 'Ordained by your hands',
};

/** The book as whole numbers, in the order the sheet prints it. */
export function ministryRows(state: GameState): { key: MinistryKey; label: string; value: number }[] {
  const book = ministryOf(state);
  return MINISTRY_KEYS.map((key) => ({ key, label: MINISTRY_LABEL[key], value: Math.round(book[key]) })).filter((r) => r.value > 0);
}

/** One sentence for the ending and the digest: the weight of it in plain numbers. */
export function ministryLine(state: GameState): string | null {
  const book = ministryOf(state);
  const masses = Math.round(book.masses);
  if (masses < 50) return null;
  const parts = [`${masses.toLocaleString()} Masses`];
  if (book.confessions >= 50) parts.push(`${Math.round(book.confessions).toLocaleString()} confessions`);
  if (book.baptisms >= 5) parts.push(`${Math.round(book.baptisms).toLocaleString()} baptisms`);
  if (book.funerals >= 5) parts.push(`${Math.round(book.funerals).toLocaleString()} funerals`);
  return `${parts.join(', ')}.`;
}
