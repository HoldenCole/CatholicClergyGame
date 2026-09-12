import type { Clock, Parish } from '@/types';
import { dayOfWeek, easterSunday, fromDayNumber, liturgicalYear, nextSundayOnOrAfter, toDayNumber } from './calendar';
import { sundayOf } from './time';

/** The days of the year the parish keeps, beyond the seasons. */
export type FeastKey =
  | 'epiphany' | 'santo_nino' | 'tet' | 'candlemas' | 'ash_wednesday' | 'st_joseph' | 'annunciation' | 'palm_sunday' | 'holy_thursday' | 'good_friday' | 'easter_vigil' | 'easter'
  | 'divine_mercy' | 'ascension' | 'pentecost' | 'corpus_christi' | 'sacred_heart' | 'sts_peter_paul' | 'assumption' | 'czestochowa' | 'korean_martyrs'
  | 'all_saints' | 'all_souls' | 'christ_the_king' | 'advent_start' | 'immaculate_conception' | 'guadalupe' | 'simbang_gabi' | 'christmas' | 'holy_family' | 'patronal';

export const FEAST_KEYS: readonly FeastKey[] = [
  'epiphany', 'santo_nino', 'tet', 'candlemas', 'ash_wednesday', 'st_joseph', 'annunciation', 'palm_sunday', 'holy_thursday', 'good_friday', 'easter_vigil', 'easter',
  'divine_mercy', 'ascension', 'pentecost', 'corpus_christi', 'sacred_heart', 'sts_peter_paul', 'assumption', 'czestochowa', 'korean_martyrs',
  'all_saints', 'all_souls', 'christ_the_king', 'advent_start', 'immaculate_conception', 'guadalupe', 'simbang_gabi', 'christmas', 'holy_family', 'patronal',
] as const;

export const FEAST_LABEL: Record<FeastKey, string> = {
  epiphany: 'Epiphany',
  santo_nino: 'Santo Niño',
  tet: 'Tết',
  candlemas: 'Candlemas',
  ash_wednesday: 'Ash Wednesday',
  st_joseph: 'St. Joseph',
  annunciation: 'The Annunciation',
  palm_sunday: 'Palm Sunday',
  holy_thursday: 'Holy Thursday',
  good_friday: 'Good Friday',
  easter_vigil: 'The Easter Vigil',
  easter: 'Easter Sunday',
  divine_mercy: 'Divine Mercy Sunday',
  ascension: 'The Ascension',
  pentecost: 'Pentecost',
  corpus_christi: 'Corpus Christi',
  sacred_heart: 'The Sacred Heart',
  sts_peter_paul: 'Sts. Peter and Paul',
  assumption: 'The Assumption',
  czestochowa: 'Our Lady of Częstochowa',
  korean_martyrs: 'The Korean Martyrs',
  all_saints: 'All Saints',
  all_souls: 'All Souls',
  christ_the_king: 'Christ the King',
  advent_start: 'The First Sunday of Advent',
  immaculate_conception: 'The Immaculate Conception',
  guadalupe: 'Our Lady of Guadalupe',
  simbang_gabi: 'Simbang Gabi',
  christmas: 'Christmas',
  holy_family: 'The Holy Family',
  patronal: 'The patronal feast',
};

/** Feasts a community keeps, and the share of the parish that makes them the parish's. */
export const COMMUNITY_FEASTS: Partial<Record<FeastKey, { ethnic: string; share: number }>> = {
  guadalupe: { ethnic: 'latino', share: 0.1 },
  simbang_gabi: { ethnic: 'filipino', share: 0.1 },
  santo_nino: { ethnic: 'filipino', share: 0.1 },
  tet: { ethnic: 'vietnamese', share: 0.1 },
  czestochowa: { ethnic: 'polish', share: 0.1 },
  korean_martyrs: { ethnic: 'korean', share: 0.1 },
};

/** Lunar New Year, 2010–2050; years beyond repeat the Metonic cycle, near enough for a parish calendar. */
const TET: Record<number, [number, number]> = {
  2010: [2, 14], 2011: [2, 3], 2012: [1, 23], 2013: [2, 10], 2014: [1, 31], 2015: [2, 19], 2016: [2, 8], 2017: [1, 28], 2018: [2, 16], 2019: [2, 5],
  2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10], 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24],
  2040: [2, 12], 2041: [2, 1], 2042: [1, 22], 2043: [2, 10], 2044: [1, 30], 2045: [2, 17], 2046: [2, 6], 2047: [1, 26], 2048: [2, 14], 2049: [2, 2], 2050: [1, 23],
};

function tet(year: number): number {
  let y = year;
  while (y > 2050) y -= 19;
  while (y < 2010) y += 19;
  const [m, d] = TET[y]!;
  return toDayNumber({ year, month: m, day: d });
}

/** The day number of each feast in a calendar year. Movable feasts follow the US calendar (Ascension and Corpus Christi on Sunday). */
export function feastDays(year: number, patronal?: { month?: number; day?: number; feast?: string }): Record<FeastKey, number> {
  const ly = liturgicalYear(year);
  const easter = easterSunday(year);
  const fixed = (month: number, day: number) => toDayNumber({ year, month, day });
  const jan1 = fixed(1, 1);
  const firstSundayJan = nextSundayOnOrAfter(jan1);
  const holyFamily = (() => {
    // The Sunday in the octave of Christmas, or 30 December when Christmas is a Sunday.
    const dow = dayOfWeek(ly.christmas);
    return dow === 0 ? fixed(12, 30) : ly.christmas + (7 - dow);
  })();
  const days: Record<FeastKey, number> = {
    epiphany: nextSundayOnOrAfter(fixed(1, 2)),
    santo_nino: firstSundayJan + 14,
    tet: tet(year),
    candlemas: fixed(2, 2),
    ash_wednesday: ly.ashWednesday,
    st_joseph: fixed(3, 19),
    annunciation: fixed(3, 25),
    palm_sunday: ly.palmSunday,
    holy_thursday: easter - 3,
    good_friday: easter - 2,
    easter_vigil: easter - 1,
    easter,
    divine_mercy: easter + 7,
    ascension: easter + 42,
    pentecost: ly.pentecost,
    corpus_christi: easter + 63,
    sacred_heart: easter + 68,
    sts_peter_paul: fixed(6, 29),
    assumption: fixed(8, 15),
    czestochowa: fixed(8, 26),
    korean_martyrs: fixed(9, 20),
    all_saints: fixed(11, 1),
    all_souls: fixed(11, 2),
    christ_the_king: ly.adventStart - 7,
    advent_start: ly.adventStart,
    immaculate_conception: fixed(12, 8),
    guadalupe: fixed(12, 12),
    simbang_gabi: fixed(12, 16),
    christmas: ly.christmas,
    holy_family: holyFamily,
    patronal: -1,
  };
  if (patronal?.feast && patronal.feast in days) days.patronal = days[patronal.feast as FeastKey];
  else if (patronal?.month && patronal.day) days.patronal = fixed(patronal.month, patronal.day);
  return days;
}

/** Whether a parish keeps a feast: community feasts need the community. */
export function keepsFeast(parish: Parish | undefined, key: FeastKey): boolean {
  const need = COMMUNITY_FEASTS[key];
  if (!need) return key !== 'patronal' || !!parish?.patronal;
  return !!parish && (parish.ethnic[need.ethnic] ?? 0) >= need.share;
}

/** The feasts that fall in the week beginning `sunday`, for a parish. */
export function feastsInWeek(sunday: number, parish?: Parish): FeastKey[] {
  const { year } = fromDayNumber(sunday);
  const out: FeastKey[] = [];
  for (const y of [year, year + 1]) {
    const days = feastDays(y, parish?.patronal);
    for (const key of FEAST_KEYS) {
      const d = days[key];
      if (d >= sunday && d <= sunday + 6 && keepsFeast(parish, key) && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

/** The feasts of the current week. */
export function feastsOfWeek(clock: Clock, parish?: Parish): FeastKey[] {
  return feastsInWeek(sundayOf(clock), parish);
}

export interface UpcomingFeast {
  key: FeastKey;
  label: string;
  /** Weeks from the current week: 0 is this week. */
  weeks: number;
  day: number;
}

/** The next few feasts ahead, this week first. */
export function upcomingFeasts(clock: Clock, parish?: Parish, count = 4): UpcomingFeast[] {
  const sunday = sundayOf(clock);
  const { year } = fromDayNumber(sunday);
  const out: UpcomingFeast[] = [];
  for (const y of [year, year + 1]) {
    const days = feastDays(y, parish?.patronal);
    for (const key of FEAST_KEYS) {
      const d = days[key];
      if (d < sunday || !keepsFeast(parish, key)) continue;
      out.push({ key, label: key === 'patronal' && parish?.patronal ? parish.patronal.label : FEAST_LABEL[key], weeks: Math.floor((d - sunday) / 7), day: d });
    }
  }
  return out.sort((a, b) => a.day - b.day).filter((f, i, arr) => arr.findIndex((g) => g.key === f.key) === i).slice(0, count);
}
