import type { GameState, MinistryKey, Tenure } from '@/types';
import { playerAge, yearsOrdained } from '@/engine/career';
import { allTenures } from './tenures';
import { ministryOf, ministryRows } from './ministry';
import { officeDef } from '@/content/parish';
import { officesHeld } from './offices';
import { HARD_KINDS } from './trajectory';
import { instituteDef } from '@/content/institutes';
import { friarPost } from './religious/who';

/**
 * The profile: a life in whole numbers and plain sentences. DESIGN.md §8.6.
 *
 * Everything here is read back out of the file the game already keeps — the
 * tenures, the book, the men he formed, the career entries — and nothing is
 * stored twice.
 */

export interface FormedMan {
  name: string;
  year: number;
  verdict: string;
  /** Where he is now, in words, when the game still knows. */
  now: string;
}

export interface Impact {
  place: string;
  label: string;
  verdict: string;
  years: number;
  /** Set where he took a parish that was dying and did not leave it dying. */
  turnaround: boolean;
}

export interface Profile {
  name: string;
  age: number;
  born: number;
  /** Calendar year of ordination, when he is ordained. */
  ordainedYear: number | null;
  yearsOrdained: number;
  post: string;
  diocese: string;
  ministry: { key: MinistryKey; label: string; value: number }[];
  masses: number;
  tenures: Tenure[];
  impacts: Impact[];
  formed: FormedMan[];
  /** Men of his parishes who entered the seminary. */
  vocations: number;
  offices: string[];
  credentials: string[];
  groupsFounded: number;
  /** One line under the name. */
  line: string;
}

function calendarYear(state: GameState, week: number): number {
  return new Date((state.clock.startDay + week * 7) * 86_400_000).getUTCFullYear();
}

/** How he is addressed now: a dean and a vicar general are Very Reverend while they hold it, and not after. */
function titleOf(state: GameState): string {
  if (state.see) return 'Bishop';
  if (state.study?.program === 'vicar_general' || officesHeld(state).includes('dean')) return 'Very Rev.';
  return 'Fr.';
}

/** What he is doing now, in one phrase. */
export function postLine(state: GameState): string {
  if (state.see) return `Bishop of ${state.see.see}`;
  if (state.study) return state.study.label;
  const parish = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  if (parish && state.assignment) {
    const role = state.assignment.role === 'pastor' ? (parish.cathedral ? 'Rector' : 'Pastor') : state.assignment.role === 'administrator' ? 'Administrator' : 'Parochial vicar';
    return `${role} of ${parish.name}, ${parish.place}`;
  }
  // A friar's line is the order's: the stage, the office, the house. E3.
  const friar = friarPost(state);
  if (friar) return friar;
  if (state.seminary) return `Seminarian, year ${state.seminary.year}`;
  return 'Between assignments';
}

/** The parishes he was given and what became of them. */
export function impactsOf(state: GameState): Impact[] {
  return allTenures(state)
    .filter((t) => t.kind === 'parish' && t.verdict)
    .map((t) => {
      const parish = t.parishId ? state.world?.parishes.find((p) => p.id === t.parishId) : undefined;
      // The verdicts trajectory.ts writes: 'Turning around', 'Coming along', 'Holding', 'Slipping', 'Going under'.
      const better = /^(turning|coming along)/i.test(t.verdict ?? '');
      return {
        place: t.place,
        label: t.label,
        verdict: t.verdict!,
        years: Math.max(1, Math.round((t.endWeek - t.startWeek) / 52)),
        turnaround: better && !!parish && HARD_KINDS.has(parish.kind),
      };
    });
}

/** The men he formed: summer seminarians, and what the game knows of them now. */
export function formedOf(state: GameState): FormedMan[] {
  return (state.formed ?? []).map((f) => {
    const npc = state.npcs[f.npcId];
    const now = !npc ? 'lost track of' :
      npc.status === 'left' ? 'left before ordination' :
      npc.status === 'dead' ? 'dead' :
      npc.tags.includes('religious') ? `a religious, ${npc.institute ? instituteDef(npc.institute.replace('inst_', ''))?.short ?? 'in an order' : 'in an order'}` :
      npc.tags.includes('chancery') ? 'at the chancery' :
      f.returned ? 'your vicar, once' :
      npc.tags.includes('ordained') || npc.role === 'priest' ? 'a priest of the diocese' :
      'in formation';
    return { name: `${npc ? `${npc.name.first} ${npc.name.last}` : f.name}`, year: f.year, verdict: f.verdict, now };
  });
}

/** How many men of his parishes went to the seminary. */
export function vocationsOf(state: GameState): number {
  return Number(state.flags['vocation:entered'] ?? 0);
}

export function profileOf(state: GameState): Profile {
  const c = state.character;
  const rows = ministryRows(state);
  const book = ministryOf(state);
  const ordinationWeek = typeof state.flags.ordination_week === 'number' ? state.flags.ordination_week : null;
  const years = ordinationWeek === null ? 0 : Math.floor(yearsOrdained(state));
  const offices = [...officesHeld(state).map((id) => officeDef(id)?.label ?? id)];
  const held = Object.keys(state.flags)
    .filter((k) => k.startsWith('held:office:') && state.flags[k])
    .map((k) => officeDef(k.slice('held:office:'.length))?.label)
    .filter((x): x is string => !!x && !offices.includes(x));
  const impacts = impactsOf(state);
  const turnarounds = impacts.filter((i) => i.turnaround).length;
  const formed = formedOf(state);
  const line = !c ? '' :
    ordinationWeek === null ? 'Not yet ordained. The numbers start the day the bishop lays hands on you.' :
    years === 0 ? 'Ordained this year; the book has just been opened, and a priest counts what he does in it for the rest of his life.' :
    `${years} year${years === 1 ? '' : 's'} a priest${turnarounds ? `, and ${turnarounds} parish${turnarounds === 1 ? '' : 'es'} handed on better than you found ${turnarounds === 1 ? 'it' : 'them'}` : ''}${formed.length ? `, ${formed.length === 1 ? 'one man' : `${formed.length} men`} formed` : ''}.`;
  return {
    name: c ? `${titleOf(state)} ${c.name.first} ${c.name.last}` : 'No one yet',
    age: c ? playerAge(state) : 0,
    born: c ? c.entryYear - c.background.entryAge : 0,
    ordainedYear: ordinationWeek === null ? null : calendarYear(state, ordinationWeek),
    yearsOrdained: years,
    post: postLine(state),
    diocese: state.world?.diocese.visible.name ?? '',
    ministry: rows,
    masses: Math.round(book.masses),
    tenures: allTenures(state),
    impacts,
    formed,
    vocations: vocationsOf(state),
    offices: [...offices, ...held],
    credentials: c?.credentials ?? [],
    groupsFounded: Object.values(state.groups).filter((g) => g.foundedByPlayer).length,
    line,
  };
}
