import { describe, expect, it } from 'vitest';
import { allEvents, eventById } from '@/content';
import { offerById } from '@/content/offers';
import { createRng } from '@/engine/rng';
import { renderText } from '@/engine/text';
import { evaluateAll } from '@/engine/conditions';
import { isEligible } from '@/engine/events';
import { beginStudy } from '@/engine/study';
import { parishState } from '../systems/week.test';
import type { GameState } from '@/types';

/** A priest sent on one of Rome's postings, the letter answered, the first week there. */
function posted(seed: string, offerId: string): GameState {
  const base = parishState(seed);
  const def = offerById(offerId)!;
  const c = base.character!;
  const s: GameState = {
    ...base,
    flags: { ...base.flags, ordination_week: base.clock.week - 4 * 52, rome_alumnus: true, nac_alumnus: true },
    character: { ...c, credentials: [...c.credentials, 'italian', 'STL'], reputation: { ...c.reputation, rome: 40, chancery: 30 } },
  };
  // Straight to the posting: the letter's requirements are another test's business.
  const gone = beginStudy(s, def, false, createRng(`${seed}:go`));
  return { ...gone, clock: { ...gone.clock, week: gone.clock.week + 1 } };
}

const POOLS: { flag: string; offer: string; prefix: RegExp; atLeast: number }[] = [
  { flag: 'study:rome', offer: 'pv_rome_study', prefix: /^st_/, atLeast: 22 },
  { flag: 'study:college', offer: 'rome_nac_formator', prefix: /^nf_/, atLeast: 7 },
  { flag: 'study:vatican', offer: 'rome_vatican_chaplain', prefix: /^vc_/, atLeast: 7 },
  { flag: 'study:curia', offer: 'rome_curia_official', prefix: /^cu_/, atLeast: 33 },
];

describe('Rome has its flavour (owner: Rome in general is stale)', () => {
  it('each Roman posting has a pool of its own, gated on its flag, and nothing of one leaks into another', () => {
    for (const pool of POOLS) {
      const scenes = allEvents.filter((e) => pool.prefix.test(e.id) && JSON.stringify(e.requires ?? []).includes(pool.flag));
      expect(scenes.length, pool.flag).toBeGreaterThanOrEqual(pool.atLeast);
    }
    const stays = allEvents.filter((e) => /^(nf|vc)_/.test(e.id));
    for (const e of stays) expect(JSON.stringify(e.requires), e.id).toMatch(/study:(college|vatican)/);
    // The letter from home and the pilgrims no longer come every other year.
    expect(eventById('st_classmates_letter')!.suppressYears).toBeGreaterThanOrEqual(5);
    expect(eventById('st_pilgrims_from_home')!.suppressYears).toBeGreaterThanOrEqual(3);
    // The seasons and the months are the Roman year's.
    expect(JSON.stringify(eventById('st_station_churches')!.requires)).toContain('"lent"');
    expect(JSON.stringify(eventById('st_easter_vigil')!.requires)).toContain('"holy_week"');
    expect(JSON.stringify(eventById('vc_christmas_eve')!.requires)).toContain('"christmas"');
    expect(JSON.stringify(eventById('nf_diaconate_served')!.requires)).toContain('"month"');
    expect(JSON.stringify(eventById('cu_jubilee')!.requires)).toContain('2025');
    expect(eventById('st_thesis_defense')!.choices[0]!.roll?.stat).toBe('theology');
  });

  it('every scene of the four pools renders clean against a man in that posting, and the first weeks have their scenes', () => {
    for (const pool of POOLS) {
      const s = posted(`rome-flavour:${pool.flag}`, pool.offer);
      expect(s.flags[pool.flag], pool.flag).toBe(true);
      const scenes = allEvents.filter((e) => pool.prefix.test(e.id) && JSON.stringify(e.requires ?? []).includes(pool.flag));
      for (const e of scenes) {
        const text = [e.title, e.body, ...e.choices.flatMap((c) => [c.label, c.outcome ?? '', c.roll?.success.outcome ?? '', c.roll?.failure.outcome ?? ''])].join(' ');
        const rendered = renderText(text, s, {});
        expect(rendered, e.id).not.toMatch(/\{[a-z_]+\}/);
        // The selectors a scene away may use resolve for a man with a bishop and no parish.
        for (const sel of rendered.match(/\{@[a-z_]+(\.[a-z]+)?\}/g) ?? []) expect(['{@bishop}', '{@bishop.full}', '{@bishop.first}', '{@curia_prefect}', '{@curia_secretary}', '{@curia_colleague}', '{@closest_classmate}', '{@random_classmate}', '{@vicar_for_clergy}', '{@chancellor}', '{@brother_priest}', '{@nuncio}', '{@pope}'].some((ok) => sel.startsWith(ok.replace(/\}$/, ''))), `${e.id}: ${sel}`).toBe(true);
      }
      // A first-week scene is eligible in the first week; a late one is not yet.
      const first = scenes.filter((e) => JSON.stringify(e.requires).includes('"weeks_away","op":"<="'));
      expect(first.length, pool.flag).toBeGreaterThanOrEqual(1);
      for (const e of first) expect(evaluateAll(e.requires!, s), e.id).toBe(true);
      const late = scenes.filter((e) => JSON.stringify(e.requires).includes('"weeks_away","op":">="'));
      for (const e of late) expect(evaluateAll(e.requires!, s), e.id).toBe(false);
      // Nothing of the other pools is eligible here.
      for (const other of POOLS) if (other !== pool) for (const e of allEvents.filter((x) => other.prefix.test(x.id) && JSON.stringify(x.requires ?? []).includes(other.flag))) expect(isEligible(e, s), `${e.id} in ${pool.flag}`).toBe(false);
    }
  });
});
