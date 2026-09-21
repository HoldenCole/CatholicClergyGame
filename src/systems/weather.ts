import type { Clock } from '@/types';
import { createRng } from '@/engine/rng';
import { fromDayNumber } from '@/engine/calendar';
import { sundayOf } from '@/engine/time';

/**
 * The weather of a week: a word in the header, a pull on the pews, a wash
 * over the windows. Rolled from the save's seed and the week, so a replayed
 * week has the same sky. The climate comes from the diocese's region line
 * by keyword; the distributions are invented and coarse on purpose. A
 * hurricane is an authored event (storms.json); this is only the weather.
 */
export type WeatherKind = 'clear' | 'rain' | 'snow' | 'heat' | 'storm' | 'fog' | 'wind' | 'cold';
export type Climate = 'continental' | 'southern' | 'pacific' | 'mountain';

export interface Weather {
  kind: WeatherKind;
  /** "snow on the steps" */
  word: string;
  /** Multiplier on the week's attendance. */
  attendance: number;
}

/** The pull of each kind on the pews. Invented. */
export const WEATHER_PULL: Record<WeatherKind, number> = { clear: 1, rain: 0.98, snow: 0.9, heat: 0.97, storm: 0.92, fog: 1, wind: 1, cold: 0.97 };

const WORDS: Record<WeatherKind, string[]> = {
  clear: ['clear', 'fine', 'a bright week', 'mild'],
  rain: ['rain', 'rain all week', 'grey and wet', 'showers'],
  snow: ['snow', 'snow on the steps', 'a heavy snow', 'snow, then slush'],
  heat: ['heat', 'a hot week', 'heat that did not break', 'close and hot'],
  storm: ['a storm', 'storms', 'a storm on Saturday night', 'thunder most afternoons'],
  fog: ['fog', 'fog in the mornings', 'a grey week', 'low cloud'],
  wind: ['wind', 'a hard wind', 'wind off the water', 'blustery'],
  cold: ['hard cold', 'bitter cold', 'a cold snap', 'cold and dry'],
};

/** The climate from a region line: "New England", "the Mississippi Gulf Coast", "eastern Montana". */
export function climateOf(region: string | undefined): Climate {
  const r = (region ?? '').toLowerCase();
  if (/mountain|wyoming|montana|dakota|colorado|idaho|utah|nevada|new mexico/.test(r)) return 'mountain';
  if (/gulf|florida|louisiana|texas|south\b|kentucky|tennessee|carolina|georgia|alabama|mississippi|arkansas|oklahoma|virginia/.test(r) && !/south dakota/.test(r)) return 'southern';
  if (/california|oregon|washington state|\bwest\b|pacific|hawaii/.test(r)) return 'pacific';
  return 'continental';
}

type Band = 'winter' | 'spring' | 'summer' | 'fall';

function bandOf(month: number): Band {
  return month === 12 || month <= 2 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'fall';
}

/** Weights by climate and season. */
const TABLE: Record<Climate, Record<Band, Partial<Record<WeatherKind, number>>>> = {
  continental: {
    winter: { clear: 3, snow: 4, cold: 3, rain: 1, wind: 1 },
    spring: { clear: 4, rain: 4, wind: 2, storm: 1, snow: 0.5 },
    summer: { clear: 5, heat: 3, storm: 2, rain: 1 },
    fall: { clear: 5, rain: 3, wind: 2, cold: 1, fog: 1 },
  },
  southern: {
    winter: { clear: 5, rain: 3, cold: 1, fog: 1 },
    spring: { clear: 4, rain: 2, storm: 3, heat: 1 },
    summer: { heat: 5, storm: 4, clear: 2 },
    fall: { clear: 5, heat: 2, storm: 2, rain: 1 },
  },
  pacific: {
    winter: { rain: 5, clear: 3, fog: 2, wind: 1 },
    spring: { clear: 5, rain: 2, fog: 2, wind: 1 },
    summer: { clear: 6, fog: 3, heat: 1 },
    fall: { clear: 5, fog: 2, rain: 2, wind: 1 },
  },
  mountain: {
    winter: { snow: 5, cold: 4, clear: 3, wind: 1 },
    spring: { clear: 4, wind: 3, snow: 2, rain: 1 },
    summer: { clear: 6, storm: 2, heat: 1 },
    fall: { clear: 5, cold: 2, wind: 2, snow: 1 },
  },
};

/** The weather of the week that begins on the clock's Sunday. */
export function weatherOfWeek(seed: string, clock: Clock, region: string | undefined, week = clock.week): Weather {
  const rng = createRng(`${seed}:weather:${week}`);
  const { month } = fromDayNumber(sundayOf(clock, week));
  const weights = TABLE[climateOf(region)][bandOf(month)];
  const kinds = Object.keys(weights) as WeatherKind[];
  const kind = rng.weighted(kinds, (k) => weights[k] ?? 0);
  return { kind, word: rng.pick(WORDS[kind]), attendance: WEATHER_PULL[kind] };
}
