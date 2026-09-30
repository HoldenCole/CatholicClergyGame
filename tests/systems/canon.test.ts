import { describe, it, expect } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { offerById, offersForPhase } from '@/content/offers';
import { studyProgram } from '@/content/study';
import { eventById } from '@/content';
import { dueFlag, isOfferEligible, offersWeek } from '@/engine/offers';
import { evaluateAll } from '@/engine/conditions';
import { nuncioView } from '@/systems/rome/nuncioView';
import { REQUESTABLE_POSTS } from '@/systems/request';
import { acceptAndGo } from '../helpers/appointment';
import type { GameState } from '@/types';

function canonist(seed: string, flags: Record<string, boolean> = {}): GameState {
  const s = parishState(seed);
  return {
    ...s,
    phase: 'pastor',
    clock: { ...s.clock, week: s.clock.week + 52 * 7 },
    character: { ...s.character!, credentials: [...s.character!.credentials, 'JCL'], reputation: { ...s.character!.reputation, chancery: 30 } },
    flags: { ...s.flags, 'held:office:tribunal': true, ...flags },
    // The fixture's own letters are cleared: the guarantee needs room on the table.
    offers: [],
  };
}

describe('canon law that does something', () => {
  it("the judicial vicar's chair is a post, its letter is promised to a canonist who served the tribunal, and it can be asked for", () => {
    expect(studyProgram('judicial_vicar')).toMatchObject({ kind: 'post', city: 'tribunal' });
    expect(REQUESTABLE_POSTS).toContain('pa_judicial_vicar');
    const def = offerById('pa_judicial_vicar')!;
    const s = canonist('jv');
    expect(isOfferEligible(def, s)).toBe(true);
    expect(isOfferEligible(def, { ...s, character: { ...s.character!, credentials: [] } })).toBe(false);
    const defs = offersForPhase('pastor');
    let t = s;
    let arrived: number | null = null;
    for (let i = 0; i < def.guarantee!.withinWeeks + 2 && arrived === null; i++) {
      t = offersWeek({ ...t, clock: { ...t.clock, week: t.clock.week + 1 } }, createRng(`jv${i}`), defs, offerById);
      if (t.offers.some((o) => o.offerId === def.id)) arrived = i;
      // The promise is written down the first week, unless the letter came that very week and spent it.
      if (i === 0) expect(typeof t.flags[dueFlag(def)] === 'number' || arrived === 0).toBe(true);
    }
    expect(arrived).not.toBeNull();
  });

  it("accepting it sends him to the tribunal, where the tribunal's scenes fire and the vicar general's do not", () => {
    const s0 = canonist('jv:go');
    const s = { ...s0, offers: [{ offerId: 'pa_judicial_vicar', arrivedWeek: s0.clock.week, expiresWeek: s0.clock.week + 3, bindings: {} }] };
    const away = acceptAndGo(s, offerById('pa_judicial_vicar')!, createRng('go')).state;
    expect(away.phase).toBe('study');
    expect(away.study?.program).toBe('judicial_vicar');
    expect(away.flags['study:tribunal']).toBe(true);
    expect(away.flags['study:chancery']).toBeUndefined();
    expect(away.flags['office:judicial_vicar']).toBe(true);
    expect(evaluateAll(eventById('jv_the_docket')!.requires ?? [], away)).toBe(true);
    expect(evaluateAll(eventById('vg_board_friend')!.requires ?? [], away)).toBe(false);
    expect(away.study?.place).toMatchObject({ cases: 0, bishop: 0, priests: 0 });
    for (const id of ['jv_the_docket', 'jv_the_pastor_on_the_phone', 'jv_the_sentence_you_believe', 'jv_the_priest_case', 'jv_the_rota_letter', 'jv_the_successor']) {
      const e = eventById(id)!;
      expect([e.phase].flat(), id).toContain('study');
      expect(e.choices.some((c) => c.roll), id).toBe(true);
    }
  });

  it('the cases come to a canonist in the parish years, each turning on a roll of knowledge, and the years as judicial vicar are read by the nuncio', () => {
    const ids = ['cn_pastor_wedding', 'cn_the_petitioner', 'cn_the_priest_removed', 'cn_the_dispensation', 'cn_the_school_contract', 'cn_the_appeal', 'cn_the_consult', 'cn_the_parish_closing', 'cn_the_seal_question', 'cn_the_loan_request'];
    const plain = parishState('cn:plain');
    const jcl = canonist('cn:jcl');
    for (const id of ids) {
      const e = eventById(id)!;
      expect(e.choices.some((c) => c.roll && (c.roll.stat === 'knowledge' || c.roll.stat === 'administration')), id).toBe(true);
      expect(evaluateAll(e.requires ?? [], { ...plain, phase: 'pastor' }), id).toBe(false);
    }
    expect(evaluateAll(eventById('cn_the_priest_removed')!.requires ?? [], jcl)).toBe(true);
    expect(evaluateAll(eventById('cn_pastor_wedding')!.requires ?? [], { ...plain, flags: { ...plain.flags, tribunal_ready: true } })).toBe(true);
    const before = nuncioView(jcl).value;
    const after = nuncioView({ ...jcl, flags: { ...jcl.flags, jv_served: true } });
    expect(after.value).toBeGreaterThan(before);
    expect(after.good).toContain('the years as judicial vicar');
  });
});
