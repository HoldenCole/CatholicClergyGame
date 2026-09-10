import { describe, it, expect } from 'vitest';
import { playCareer } from './helpers/career';
import type { CreationAnswers } from '@/types';

/**
 * A balance harness, run with BALANCE=1 npm test. Plays a handful of
 * careers and prints what happened so the numbers can be read against
 * DESIGN 7.3 (promotion goes badly in both directions) and 15.
 */
const builds: Record<string, Partial<CreationAnswers>> = {
  green_philosopher: { path: 'college', field: 'philosophy', motive: 'intellectual' },
  late_accountant: { path: 'college', field: 'business', career: 'accountant', yearsWorked: 12, motive: 'conversion', origin: 'suburban', tie: 'seminary' },
  latino_pastoral: { origin: 'latino_immigrant', tie: 'son', path: 'college', field: 'classics', motive: 'priest' },
  tradesman: { path: 'high_school', field: null, career: 'trades', yearsWorked: 6, motive: 'certainty', origin: 'rural', tie: 'seminary' },
};

describe.skipIf(!process.env.BALANCE)('balance', () => {
  it('plays careers and reports', () => {
    const base: CreationAnswers = { firstName: 'T', lastName: 'R', portrait: 'p1', entryYear: 2010, origin: 'urban_ethnic', tie: 'son', path: 'college', field: 'philosophy', career: null, yearsWorked: 0, motive: 'priest', family: 'supportive', past: null };
    const rows: string[] = [];
    for (const [name, patch] of Object.entries(builds)) {
      for (const diocese of ['chicago', 'houston', 'washington']) {
        const end = playCareer(`bal-${name}-${diocese}`, diocese, 52 * 40, { ...base, ...patch });
        const c = end.character!;
        const promotions = end.career.filter((e) => e.kind === 'promotion');
        const firstPastor = promotions.find((e) => /pastor/.test(e.text));
        const yrs = (w: number) => Math.round((w - Number(end.flags.ordination_week ?? 0)) / 52);
        rows.push(
          [
            name.padEnd(18), diocese.padEnd(11),
            `ended:${end.mode.kind === 'ended' ? end.mode.ending : 'running'}`.padEnd(22),
            `pastor@${firstPastor ? yrs(firstPastor.week) : '-'}`.padEnd(11),
            `passed:${end.career.filter((e) => e.kind === 'passed_over').length}`,
            `succ:${end.career.filter((e) => e.kind === 'succession').length}`,
            `chancery:${c.reputation.chancery.toFixed(0)}`, `people:${c.reputation.parishioners.toFixed(0)}`,
            `admin:${c.stats.administration.toFixed(0)}`, `piety:${c.stats.piety.toFixed(0)}`, `out:${c.outspokenness.toFixed(0)}`,
            `events:${end.history.length}`, `offers:${end.offerHistory.filter((o) => o.decision === 'accepted').length}/${end.offerHistory.length}`,
          ].join(' '),
        );
      }
    }
    console.log('\n' + rows.join('\n'));
    expect(rows.length).toBe(12);
  });
});
