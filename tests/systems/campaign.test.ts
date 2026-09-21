import { describe, expect, it } from 'vitest';
import { seminaryState } from '../helpers/fixtures';
import { campaignDefs } from '@/content/campaigns';
import { religiousOrders } from '@/content/religious';
import { campaignOf, constituenciesOf, constituencyLabel, institutionWords, pillarsOf, resolveConstituency } from '@/systems/campaign';
import { applyEffects } from '@/engine/effects';
import { evaluateCondition } from '@/engine/conditions';
import { emptyReputation, standing } from '@/systems/reputation';
import { formationWeek, setEmphasis } from '@/systems/formation';
import { ALL_CONSTITUENCY_KEYS, CONSTITUENCY_KEYS, PILLARS, RELIGIOUS_CONSTITUENCY_KEYS, STAT_KEYS, type GameState, type ReligiousPlayerState } from '@/types';

function friar(seed = 'friar'): GameState {
  const s = seminaryState(seed);
  const religious: ReligiousPlayerState = { order: 'OP', provinceId: 'op_st_joseph', houseId: 'op_st_joseph:house1', vows: { renewals: [] }, perceivedAmbition: 10, termsServed: [] };
  return { ...s, campaign: 'religious', religious };
}

describe('per-campaign constituencies (E3 §3.9, §13.2)', () => {
  it('a save without the field is the base game, and its set is the seven keys it always had', () => {
    const s = seminaryState();
    expect(s.campaign).toBeUndefined();
    expect(campaignOf(s)).toBe('diocesan');
    expect(constituenciesOf(s).map((c) => c.key)).toEqual([...CONSTITUENCY_KEYS]);
    expect(Object.keys(emptyReputation())).toEqual([...CONSTITUENCY_KEYS]);
    expect(institutionWords(s)).toEqual({ noun: 'the diocese', superior: 'the bishop' });
  });

  it('the two sets are data, every key of the union belongs to one, and the shared keys have their own labels', () => {
    expect(campaignDefs.map((c) => c.id)).toEqual(['diocesan', 'religious']);
    const religious = campaignDefs[1]!;
    expect(religious.constituencies.map((c) => c.key)).toEqual([...RELIGIOUS_CONSTITUENCY_KEYS.slice(0, 6), 'rome', 'observant_bloc', 'progressive_bloc']);
    for (const key of ALL_CONSTITUENCY_KEYS) expect(campaignDefs.some((c) => c.constituencies.some((k) => k.key === key)), key).toBe(true);
    for (const def of campaignDefs) for (const c of def.constituencies) expect(ALL_CONSTITUENCY_KEYS).toContain(c.key);
    expect(constituencyLabel(friar(), 'progressive_bloc')).toBe("the province's progressive wing");
    expect(constituencyLabel(seminaryState(), 'progressive_bloc')).toBe('the progressive wing');
  });

  it('a scene written for the diocese lands on the friar\'s people, and the other way round', () => {
    const f = friar();
    expect(resolveConstituency(f, 'parishioners')).toBe('laity');
    expect(resolveConstituency(f, 'chancery')).toBe('local_bishop');
    expect(resolveConstituency(f, 'traditional_bloc')).toBe('observant_bloc');
    expect(resolveConstituency(f, 'rome')).toBe('rome');
    expect(resolveConstituency(f, 'community')).toBe('community');
    const d = seminaryState();
    expect(resolveConstituency(d, 'laity')).toBe('parishioners');
    expect(resolveConstituency(d, 'province')).toBe('brother_priests');
    expect(resolveConstituency(d, 'parishioners')).toBe('parishioners');
    const moved = applyEffects(f, [{ target: 'reputation', key: 'parishioners', delta: 5 }]);
    expect(moved.character!.reputation.laity).toBe(5);
    expect(moved.character!.reputation.parishioners).toBe(0);
    expect(standing(moved.character!.reputation, 'laity')).toBe(5);
    expect(standing(f.character!.reputation, 'laity')).toBe(0);
    expect(evaluateCondition({ type: 'reputation', key: 'parishioners', op: '>=', value: 5 }, moved)).toBe(true);
    expect(evaluateCondition({ type: 'reputation', key: 'laity', op: '<=', value: 0 }, f)).toBe(true);
    // The base game is untouched: the diocesan keys still take their own effects.
    const base = applyEffects(d, [{ target: 'reputation', key: 'parishioners', delta: 5 }]);
    expect(base.character!.reputation).toEqual({ ...emptyReputation(), parishioners: 5 });
  });
});

describe('data-driven pillars (E3 §5, §13.3)', () => {
  it('the diocesan pillars are the base game\'s four, and an order renames them without changing the ids', () => {
    expect(pillarsOf(seminaryState()).map((p) => [p.id, p.label])).toEqual([['human', 'Human'], ['spiritual', 'Spiritual'], ['intellectual', 'Intellectual'], ['pastoral', 'Pastoral']]);
    expect(pillarsOf(friar()).map((p) => p.label)).toEqual(['Community', 'Prayer', 'Study', 'Preaching']);
    expect(pillarsOf({ ...friar(), religious: { ...friar().religious!, order: 'OSA' } }).map((p) => p.label)).toEqual(['Community', 'Interiority', 'Truth', 'Service']);
    for (const def of [...campaignDefs.map((c) => c.pillars), ...religiousOrders.map((o) => o.pillars)]) {
      expect(def.map((p) => p.id)).toEqual([...PILLARS]);
      for (const p of def) {
        expect(p.stats.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
        for (const s of p.stats) expect(STAT_KEYS).toContain(s.key);
      }
    }
  });

  it('a week of formation feeds the stats the campaign\'s table names, the same numbers as before', () => {
    const emphasis = { human: 2, spiritual: 3, intellectual: 3, pastoral: 2 };
    const d = formationWeek(setEmphasis(seminaryState('pillars'), emphasis));
    const f = formationWeek(setEmphasis(friar('pillars'), emphasis));
    // Same shares in both tables, so a Dominican's Study week moves theology as a seminarian's Intellectual week does.
    expect(f.character!.stats).toEqual(d.character!.stats);
    expect(d.character!.stats.theology).toBeGreaterThan(seminaryState('pillars').character!.stats.theology);
  });
});

describe('orders are data (E3 §18)', () => {
  it('no engine or system code tests an order key', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap((f) => (fs.statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));
    const files = [...walk('src/engine'), ...walk('src/systems'), ...walk('src/generation')].filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      expect(/===\s*'(OP|OSA|OFM)'|'(OP|OSA|OFM)'\s*===/.test(text), f).toBe(false);
    }
  });

  it('the two orders carry seven-year formation, governance with terms, and the mechanics the doc names', () => {
    expect(religiousOrders.map((o) => o.key)).toEqual(['OP', 'OSA']);
    for (const o of religiousOrders) {
      expect(o.formation.map((s) => s.year)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(o.formation.at(-1)!.milestone).toBe('ordination');
      expect(o.formation.some((s) => s.milestone === 'solemn_profession')).toBe(true);
      expect(o.governance.provincialTermYears).toBeGreaterThan(0);
      expect(o.provinces.length).toBeGreaterThanOrEqual(3);
    }
    const op = religiousOrders[0]!;
    expect(op.mechanics.studyApDiscount).toBe(0.25);
    expect(op.mechanics.religiousName).toBe(true);
    expect(op.governance.generalRenewable).toBe(false);
    const osa = religiousOrders[1]!;
    expect(osa.mechanics.annualVowRenewal).toBe(true);
    expect(osa.mechanics.closeFriendSlots).toBe(3);
    expect(osa.governance.generalRenewable).toBe(true);
    expect(osa.formation.filter((s) => s.milestone === 'renewal').every((s) => s.communityVote)).toBe(true);
  });
});
