import type { Character, ConstituencyKey, PositionRecord, Reputation, Volume } from '@/types';
import {
  ALIGNMENT_DRIFT_PER_POSITION,
  FIGURE_BLOC_SUPPORT,
  FIGURE_OUTSPOKENNESS,
  OUTSPOKENNESS_PER_VOLUME,
  REPUTATION_REST,
} from './tuning';

export function clampSigned(value: number): number {
  return Math.min(100, Math.max(-100, value));
}

export function applyReputation(rep: Reputation, key: ConstituencyKey, delta: number): Reputation {
  return { ...rep, [key]: clampSigned(rep[key] + delta) };
}

/** One value's weekly drift back toward ±floor. Below the floor it stays put. */
function fadeToward(value: number, floor: number, rate: number): number {
  const excess = Math.abs(value) - floor;
  if (excess <= 0) return value;
  return value - Math.sign(value) * excess * rate;
}

/**
 * A week of nothing in particular. Every constituency's opinion fades toward
 * the resting point, and a man who has stopped talking grows quieter. What
 * sits at or under the floor does not move; it takes an action to change it.
 */
export function fadeReputation(character: Character): Character {
  const rep = { ...character.reputation };
  for (const key of Object.keys(rep) as ConstituencyKey[]) {
    rep[key] = fadeToward(rep[key], REPUTATION_REST.floor, REPUTATION_REST.ratePerWeek);
  }
  return {
    ...character,
    reputation: rep,
    outspokenness: fadeToward(character.outspokenness, REPUTATION_REST.outspokennessFloor, REPUTATION_REST.outspokennessRatePerWeek),
  };
}

export function emptyReputation(value = 0): Reputation {
  return {
    chancery: value,
    brother_priests: value,
    parishioners: value,
    traditional_bloc: value,
    progressive_bloc: value,
    public: value,
    rome: value,
  };
}

/**
 * Record a position at a volume. DESIGN.md §5.2: alignment drifts toward what
 * is said (a man becomes what he keeps saying), and public volume accumulates
 * outspokenness. Private positions cost no outspokenness.
 */
export function recordPosition(character: Character, record: PositionRecord): Character {
  const drift = (record.value - character.alignment) * ALIGNMENT_DRIFT_PER_POSITION;
  return {
    ...character,
    alignment: clampSigned(character.alignment + drift),
    outspokenness: Math.min(100, character.outspokenness + OUTSPOKENNESS_PER_VOLUME[record.volume]),
    positions: [...character.positions, record],
  };
}

const VOLUME_PUBLIC: readonly Volume[] = ['semi_public', 'public'];

/**
 * DESIGN.md §5.5. Consistency is 0..100: 100 means the public record matches
 * the private one and nothing has been reversed. Two ingredients:
 *  - the mean gap, per topic, between private and public positions;
 *  - the count of public reversals (sign flips on the same topic).
 */
export function consistency(character: Character): number {
  const byTopic = new Map<string, { priv: number[]; pub: number[] }>();
  for (const p of character.positions) {
    const entry = byTopic.get(p.topic) ?? { priv: [], pub: [] };
    (VOLUME_PUBLIC.includes(p.volume) ? entry.pub : entry.priv).push(p.value);
    byTopic.set(p.topic, entry);
  }
  let gapSum = 0;
  let gapCount = 0;
  let reversals = 0;
  for (const { priv, pub } of byTopic.values()) {
    if (priv.length && pub.length) {
      gapSum += Math.abs(mean(priv) - mean(pub));
      gapCount++;
    }
    for (let i = 1; i < pub.length; i++) {
      const a = pub[i - 1] as number;
      const b = pub[i] as number;
      if (Math.sign(a) !== Math.sign(b) && Math.abs(a - b) >= 40) reversals++;
    }
  }
  const gapPenalty = gapCount ? (gapSum / gapCount) / 2 : 0; // a 100-point gap costs 50
  return Math.max(0, Math.round(100 - gapPenalty - reversals * 15));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** DESIGN.md §5.6 */
export function isFigure(character: Character): boolean {
  if (character.outspokenness < FIGURE_OUTSPOKENNESS) return false;
  const bloc = character.alignment < 0 ? 'traditional_bloc' : 'progressive_bloc';
  return character.reputation[bloc] >= FIGURE_BLOC_SUPPORT;
}
