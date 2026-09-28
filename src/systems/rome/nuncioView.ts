import type { GameState, Implementation } from '@/types';

/**
 * E1 R1.3 — how the nuncio reads a man (§5, §4.4): Rome's regard, the
 * chancery's, what he did with Rome's documents in his parish, what he has
 * said in public against the nuncio's own reading, the degrees and posts that
 * make a bishop, and the letter his own bishop writes. Two men with the same
 * stats and different records read differently. Weights are invented and flagged.
 */
export const VIEW = {
  base: 24,
  rome: 20,
  /** The man himself: a bishop governs, speaks, and teaches. Up to fifteen points between them. */
  stats: { administration: 6, charisma: 5, theology: 4 } as const,
  chancery: 8,
  fidelity: { eager: 3, faithful: 4, minimal: -1, defiant: -7 } as Record<Implementation, number>,
  fidelityCap: 15,
  /** A public record further than this from the nuncio's reading costs him, a point per this many beyond. */
  gapFree: 30,
  gapPer: 6,
  gapCap: 20,
  loud: 50,
  loudCost: 6,
  credit: { JCL: 6, STL: 3, STD: 3, rome_alumnus: 5, vg_served: 8, bishops_secretary: 4, hard_parish_turned: 3, auxiliary: 10, curia: 8 },
  /** A friar's own credits (E3 §16B): a provincial's term, a prior's, the head of the order's. */
  friar: { provincial: 8, prior: 3, general: 10 },
  bishopPer: 10,
  trusted: 6,
  brokeSecret: -12,
} as const;

export interface NuncioView {
  value: number;
  /** What he has read in the file, for and against: fragments for a sentence. */
  good: string[];
  bad: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** The nuncio's reading of the man, 0..100, and why. */
export function nuncioView(state: GameState): NuncioView {
  const c = state.character;
  const good: string[] = [];
  const bad: string[] = [];
  if (!c) return { value: 0, good, bad };
  const temper = state.rome?.nuncio?.temperament ?? 0;
  let v = VIEW.base;
  for (const [k, w] of Object.entries(VIEW.stats)) v += (Math.max(0, c.stats[k as keyof typeof VIEW.stats]) / 100) * w;
  if (c.stats.administration >= 70 && c.stats.charisma >= 60) good.push('a man who can run a diocese and be liked doing it');
  const rome = c.reputation.rome ?? 0;
  v += (rome / 100) * VIEW.rome;
  if (rome >= 30) good.push('Rome thinks well of you');
  else if (rome <= -20) bad.push('Rome knows your name for the wrong reasons');
  // The chancery's regard, or, for a friar, the province's: the nuncio reads the order's file. E3 §16B.
  const r = state.religious;
  v += (((r ? c.reputation.province : c.reputation.chancery) ?? 0) / 100) * VIEW.chancery;
  // What he did with Rome's documents in his parish.
  let fidelity = 0;
  for (const d of state.rome?.issued ?? []) {
    if (!d.implemented) continue;
    fidelity += VIEW.fidelity[d.implemented];
    if (d.implemented === 'defiant') bad.push(`you would not put ${d.title} into effect`);
    else if (d.implemented === 'faithful' || d.implemented === 'eager') good.push(`you put ${d.title} into effect`);
  }
  v += clamp(fidelity, -VIEW.fidelityCap, VIEW.fidelityCap);
  // What he has said in public, against the nuncio's own reading.
  const said = c.positions.filter((p) => p.volume !== 'private' && Math.abs(p.value) >= 20);
  if (said.length) {
    const mean = said.reduce((n, p) => n + p.value, 0) / said.length;
    const gap = Math.abs(mean - temper);
    const cost = Math.min(VIEW.gapCap, Math.max(0, gap - VIEW.gapFree) / VIEW.gapPer);
    v -= cost;
    if (cost >= 5) bad.push('you have said things in public he would not have said');
    if (c.outspokenness >= VIEW.loud && gap >= 25) {
      v -= VIEW.loudCost;
      bad.push('you are a loud man');
    }
  }
  const f = state.flags;
  if (c.credentials.includes('JCL')) { v += VIEW.credit.JCL; good.push('the canon law'); }
  if (c.credentials.includes('STL')) v += VIEW.credit.STL;
  if (c.credentials.includes('STD')) v += VIEW.credit.STD;
  if (f.rome_alumnus) { v += VIEW.credit.rome_alumnus; good.push('the Roman degree'); }
  if (f.vg_served) { v += VIEW.credit.vg_served; good.push('the years as vicar general'); }
  if (f['office:bishops_secretary']) { v += VIEW.credit.bishops_secretary; good.push("the bishop's secretary's desk"); }
  if (f['office:auxiliary_bishop'] || f.served_auxiliary) { v += VIEW.credit.auxiliary; good.push('the years as an auxiliary'); }
  if (f.curia_served || f['curia:rank']) { v += VIEW.credit.curia; good.push('the years in the Curia'); }
  if (f.hard_parish_turned) { v += VIEW.credit.hard_parish_turned; good.push('the parish everyone had written off'); }
  if (r) {
    // What the order can say of him: the offices he held.
    const held = (office: string) => r.office?.office === office || r.termsServed.some((t) => t.office === office);
    if (f['general:served'] || r.office?.office === 'general') { v += VIEW.friar.general; good.push('the years at the head of the order'); }
    else if (held('provincial')) { v += VIEW.friar.provincial; good.push('the years as provincial'); }
    else if (held('prior')) { v += VIEW.friar.prior; good.push("a prior's term"); }
  }
  // The letter his own bishop writes to the nunciature; for a friar, the provincial's, or the order's file when he is the provincial.
  const bishopId = r ? (state.province?.provincialId === 'player' ? undefined : state.province?.provincialId) : state.world?.diocese.hidden.bishop.npcId;
  const rel = bishopId ? state.npcs[bishopId]?.relationship ?? 0 : r ? Math.max(-100, Math.min(100, c.reputation.order ?? 0)) : 0;
  v += rel / VIEW.bishopPer;
  if (rel >= 30) good.push(r ? "your provincial's letter" : "your bishop's letter");
  else if (rel <= -20) bad.push(r ? "your provincial's letter, which was cool" : "your bishop's letter, which was cool");
  if (f['nuncio:trusted']) { v += VIEW.trusted; good.push('an honest answer you once gave him about another man'); }
  if (f['nuncio:broke_secret']) { v += VIEW.brokeSecret; bad.push('a secret you did not keep'); }
  return { value: Math.round(clamp(v, 0, 100)), good, bad };
}

function list(xs: string[]): string {
  const u = [...new Set(xs)].slice(0, 3);
  return u.length <= 1 ? u.join('') : `${u.slice(0, -1).join(', ')}, and ${u[u.length - 1]}`;
}

/** The file as the nuncio has read it, in a sentence or two: {nuncio_view}. */
export function viewLine(state: GameState): string {
  const v = nuncioView(state);
  const parts: string[] = [];
  if (v.good.length) parts.push(`He has read your file: ${list(v.good)}.`);
  else parts.push('He has read your file, and it is thinner than you would have liked.');
  if (v.bad.length) parts.push(`He has also read that ${list(v.bad)}.`);
  return parts.join(' ');
}
