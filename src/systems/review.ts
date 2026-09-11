import type { GameState, Letter } from '@/types';
import { sinceArrival } from './trajectory';
import { careOf, strainOf, strainWord } from './week';
import { chancesFor } from './openings';
import { isFigure } from './reputation';
import { bondWord } from './bonds';

/** The reputation and stat words the sheets use. */
function word(v: number): string {
  return v >= 60 ? 'devoted' : v >= 30 ? 'warm' : v >= 10 ? 'well disposed' : v > -10 ? 'indifferent' : v > -30 ? 'cool' : 'against you';
}
function moved(delta: number, dead = 4): string {
  return delta >= dead * 3 ? 'much warmer' : delta >= dead ? 'warmer' : delta <= -dead * 3 ? 'much colder' : delta <= -dead ? 'colder' : 'about the same';
}
const REP: Record<string, string> = { parishioners: 'The people', chancery: 'The chancery', brother_priests: 'Brother priests', public: 'The town', rome: 'Rome' };

/**
 * The year in review: one letter on the anniversary of ordination saying
 * what moved, what the chancery noticed, what the parish says, and where he
 * is headed. Reads the snapshots and the file the game already keeps.
 */
export function yearInReview(state: GameState): { letter: Letter; baseline: NonNullable<GameState['reviewBaseline']> } {
  const c = state.character!;
  const week = state.clock.week;
  const base = state.reviewBaseline;
  const years = Math.round((week - Number(state.flags.ordination_week ?? week)) / 52);
  const body: string[] = [];
  const rows: { label: string; value: string }[] = [];

  // The parish.
  const traj = state.parish ? sinceArrival(state) : null;
  const rec = state.world?.parishes.find((p) => p.id === state.parish?.parishId);
  if (traj && rec) {
    body.push(`${rec.name}, ${traj.verdict.toLowerCase()}. ${traj.rows.filter((r) => r.sign !== 0).map((r) => `${r.label}: ${r.then} to ${r.now}`).join('; ') || 'Nothing has moved that a quarter would show'}.`);
  } else if (state.study) {
    body.push(`A year away at ${state.study.school}. The diocese counts the years.`);
  }

  // What moved with each constituency.
  if (base) {
    const parts = Object.entries(REP).map(([k, label]) => `${label}: ${word(c.reputation[k as keyof typeof c.reputation])}, ${moved(c.reputation[k as keyof typeof c.reputation] - (base.reputation[k] ?? 0))}`);
    body.push(parts.join('. ') + '.');
    const statMoves = (['piety', 'theology', 'knowledge', 'charisma', 'administration'] as const).map((k) => [k, c.stats[k] - (base.stats[k] ?? c.stats[k])] as const).filter(([, d]) => Math.abs(d) >= 2);
    if (statMoves.length) rows.push({ label: 'What grew or faded', value: statMoves.map(([k, d]) => `${{ piety: 'piety', theology: 'theology', knowledge: 'learning', charisma: 'presence', administration: 'order' }[k]} ${d > 0 ? 'up' : 'down'}`).join(', ') });
  } else {
    body.push(Object.entries(REP).map(([k, label]) => `${label}: ${word(c.reputation[k as keyof typeof c.reputation])}`).join('. ') + '.');
  }

  // What the chancery noticed: the file this year.
  const year = state.career.filter((e) => e.week > week - 52 && e.week <= week);
  const noticed = year.filter((e) => e.kind === 'promotion' || e.kind === 'passed_over' || e.kind === 'offer' || e.kind === 'position' || e.kind === 'project');
  if (noticed.length) rows.push({ label: 'In the file this year', value: noticed.slice(-5).map((e) => e.text.replace(/\.$/, '')).join('; ') });
  const positions = c.positions.filter((p) => p.week > week - 52 && p.volume !== 'private').length;
  if (positions) rows.push({ label: 'Stands taken aloud', value: `${positions}${isFigure(c) ? '; you are a figure now, and generate your own weather' : ''}` });

  // What the parish says.
  if (state.parish) {
    const care = careOf(state);
    const said = care >= 0.7 ? 'that they see you, in the hospital and at the door, and that it shows on Sunday' : care >= 0.4 ? 'that you are around, mostly, and that the homilies are yours' : care >= 0.15 ? 'that you are a hard man to find outside Mass' : 'that they see you at Mass and nowhere else';
    body.push(`The parish says ${said}. ${state.parish.recycledHomilyStreak >= 3 ? 'The homily has come from the file for weeks, and people have begun to say so.' : ''}`.trim());
  }
  const bondsThisYear = Object.values(state.npcs).flatMap((n) => (n.bonds ?? []).filter((b) => b.week > week - 52 && b.week <= week).map((b) => ({ n, b })));
  if (bondsThisYear.length) rows.push({ label: 'The people this year', value: bondsThisYear.slice(0, 4).map(({ n, b }) => `${bondWord(b)} (${n.name.last})`).join('; ') + (bondsThisYear.length > 4 ? `; and ${bondsThisYear.length - 4} more` : '') });
  rows.push({ label: 'You', value: `${strainWord(strainOf(state))}, ${Math.round(years)} years a priest` });

  // Where he is headed.
  const top = state.openings.map((o) => ({ o, ch: chancesFor(state, o) })).filter((x) => !/Too soon|Not this one/.test(x.ch.verdict)).sort((a, b) => b.o.urgency - a.o.urgency)[0];
  if (state.parish && top) body.push(`Ahead: ${top.o.label.toLowerCase()} is open, and you read as ${top.ch.verdict.toLowerCase()}. ${state.parish.arcEndWeek - week <= 52 ? 'The board looks at you within the year.' : `The board looks at you in ${Math.ceil((state.parish.arcEndWeek - week) / 52)} years unless something moves it.`}`);
  else if (state.parish) body.push(`Ahead: nothing is open in the diocese that the board would consider you for. ${state.parish.arcEndWeek - week <= 52 ? 'The board looks at you within the year regardless.' : 'Another year here, then.'}`);

  const letter: Letter = { sort: 'review', title: `The year in review: ${years} years ordained`, body, rows, week };
  const baseline = { week, reputation: { ...c.reputation }, stats: { ...c.stats }, strain: strainOf(state) };
  return { letter, baseline };
}

/** Post a letter: it goes in the drawer now and into his hands the next quiet week. */
export function deliverLetter(state: GameState, letter: Letter): GameState {
  return { ...state, letters: [...(state.letters ?? []), letter], letterQueue: [...(state.letterQueue ?? []), letter] };
}

/** Open the mail: the first waiting letter stops the clock, when nothing else has. */
export function openMail(state: GameState): GameState {
  if (state.mode.kind !== 'clock' || state.pending.length > 0) return state;
  const [next, ...rest] = state.letterQueue ?? [];
  if (!next) return state;
  return { ...state, mode: { kind: 'letter', letter: next }, letterQueue: rest };
}

export function readLetter(state: GameState): GameState {
  if (state.mode.kind !== 'letter') return state;
  return openMail({ ...state, mode: { kind: 'clock' } });
}
