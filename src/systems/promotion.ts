import type { BishopProfile, Candidate, Decision, Opening, ScoreBreakdown } from '@/types';
import type { Rng } from '@/engine/rng';

/**
 * DESIGN 7.1:
 *   score = need·w_need + readiness·w_ready + trust·w_trust + fit_effective·w_fit + maturity + rng(±10)
 *   fit_effective = fit × (1 + outspokenness / 100)
 * Weights and the shape of each term are invented; the formula is the design's.
 */
export const PROMOTION = {
  wNeed: 0.35,
  wReady: 0.3,
  wTrust: 0.25,
  wFit: 0.3,
  noise: 10,
  /** Years ordained at which readiness from experience saturates, by opening kind. */
  experienceYears: { pastor: 12, administrator: 8, parochial_vicar: 3, chancery: 10 } as Record<Opening['kind'], number>,
  /** Credentials that count toward readiness, by opening kind. */
  credentialBonus: {
    pastor: { partial_cpa: 6, partial_jcl: 4, MBA: 8, JCL: 6 },
    administrator: { partial_cpa: 6, partial_jcl: 6, JCL: 8 },
    parochial_vicar: {},
    chancery: { JCL: 20, partial_jcl: 10, JCD: 25, MBA: 10, partial_cpa: 8, STL: 6 },
  } as Record<Opening['kind'], Record<string, number>>,
  /** DESIGN 4.3: the indispensable man is passed over for the move he wants. */
  indispensablePenalty: 12,
  affiliationSwing: 12,
  /** A man who put his name forward is at least considered on purpose. */
  askedBonus: 6,
  /** The parish nobody wanted, turned around: the board remembers. */
  turnaroundBonus: 14,
} as const;

/** DESIGN 7.2: ordination age enters through trust, not as a cap. */
export function maturityModifier(ordinationAge: number, age: number): number {
  if (ordinationAge <= 29) {
    // −8 at ordination, decaying to 0 by 35.
    const remaining = Math.max(0, 35 - age);
    const span = Math.max(1, 35 - ordinationAge);
    return -8 * (remaining / span);
  }
  if (ordinationAge <= 31) return 4;
  if (ordinationAge <= 40) return 10;
  if (ordinationAge <= 47) return 6;
  return 3;
}

const ROLE_STATS: Record<Opening['kind'], Partial<Record<keyof Candidate['stats'], number>>> = {
  pastor: { administration: 0.4, charisma: 0.3, piety: 0.2, theology: 0.1 },
  administrator: { administration: 0.6, charisma: 0.2, piety: 0.2 },
  parochial_vicar: { charisma: 0.4, piety: 0.4, theology: 0.2 },
  chancery: { administration: 0.5, knowledge: 0.3, theology: 0.2 },
};

export function readiness(c: Candidate, opening: Opening): { value: number; reasons: string[] } {
  const reasons: string[] = [];
  let stats = 0;
  for (const [key, w] of Object.entries(ROLE_STATS[opening.kind]) as [keyof Candidate['stats'], number][]) stats += c.stats[key] * w;
  const experience = Math.min(1, c.yearsOrdained / PROMOTION.experienceYears[opening.kind]) * 100;
  let credentials = 0;
  for (const [cred, bonus] of Object.entries(PROMOTION.credentialBonus[opening.kind])) if (c.credentials.includes(cred)) credentials += bonus;
  const results = Math.max(0, c.results);
  const value = stats * 0.45 + experience * 0.3 + Math.min(20, credentials) + results * 0.15;
  if (stats >= 60) reasons.push('the stats the post needs');
  if (experience >= 100) reasons.push('the years');
  if (credentials >= 8) reasons.push('the credentials');
  if (results >= 40) reasons.push('a track record');
  return { value: Math.min(100, value), reasons };
}

export function trust(c: Candidate): { value: number; reasons: string[] } {
  const reasons: string[] = [];
  const chancery = (c.chancery + 100) / 2;
  const bishop = (c.bishopRelationship + 100) / 2;
  const vouch = Math.min(24, c.vouchers * 8);
  const turned = PROMOTION.turnaroundBonus * (c.turnaround ?? 0);
  const value = chancery * 0.5 + bishop * 0.3 + vouch + turned;
  if (turned > 0) reasons.push(c.turnaround === 1 ? 'turned around the parish nobody wanted' : 'the hard parish is coming along under him');
  if (c.chancery >= 30) reasons.push('the chancery trusts him');
  if (c.bishopRelationship >= 30) reasons.push('the bishop likes him');
  if (c.vouchers > 0) reasons.push('someone in the chancery vouched');
  return { value: Math.min(100, value), reasons };
}

/** Fit to this specific opening. Can be negative. DESIGN 7.1 */
export function fit(c: Candidate, opening: Opening, bishop: Pick<BishopProfile, 'alignment'>): { value: number; reasons: string[] } {
  const reasons: string[] = [];
  let value = 0;
  if (opening.needsSpanish) {
    if (c.speaksSpanish) {
      value += 30;
      reasons.push('the Spanish');
    } else value -= 25;
  }
  if (opening.needsAdmin) {
    if (c.stats.administration >= 60 || c.credentials.includes('partial_cpa') || c.credentials.includes('MBA')) {
      value += 20;
      reasons.push('a man who can read the books');
    } else value -= 10;
  }
  if (opening.alignment !== null) {
    const gap = Math.abs(opening.alignment - c.alignment);
    value -= gap / 4;
    if (gap <= 20) reasons.push('the parish would take to him');
  }
  // The bishop's own alignment: aligned and loud is an asset, opposed and loud a liability (DESIGN 5.2).
  const bishopGap = Math.abs(bishop.alignment - c.alignment);
  value += (30 - bishopGap) / 3;
  if (c.affiliation !== 0) {
    const same = Math.sign(bishop.alignment) === Math.sign(c.affiliation) && Math.abs(bishop.alignment) >= 15;
    value += same ? PROMOTION.affiliationSwing : -PROMOTION.affiliationSwing;
    reasons.push(same ? 'his affiliation sits well with this bishop' : 'his affiliation sits badly with this bishop');
  }
  return { value, reasons };
}

export function scoreCandidate(c: Candidate, opening: Opening, bishop: Pick<BishopProfile, 'alignment'>, need: number, rng: Rng): ScoreBreakdown {
  const r = readiness(c, opening);
  const t = trust(c);
  const f = fit(c, opening, bishop);
  const fitEffective = f.value * (1 + c.outspokenness / 100);
  const maturity = maturityModifier(c.ordinationAge, c.age);
  const noise = rng.float(-PROMOTION.noise, PROMOTION.noise);
  let total = need * PROMOTION.wNeed + r.value * PROMOTION.wReady + t.value * PROMOTION.wTrust + fitEffective * PROMOTION.wFit + maturity + noise;
  const reasons = [...r.reasons, ...t.reasons, ...f.reasons];
  if (opening.applied && c.isPlayer) {
    total += PROMOTION.askedBonus;
    reasons.push('he asked for it');
  }
  if (c.indispensable && opening.kind !== 'parochial_vicar') {
    total -= PROMOTION.indispensablePenalty;
    reasons.push('too useful where he is');
  }
  if (maturity >= 6) reasons.push('read as mature');
  if (c.outspokenness >= 40 && fitEffective > f.value + 5) reasons.push('loud, and it helped');
  if (c.outspokenness >= 40 && fitEffective < f.value - 5) reasons.push('loud, and it hurt');
  return { need, readiness: r.value, trust: t.value, fit: f.value, fitEffective, maturity, noise, total, reasons };
}

/** The personnel board decides. Highest score wins; ties go to the older man. */
export function decide(opening: Opening, candidates: Candidate[], bishop: Pick<BishopProfile, 'alignment'>, need: number, rng: Rng): Decision {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, opening, bishop, need, rng) }))
    .sort((a, b) => b.score.total - a.score.total || b.candidate.age - a.candidate.age);
  const top = ranked[0]!;
  const player = ranked.find((r) => r.candidate.isPlayer);
  const reasons = player
    ? player === top
      ? player.score.reasons
      : [`${top.candidate.name} was chosen`, ...top.score.reasons.slice(0, 2).map((r) => `he had ${r}`), ...(player.score.reasons.length ? [`you had ${player.score.reasons[0]}`] : [])]
    : top.score.reasons;
  return { opening, winner: top.candidate, ranked, reasons };
}
