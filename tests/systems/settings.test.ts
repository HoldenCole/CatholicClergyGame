import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { seminaryState } from '../helpers/fixtures';
import { createRng } from '@/engine/rng';
import { newGame } from '@/engine/game';
import { generateCandidates, installWorld } from '@/generation/world';
import { generateDiocese } from '@/generation/diocese';
import { diocesePresets } from '@/content/dioceses';
import { resolveWeek, weekBudget, WEEK } from '@/systems/week';
import { seminaryBudget, seminaryWeek, setSeminaryActivity } from '@/systems/seminaryWeek';
import { WORK_WEEKS } from '@/systems/workweek';
import { formationStanding } from '@/systems/standing';
import { scoreParish } from '@/systems/assignment';
import { likelyPlacement } from '@/systems/placement';
import { creationContent } from '@/content/creation';
import { defaultAnswers } from '../helpers/career';
import { buildSave, deserialize, serialize } from '@/engine/save';
import type { GameState } from '@/types';

function weeks(s: GameState, n: number, seed: string): GameState {
  let next = s;
  for (let i = 0; i < n; i++) next = resolveWeek({ ...next, clock: { ...next.clock, week: next.clock.week + 1 } }, createRng(`${seed}:${i}`)).state;
  return next;
}

describe('the week and the wear are the player\'s to set', () => {
  it('the work week stretches or shrinks the parish, the seminary, and what a long week costs', () => {
    const s = parishState('ww');
    expect(weekBudget(s)).toBe(12);
    const long: GameState = { ...s, settings: { workWeek: 'long', wear: 1 } };
    const light: GameState = { ...s, settings: { workWeek: 'light', wear: 1 } };
    expect(weekBudget(long)).toBe(14);
    expect(weekBudget(light)).toBe(10);
    expect(weekBudget({ ...s, settings: { workWeek: 'punishing', wear: 1 } })).toBe(16);
    const sem = seminaryState('ww-sem');
    const base = seminaryBudget(sem);
    expect(seminaryBudget({ ...sem, settings: { workWeek: 'long', wear: 1 } })).toBe(base + WORK_WEEKS.long.free);
    expect(seminaryBudget({ ...sem, settings: { workWeek: 'light', wear: 1 } })).toBe(base - 1);
    // A long week wears; a light one rests; the wear dial scales it, and at zero nothing wears at all.
    const worn = weeks(long, 30, 'worn');
    expect(worn.strain).toBeGreaterThan(20);
    const brutal = weeks({ ...s, settings: { workWeek: 'long', wear: 2 } }, 30, 'brutal');
    expect(brutal.strain).toBeGreaterThan(worn.strain * 1.5);
    const none = weeks({ ...s, settings: { workWeek: 'punishing', wear: 0 }, parish: { ...s.parish!, routine: { ...s.parish!.routine, sacrifices: ['sleep', 'day_off'] } } }, 30, 'none');
    expect(none.strain).toBe(0);
    expect(weeks(s, 30, 'rest').strain).toBe(0);
    // Past the sick line the body takes an hour back everywhere, seminary included.
    const sick: GameState = { ...sem, strain: WEEK.strainSick };
    expect(seminaryBudget(sick)).toBe(base - 1);
    let semLong: GameState = setSeminaryActivity({ ...sem, settings: { workWeek: 'punishing', wear: 2 } }, 'study', 3);
    for (let i = 0; i < 20; i++) semLong = seminaryWeek({ ...semLong, clock: { ...semLong.clock, week: semLong.clock.week + 1 } }, createRng(`sl:${i}`)).state;
    expect(semLong.strain).toBeGreaterThan(30);
  });

  it('a v4 save lifts strain off the parish and the settings default', () => {
    const s = parishState('save5');
    const rng = createRng(s.seed);
    const v4 = JSON.parse(serialize(buildSave({ ...s, strain: 0 }, rng, null, {})));
    delete v4.state.strain;
    v4.state.parish.strain = 42;
    v4.version = 4;
    const back = deserialize(JSON.stringify(v4));
    expect(back.state.strain).toBe(42);
    expect(back.state.settings).toBeUndefined();
    expect(weekBudget(back.state)).toBe(12);
  });
});

describe('every diocese is short, and reads as its own place', () => {
  it('no diocese rolls below stretched', () => {
    for (const preset of diocesePresets) {
      for (let i = 0; i < 60; i++) {
        const d = generateDiocese(createRng(`short-${preset.id}-${i}`), preset, 2010);
        expect(d.diocese.hidden.shortage, preset.id).toBeGreaterThanOrEqual(3);
        expect(['stretched', 'critically_short']).toContain(d.diocese.visible.clergyNeed);
      }
    }
  });

  it('the seminary years write flags the file and the bishop read', () => {
    const s = seminaryState('flags');
    const base = formationStanding(s).value;
    expect(formationStanding({ ...s, flags: { ...s.flags, rector_recommends: true, noticed_by_bishop: true } }).value).toBe(base + 20);
    expect(formationStanding({ ...s, flags: { ...s.flags, rector_doubts: true, bishop_wary: true } }).value).toBe(base - 22);
    expect(formationStanding({ ...s, flags: { ...s.flags, seminary_leader: true } }).reasons).toContain('the house followed you');
    const p = parishState('known');
    const flagship = p.world!.parishes.find((x) => x.kind === 'flagship_suburban')!;
    const plain = scoreParish(p, p.world!, flagship).score;
    const scholar = scoreParish({ ...p, flags: { ...p.flags, known_scholar: true } }, p.world!, flagship);
    expect(scholar.score).toBeGreaterThan(plain + 10);
    expect(scholar.reasons.join(' ')).toMatch(/scholar/);
  });

  it('the diocese step can say where a man like this would probably land, from visible facts only', () => {
    const { state } = newGame({ seed: 'place', start: { year: 2010, month: 8, day: 20 } });
    const cands = generateCandidates(createRng('place'), 2010);
    const rural = { ...defaultAnswers, origin: 'rural' as typeof defaultAnswers.origin };
    for (const c of cands) {
      const pl = likelyPlacement(state, rural, c, creationContent, 2010);
      expect(pl, c.presetId).not.toBeNull();
      expect(pl!.ranked.length).toBe(c.parishes.length);
      expect(c.parishes.map((p) => p.id)).toContain(pl!.parish.id);
      // Deterministic, and the same whichever hidden shortage the diocese rolled.
      const again = likelyPlacement(state, rural, c, creationContent, 2010)!;
      expect(again.parish.id).toBe(pl!.parish.id);
      const shortest = { ...c, diocese: { ...c.diocese, hidden: { ...c.diocese.hidden, shortage: 5 } } };
      expect(likelyPlacement(state, rural, shortest, creationContent, 2010)!.parish.id).toBe(pl!.parish.id);
    }
    // The state passed in is untouched.
    expect(state.world).toBeNull();
    expect(installWorld(state, cands[0]!, 2010).world).not.toBeNull();
  });
});
