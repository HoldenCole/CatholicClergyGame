import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { eventById } from '@/content';
import { offerById } from '@/content/offers';
import { seeAct } from '@/content/see';
import { isEligible } from '@/engine/events';
import { evaluateAll } from '@/engine/conditions';
import { acceptOffer } from '@/engine/offers';
import { applyEffects } from '@/engine/effects';
import { startAssignment } from '@/engine/parish';
import { renderText } from '@/engine/text';
import { buildSave, deserialize, serialize } from '@/engine/save';
import { actAvailable, beginAct, signAct } from '@/systems/bishop/desk';
import { metropoliaSees, metropolitanOf } from '@/systems/metropolia';
import { excardinationChance, homeCarry, incardinate, lendableSees, LOAN, loanAvailable, loanReleaseChance, loanWeek, loanWeekForSee, moveToDiocese, returnHome } from '@/systems/loan';
import { nuncioWeek } from '@/systems/rome/nuncio';
import { acceptAndGo } from '../helpers/appointment';
import { parishState } from './week.test';
import type { GameState } from '@/types';

const fits = (id: string, s: GameState) => isEligible(eventById(id)!, s);

/** A pastor of five years with Spanish, the loan offer open on his desk. */
function pastor(seed: string): GameState {
  const s = parishState(seed);
  return { ...s, phase: 'pastor', assignment: { ...s.assignment!, role: 'pastor' }, clock: { ...s.clock, week: 52 * 6 }, flags: { ...s.flags, ordination_week: 0, speaks_spanish: true } };
}

/** On loan: the home bishop said yes, the man is in the other diocese with the letter of appointment read and the parish begun. */
function onLoan(seed: string): { home: GameState; away: GameState; seeId: string } {
  const home = pastor(seed);
  const see = lendableSees(home)[0]!;
  const moved = moveToDiocese(home, see.id, 'spanish', LOAN.years.spanish, createRng(`${seed}:move`));
  const away = startAssignment({ ...moved.state, mode: { kind: 'clock' } }, createRng(`${seed}:start`));
  return { home, away, seeId: see.id };
}

describe('E2 R1.3: the loan asked for, and the home bishop\'s answer', () => {
  it('a brother bishop\'s ask is an offer a pastor with the thing asked for can get, and a yes puts the answer on the calendar', () => {
    const s = pastor('ask');
    expect(loanAvailable(s)).toBe(true);
    expect(lendableSees(s).length).toBeGreaterThanOrEqual(1);
    const def = offerById('ln_loan_spanish')!;
    expect(evaluateAll(def.requires, s)).toBe(true);
    expect(evaluateAll(offerById('ln_loan_canonist')!.requires, s)).toBe(false);
    const asker = metropolitanOf(s) ?? s.npcs[lendableSees(s)[0]!.bishopId!]!;
    const open = { ...s, offers: [{ offerId: def.id, arrivedWeek: s.clock.week, expiresWeek: s.clock.week + 3, bindings: { '@province_bishop': asker.id } }] };
    const r = acceptOffer(open, def, createRng('yes'));
    const flags = r.state.flags;
    expect(typeof flags['loan:asked']).toBe('number');
    expect((flags['loan:asked'] as number) - s.clock.week).toBeGreaterThanOrEqual(LOAN.waitWeeks[0]);
    expect(flags['loan:kind']).toBe('spanish');
    expect(lendableSees(s).some((x) => x.id === flags['loan:see'])).toBe(true);
    // A bishop of a generated see (no pool city to roll) cannot borrow him: the ask goes to a see that can be a world.
    const genSee = metropoliaSees(s).find((x) => !x.poolId);
    if (genSee?.bishopId) { const r2 = acceptOffer({ ...open, offers: [{ ...open.offers[0]!, bindings: { '@province_bishop': genSee.bishopId } }] }, def, createRng('gen')); expect(lendableSees(s).some((x) => x.id === r2.state.flags['loan:see'])).toBe(true); }
    expect(loanAvailable(r.state)).toBe(false);
    // Before its week nothing happens; on it the bishop answers, one way or the other, and the man is not asked twice.
    expect(loanWeek(r.state, createRng('early')).state).toBe(r.state);
    const due = { ...r.state, clock: { ...r.state.clock, week: flags['loan:asked'] as number } };
    let went = 0; let kept = 0;
    for (let i = 0; i < 30; i++) {
      const w = loanWeek(due, createRng(`answer:${i}`));
      expect(w.state.flags['loan:asked']).toBeUndefined();
      expect(w.letters).toHaveLength(1);
      if (w.state.loan) { went++; expect(w.state.mode.kind).toBe('assignment'); expect(w.letters[0]!.title).toMatch(/^Lent to /); }
      else { kept++; expect(w.state.flags['loan:refused']).toBe(due.clock.week); expect(fits('ln_refused_release', w.state)).toBe(true); }
    }
    expect(went).toBeGreaterThan(5);
    expect(kept).toBeGreaterThan(0);
    // The release reads the diocese's need and the bishop's regard.
    const p = loanReleaseChance(s);
    const cold = { ...s, npcs: { ...s.npcs, [s.world!.diocese.hidden.bishop.npcId]: { ...s.npcs[s.world!.diocese.hidden.bishop.npcId]!, relationship: -40 } } };
    expect(loanReleaseChance(cold)).toBeLessThan(p);
    const short = { ...s, world: { ...s.world!, diocese: { ...s.world!.diocese, visible: { ...s.world!.diocese.visible, clergyNeed: 'critically_short' as const } } } };
    expect(loanReleaseChance(short)).toBeLessThan(p);
  });
});

describe('E2 R1.3: the loan as a world', () => {
  it('the man lives in the borrowing diocese, under the bishop the province knew, with home waiting in the territory', () => {
    const { home, away, seeId } = onLoan('world');
    const homeId = home.world!.diocese.presetId;
    const see = metropoliaSees(home).find((x) => x.id === seeId)!;
    expect(away.loan).toMatchObject({ seeId, homeId, kind: 'spanish', years: 3, leftAs: 'pastor' });
    expect(away.loan!.endWeek).toBe(home.clock.week + 52 * 3);
    expect(away.world!.diocese.presetId).not.toBe(homeId);
    expect(away.world!.diocese.visible.see).toBe(see.see);
    expect(away.territory![homeId]!.diocese.presetId).toBe(homeId);
    expect(away.homeDioceseId).toBe(homeId);
    expect(away.flags[`diocese:${away.world!.diocese.presetId}`]).toBe(true);
    expect(away.flags[`diocese:${homeId}`]).toBeUndefined();
    // The bishop is the province's man, not a stranger rolled twice.
    expect(away.world!.diocese.hidden.bishop.npcId).toBe(see.bishopId);
    expect(away.npcs[see.bishopId!]!.tags).toContain(`diocese:${away.world!.diocese.presetId}`);
    expect(away.world!.diocese.visible.bishop.name).toContain(away.npcs[see.bishopId!]!.name.last);
    // The province from here: home among the other sees with its own bishop, the borrowed see gone from them.
    const m = away.world!.metropolia!;
    expect(m.sees.some((x) => x.id === homeId && x.bishopId === home.world!.diocese.hidden.bishop.npcId)).toBe(true);
    expect(m.sees.some((x) => x.id === seeId)).toBe(false);
    // The parish loop runs: a Spanish parish, a pastor's chair, the standings that belong to a place reset.
    expect(away.parish).toBeDefined();
    // A pastor's chair where one is vacant, else the administrator's: never a vicar's.
    expect(['pastor', 'administrator']).toContain(away.assignment!.role);
    const parish = away.world!.parishes.find((p) => p.id === away.assignment!.parishId)!;
    expect(parish.needsSpanish || !away.world!.parishes.some((p) => p.needsSpanish && !p.cathedral)).toBe(true);
    expect(away.character!.reputation.chancery).toBe(LOAN.arrivalChancery);
    expect(away.character!.reputation.brother_priests).toBe(0);
    expect(away.loan!.homeFile.chancery).toBe(home.character!.reputation.chancery);
    expect(away.formerParishes![home.assignment!.parishId]).toBeDefined();
    expect(away.career.some((c) => /^Lent to /.test(c.text))).toBe(true);
    // The scenes of a loan open; the tokens name the places.
    expect(fits('ln_arrive', away)).toBe(true);
    expect(fits('ln_stranger', away)).toBe(false);
    const later = { ...away, clock: { ...away.clock, week: away.clock.week + 60 } };
    expect(fits('ln_stranger', later)).toBe(true);
    expect(fits('ln_letter_from_home', later)).toBe(true);
    expect(fits('ln_ask_excardination', { ...later, clock: { ...later.clock, week: away.clock.week + 90 } })).toBe(true);
    expect(renderText('{loan_home} / {loan_diocese} / {loan_bishop}', away, {})).toBe(`${home.world!.diocese.visible.name} / ${away.world!.diocese.visible.name} / ${away.npcs[see.bishopId!]!.title} ${away.npcs[see.bishopId!]!.name.last}`);
    // No second loan while on one.
    expect(loanAvailable(away)).toBe(false);
    // Same seed, same move.
    const again = moveToDiocese(home, seeId, 'spanish', 3, createRng('world:move'));
    expect(again.state.world!.diocese).toEqual(moveToDiocese(home, seeId, 'spanish', 3, createRng('world:move')).state.world!.diocese);
    // The whole of it survives a save.
    const back = deserialize(serialize(buildSave(away, createRng(away.seed), null, {})));
    expect(back.state.loan).toEqual(away.loan);
    expect(back.state.territory![homeId]).toEqual(away.territory![homeId]);
  });

  it('the term\'s end: the bishop would keep him or not, and he goes home to a file that remembers, or stays and is written down', () => {
    const { home, away, seeId } = onLoan('end');
    const homeId = home.world!.diocese.presetId;
    const ended = { ...away, clock: { ...away.clock, week: away.loan!.endWeek } };
    expect(fits('ln_end_wanted', ended)).toBe(false);
    let wantedSeen = false; let notSeen = false;
    for (let i = 0; i < 30 && !(wantedSeen && notSeen); i++) {
      const r = loanWeek(ended, createRng(`end:${i}`));
      expect(r.state.loan!.scene).toEqual({ kind: 'end', dueWeek: ended.clock.week });
      if (r.state.loan!.wanted) { wantedSeen = true; expect(fits('ln_end_wanted', r.state)).toBe(true); expect(fits('ln_end_term', r.state)).toBe(false); }
      else { notSeen = true; expect(fits('ln_end_term', r.state)).toBe(true); expect(fits('ln_end_wanted', r.state)).toBe(false); }
      expect(fits('ln_end_any', r.state)).toBe(true);
      expect((eventById('ln_end_wanted')!.priority ?? 0) > (eventById('ln_end_term')!.priority ?? 0)).toBe(true);
    }
    expect(wantedSeen && notSeen).toBe(true);
    // Home: the world swaps back, the borrowed one waits, the file is read, the board has a parish, the scene of the return opens.
    const r = returnHome(ended, createRng('home'));
    const h = r.state;
    expect(h.loan).toBeUndefined();
    expect(h.loanHistory![0]!.decided).toBe('home');
    expect(h.world!.diocese.presetId).toBe(homeId);
    expect(h.territory![seeId]!.diocese.presetId).toBe(away.world!.diocese.presetId);
    expect(h.territory![homeId]).toBeUndefined();
    expect(h.world!.metropolia!.sees.some((x) => x.id === seeId && !!x.bishopId)).toBe(true);
    expect(h.world!.metropolia!.sees.some((x) => x.id === homeId)).toBe(false);
    expect(h.assignment!.role).toBe('pastor');
    expect(h.mode.kind).toBe('assignment');
    expect(h.flags['loan:returned']).toBe(ended.clock.week);
    expect(r.letter.title).toMatch(/^Home from /);
    const carry = homeCarry(ended, away.loan!, home.world!);
    expect(carry.sameBishop).toBe(true);
    expect(h.character!.reputation.chancery).toBe(carry.chancery);
    expect(Math.abs(carry.chancery)).toBeLessThanOrEqual(Math.abs(away.loan!.homeFile.chancery));
    expect(fits('ln_home_again', startAssignment({ ...h, mode: { kind: 'clock' } }, createRng('start')))).toBe(true);
    // The same effect through a scene's choice.
    const viaEffect = applyEffects(ended, [{ target: 'loan', key: 'home' }]);
    expect(viaEffect.world!.diocese.presetId).toBe(homeId);
    expect(viaEffect.letters!.at(-1)!.title).toMatch(/^Home from /);
    // Stayed: incardinated; home writes him down.
    const stayed = incardinate(ended);
    expect(stayed.loan).toBeUndefined();
    expect(stayed.homeDioceseId).toBe(away.world!.diocese.presetId);
    expect(stayed.world!.diocese.presetId).toBe(away.world!.diocese.presetId);
    expect(stayed.flags[`incardinated:${away.world!.diocese.presetId}`]).toBe(ended.clock.week);
    expect(stayed.npcs[home.world!.diocese.hidden.bishop.npcId]!.relationship).toBe(home.npcs[home.world!.diocese.hidden.bishop.npcId]!.relationship - 8);
    expect(fits('ln_stayed', stayed)).toBe(true);
    // Extended: two more years.
    const ext = applyEffects(ended, [{ target: 'loan', key: 'extend' }]);
    expect(ext.loan!.endWeek).toBe(ended.clock.week + LOAN.extendYears * 52);
    expect(ext.loan!.extended).toBe(true);
    // Excardination asked early: home's shortage and regard decide; refused is a scene, granted is the incardination.
    const early = { ...away, clock: { ...away.clock, week: away.clock.week + 100 } };
    expect(excardinationChance(early)).toBeGreaterThan(0);
    let granted = 0; let refused = 0;
    for (let i = 0; i < 30; i++) {
      const e = applyEffects({ ...early, seed: `x${i}` }, [{ target: 'loan', key: 'excardinate' }]);
      if (e.loan) { refused++; expect(e.flags['loan:excardination_refused']).toBe(early.clock.week); expect(fits('ln_excardination_refused', e)).toBe(true); }
      else { granted++; expect(e.homeDioceseId).toBe(away.world!.diocese.presetId); }
    }
    expect(granted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });
});

describe('E2 R1.3: the bishop\'s mirror', () => {
  function bishop(seed: string): GameState {
    const base = parishState(seed);
    const c = base.character!;
    const home: GameState = { ...base, phase: 'pastor', assignment: { ...base.assignment!, role: 'pastor' }, character: { ...c, entryYear: 1990, background: { ...c.background, entryAge: 22 }, stats: { ...c.stats, administration: 60 }, credentials: [...c.credentials, 'JCL'], reputation: { ...c.reputation, chancery: 72, rome: 40 } }, flags: { ...base.flags, ordination_week: base.clock.week - 52 * 22, terna_named: true, aux_named: true, vg_served: true, 'nuncio:named_see': 'gaylord' }, offers: [{ offerId: 'ep_diocesan_bishop', arrivedWeek: 0, expiresWeek: 9999, bindings: {} }] };
    const b = acceptAndGo(home, offerById('ep_diocesan_bishop')!, createRng(seed)).state;
    const week = b.clock.week + 60;
    return nuncioWeek({ ...b, clock: { ...b.clock, week }, see: { ...b.see!, installedWeek: week - 60, shortage: 4 }, flags: { ...b.flags, 'study:see': true } }).state;
  }

  it('asks a brother bishop for a man from the desk, and lends his own when asked', () => {
    const b = bishop('mirror');
    expect(actAvailable(b, seeAct('ask_loan')!).ok).toBe(true);
    expect(actAvailable({ ...b, see: { ...b.see!, shortage: 2 } }, seeAct('ask_loan')!).ok).toBe(false);
    const onDesk = beginAct(b, 'ask_loan');
    const signed = signAct({ ...onDesk, study: { ...onDesk.study!, hoursLogged: { ...onDesk.study!.hoursLogged, see_desk: (onDesk.study!.hoursLogged.see_desk ?? 0) + 3 } } })!;
    expect(signed.state.flags['loan:bishop_asked']).toBe(true);
    let lent = 0; let refused = 0;
    for (let i = 0; i < 30; i++) {
      const r = loanWeekForSee(signed.state, createRng(`lend:${i}`));
      expect(r.state.flags['loan:bishop_asked']).toBeUndefined();
      expect(r.letters).toHaveLength(1);
      if (r.state.see!.borrowed?.length) {
        lent++;
        const loan = r.state.see!.borrowed![0]!;
        const n = r.state.npcs[loan.npcId]!;
        expect(n.tags).toContain('on_loan');
        expect(n.tags).toContain(`diocese:${b.see!.dioceseId}`);
        expect(r.state.see!.shortage).toBe(3);
        expect(loan.untilWeek).toBe(b.clock.week + LOAN.bishop.years * 52);
        expect(fits('ln_bp_borrowed_arrives', r.state)).toBe(true);
        // The term ends: the man goes home and the see is a man shorter again.
        const over = loanWeekForSee({ ...r.state, clock: { ...r.state.clock, week: loan.untilWeek } }, createRng('over'));
        expect(over.state.see!.borrowed).toHaveLength(0);
        expect(over.state.npcs[loan.npcId]!.status).toBe('left');
        expect(over.state.see!.shortage).toBe(4);
      } else {
        refused++;
        expect(r.state.flags['loan:bishop_refused']).toBe(b.clock.week);
        expect(fits('ln_bp_no_priest', r.state)).toBe(true);
      }
    }
    expect(lent).toBeGreaterThan(3);
    expect(refused).toBeGreaterThan(0);
    // Asked for one of his own: the man is lent for the years and the see is a man shorter.
    expect(fits('ln_bp_asked', b)).toBe(true);
    const priest = Object.values(b.npcs).find((n) => n.role === 'priest' && n.status === 'active' && n.tags.includes(`diocese:${b.see!.dioceseId}`))!;
    const asker = metropolitanOf(b)!;
    const l = applyEffects(b, [{ target: 'loan', key: 'lend', value: '@brother_priest', delta: 3 }], { '@brother_priest': priest.id, '@province_bishop': asker.id });
    expect(l.see!.lent).toHaveLength(1);
    expect(l.see!.lent![0]!.npcId).toBe(priest.id);
    expect(l.see!.lent![0]!.see).toBe(b.world!.metropolia!.sees.find((s) => s.bishopId === asker.id)!.see);
    expect(l.see!.shortage).toBe(5);
    expect(l.npcs[priest.id]!.tags).toContain('lent');
  });
});
