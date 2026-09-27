import type { GameState, Letter } from '@/types';
import type { Rng } from '@/engine/rng';
import { prioritiesLine } from '@/generation/diocese';
import { clampSigned } from './reputation';
import { driftRome, successionYear } from './succession';
import { advanceTrajectories } from './trajectories';

/**
 * E1 §9 E — the home diocese while he is a bishop elsewhere, or pope. It goes
 * on without him: its bishop retires or dies and Rome names another, and the
 * men he was ordained with have their years. None of it is his turn. The new
 * bishop is not his bishop, so nothing of his is reread and no scene is owed;
 * it comes as news from home, and the new man writes to him as a brother
 * bishop (or, if he is pope, is a man he named). Invented and flagged.
 */
export type Afar = 'see' | 'service' | 'pope';

/** Whether the man is away from his home diocese for good: a see of his own, or the chair of Peter. */
export function afar(state: GameState): Afar | null {
  if (state.rome?.pontificate) return 'pope';
  // A see of his own, or a nunciature: a bishop elsewhere either way (E1 §11).
  if (state.see || state.rome?.diplomacy?.rank === 'nuncio') return 'see';
  // A priest of the Holy See's diplomatic service: still incardinated at home, but the Secretariat moves him now (E1 §11).
  if (state.rome?.diplomacy && state.study?.city === 'nunciature') return 'service';
  return null;
}

/** How a new bishop at home regards a brother bishop, or the pope, who came from his diocese: by how near their readings are. */
const REGARD = { base: 10, perGap: 0.25 } as const;

export interface HomeYear {
  state: GameState;
  lines: string[];
  letter: Letter | null;
}

/** The home see changes hands, if its year says so: installed without rereading him, and told to him as news from home. */
export function homeSuccession(state: GameState, rng: Rng): HomeYear {
  const where = afar(state);
  const world = state.world;
  if (!where || !world) return { state, lines: [], letter: null };
  const r = successionYear(state, rng, { afar: true });
  const bishop = r.newBishop;
  if (!bishop) return { state, lines: [], letter: null };
  const c = state.character!;
  const gap = Math.abs(bishop.alignment - c.alignment);
  const regard = Math.round(clampSigned(REGARD.base + (40 - gap) * REGARD.perGap));
  const see = world.diocese.visible.see;
  const name = `${bishop.title} ${bishop.name.first} ${bishop.name.last}`;
  const v = r.state.world!.diocese.visible.bishop;
  const body: string[] = [
    r.lines[0]!,
    `${v.temperamentLine} He says his priorities are ${prioritiesLine(v.priorities)}. The priests you were ordained with will find out what he meant; you will hear it from them.`,
    gap < 20 ? 'He reads the Church much as you do. Some of the men at home will say Rome sent them one of yours.' : gap < 45 ? 'He reads the Church a little otherwise than you do, which the diocese will notice before he does.' : 'He reads the Church otherwise than you do, and the men at home who took their lead from you will feel it first.',
    where === 'pope'
      ? `The Dicastery for Bishops brought the terna for ${see} with the Saturday files, the diocese that ordained you, and you signed the name they had put first. It is the only nomination of the year you read twice.`
      : where === 'service'
        ? 'On paper you are still a priest of his diocese; in fact the Secretariat of State moves you, and he knows it. He writes once, kindly, and says the door is open if you are ever home in the summer.'
        : 'He is not your bishop and you are not his priest: he writes to you as a brother bishop, and asks you to come home one year for the chrism Mass.',
  ];
  const next: GameState = {
    ...r.state,
    npcs: { ...r.state.npcs, [bishop.id]: { ...r.state.npcs[bishop.id]!, relationship: regard } },
    career: [...r.state.career, { week: state.clock.week, kind: 'note', text: `At home, ${name} was named bishop of ${see}.` }],
  };
  return { state: next, lines: [`From home: ${name} is the new bishop of ${see}.`], letter: { sort: 'bishop', title: `From home: a new bishop of ${see}`, body, week: state.clock.week } };
}

/**
 * The home diocese's year for a pope, who has no diocesan year of his own:
 * Rome's temper follows him, the men he was ordained with have their years,
 * and the home see changes hands on its own schedule.
 */
export function popeHomeYear(state: GameState, rng: Rng): HomeYear {
  let s = driftRome(state, rng.derive(`rome:${state.clock.week}`));
  const at = s.flags.ordination_week;
  const lines: string[] = [];
  if (typeof at === 'number') {
    const traj = advanceTrajectories(s, Math.round((s.clock.week - at) / 52));
    s = traj.state;
    lines.push(...traj.lines);
  }
  const home = homeSuccession(s, rng.derive(`succession:${s.clock.week}`));
  return { state: home.state, lines: [...lines, ...home.lines], letter: home.letter };
}
