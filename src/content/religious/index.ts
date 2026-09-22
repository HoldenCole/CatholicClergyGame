import raw from './orders.json';
import horariumRaw from './horarium.json';
import permissionsRaw from './permissions.json';
import bishopAsksRaw from './bishopAsks.json';
import pastorAsksRaw from './pastorAsks.json';
import reputationsRaw from './reputations.json';
import spendsRaw from './spends.json';
import foundationsRaw from './foundations.json';
import projectsRaw from './projects.json';
import confrereAsksRaw from './confrereAsks.json';
import priorDeskRaw from './priorDesk.json';
import type { BishopAskDef, PastorAskDef, ReputationDef, IdentityDef, FriarSpendDef, ConfrereAskDef, SideWorkDef, CharterDial, CharterOptionDef, FoundationWorkDef, HorariumDef, HorariumKey, OrderDef, OrderKey, PermissionDef, ProvinceSeed } from '@/types';

/** The orders a friar can be professed into. E3 §6–7, as data. */
const data = raw as unknown as { orders: OrderDef[]; provinceComplications: string[]; doctrinalTopics: string[] };

export const religiousOrders: OrderDef[] = data.orders;

/** The one visible problem a province can carry. */
export const provinceComplications: string[] = data.provinceComplications;

export function religiousOrder(key: OrderKey): OrderDef {
  const def = religiousOrders.find((o) => o.key === key);
  if (!def) throw new Error(`no order ${key}`);
  return def;
}

export function provinceSeed(key: OrderKey, id: string): ProvinceSeed {
  const seed = religiousOrder(key).provinces.find((p) => p.id === id);
  if (!seed) throw new Error(`no province ${id} in ${key}`);
  return seed;
}

/** Topics on which a public position is doctrinal, and an order's mechanics may amplify. E3 §6.2. */
export const doctrinalTopics: string[] = data.doctrinalTopics;

/** The common life's obligations, in the order the sheet shows them. E3 §3.3. */
export const horariumDefs: HorariumDef[] = (horariumRaw as unknown as { horarium: HorariumDef[] }).horarium;

export function horariumDef(key: HorariumKey): HorariumDef {
  const def = horariumDefs.find((h) => h.key === key);
  if (!def) throw new Error(`no horarium line ${key}`);
  return def;
}

/** What a friar may ask his prior for. E3 §3.4. */
export const permissionDefs: PermissionDef[] = (permissionsRaw as unknown as { permissions: PermissionDef[] }).permissions;

/** What a bishop may ask the provincial for. E3 §3.11. */
export const bishopAskDefs: BishopAskDef[] = (bishopAsksRaw as unknown as { asks: BishopAskDef[] }).asks;

/** What a pastor of the diocese may write to the prior for. E3 §3.12. */
export const pastorAskDefs: PastorAskDef[] = (pastorAsksRaw as unknown as { asks: PastorAskDef[] }).asks;

/** What a friar is known for, and the identities two reputations make. E3 §8. */
const reps = reputationsRaw as unknown as { reputations: ReputationDef[]; identities: IdentityDef[] };
export const reputationDefs: ReputationDef[] = reps.reputations;
export const identityDefs: IdentityDef[] = reps.identities;

/** The friar's discretionary week. E3 §3.3. */
export const spendDefs: FriarSpendDef[] = (spendsRaw as unknown as { spends: FriarSpendDef[] }).spends;

/** The founding charter's dials and the works a house can add. E3 §9.4–9.5. */
const foundations = foundationsRaw as unknown as { dials: Record<CharterDial, CharterOptionDef[]>; works: FoundationWorkDef[]; needLines: Record<string, string> };
const rawDials = foundations.dials;
/** The second and third works are the first's options at a share, with none first. */
const NO_WORK: CharterOptionDef = { id: 'none', label: 'None', line: 'The house does the one thing, and does it wholly.' };
export const charterDials: Record<CharterDial, CharterOptionDef[]> = { ...rawDials, secondaryWork: [NO_WORK, ...rawDials.primaryWork], tertiaryWork: [NO_WORK, ...rawDials.primaryWork] };
export const foundationWorkDefs: FoundationWorkDef[] = foundations.works;
export const needLines: Record<string, string> = foundations.needLines;

export function charterOption(dial: CharterDial, id: string): CharterOptionDef {
  const def = charterDials[dial].find((o) => o.id === id);
  if (!def) throw new Error(`no ${dial} option ${id}`);
  return def;
}

/** The friar's desk: projects taken on beside the house's work. E3 §6.2. */
export const friarProjectDefs: SideWorkDef[] = (projectsRaw as unknown as { projects: SideWorkDef[] }).projects;

/** Letters from brothers of the province asking for help. E3 §6.2. */
export const confrereAskDefs: ConfrereAskDef[] = (confrereAsksRaw as unknown as { asks: ConfrereAskDef[] }).asks;

/** The prior's desk: the rules a house can be set to, and the purse. E3 §3.2, §3.10. */
export const priorDeskDefs = priorDeskRaw as unknown as { rules: { id: string; label: string; observance: number; line: string }[]; purse: { id: string; label: string; blurb: string; cost: number; cooldown: number; effects: import('@/types').Effect[]; house?: { cohesion?: number; observance?: number }; line: string }[] };
