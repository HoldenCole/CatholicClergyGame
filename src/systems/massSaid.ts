import type { GameState } from '@/types';
import { policyOf } from './rome/policy';
import { olderMassLaw } from './decor';
import { currentDecor } from './decorState';
import { languageLabel, myMasses, scheduleOf } from './schedule';
import { currentParish, selectedOf } from './liturgy';

/**
 * The Mass the man says, said plainly: the reformed Missal (the Mass of
 * Paul VI) is the Mass of the Roman Rite wherever he is; the 1962 Missal is
 * the older form, said under whatever law Rome has set on it (the
 * `older_mass` axis) and whatever leave the bishop gives; a friar's order may
 * keep a rite of its own. This reads the state and writes two sentences for
 * the week sheet. It decides nothing: the law is Rome's (`rome/policy`), the
 * leave is `decor.facultyGate`'s, and the hours are the routine's.
 */
export type MassForm = 'ordinary' | 'older' | 'order_rite';

/** Where the man stands with the older form, for content and tests to read. */
export type OlderMassStanding =
  | 'not_yet' // not ordained
  | 'free' // the law asks nothing but the Latin, and he has it
  | 'no_latin' // the law asks nothing but the Latin, and he lacks it
  | 'faculties' // he holds the bishop's faculties
  | 'begun' // he was saying it before the law changed, and what stood stands
  | 'by_leave' // he would need the bishop's leave and does not have it
  | 'closed'; // the law shuts it

export interface MassSaid {
  /** What he mainly says, or would say: the reformed Missal unless the week says otherwise. */
  form: MassForm;
  /** Whether he says Mass at all yet. */
  celebrant: boolean;
  /** "The Mass of Paul VI, in English, with the ordinary in Latin; and the Spanish Mass on Sunday." */
  line: string;
  /** The older form: the law as it stands and where he stands under it. */
  older: string;
  standing: OlderMassStanding;
}

/** The law as it stands on the 1962 Missal, in a sentence that names the document. */
export function olderMassNorm(state: GameState): string {
  const law = policyOf(state, 'older_mass');
  const by = olderMassLaw(state);
  switch (law) {
    case 'free':
      return `Under ${by} any priest who can say the 1962 Missal may say it, and a pastor may give a stable group its Sunday Mass; the only thing asked is the Latin.`;
    case 'indult':
      return `Under ${by} the 1962 Missal is said only by the bishop's indult, for the groups who ask him for it.`;
    case 'faculties':
      return `Under ${by} a priest needs the bishop's faculties, granted man by man, and no new group may be begun in a parish church.`;
    default:
      return `Under ${by} the 1962 Missal is not said in the parishes; the reformed Missal is the Mass of the Roman Rite.`;
  }
}

function olderStanding(state: GameState): OlderMassStanding {
  if (!state.flags.ordained) return 'not_yet';
  const law = policyOf(state, 'older_mass');
  if (law === 'closed') return 'closed';
  // While Rome leaves it free there are no faculties to hold: a man who has them, or the Latin, simply may.
  if (law === 'free') return state.character?.credentials.includes('latin') || state.flags.can_celebrate_tlm ? 'free' : 'no_latin';
  if (state.flags.can_celebrate_tlm) return 'faculties';
  if (state.flags['older_mass:said']) return 'begun';
  return 'by_leave';
}

/** The language of the English Mass as the parish's dial has it. */
function latinOf(state: GameState): string {
  const parish = currentParish(state);
  const dial = parish?.liturgy ? selectedOf(parish, 'language')[0] : undefined;
  if (dial === 'some_latin') return ', with the Kyrie, Sanctus, and Agnus Dei in Latin';
  if (dial === 'latin_ordinary') return ', with the ordinary in Latin and the readings in English';
  return '';
}

/** The languages of the Masses he says, from the schedule: "in English, and in Spanish on Sunday". */
function languagesOf(state: GameState): string {
  const s = scheduleOf(state);
  if (!s) return 'in English';
  const mine = myMasses(s);
  const langs = [...new Set(mine.map((m) => m.language))];
  if (!langs.length) return 'in English';
  const [first, ...rest] = langs;
  const head = `in ${languageLabel(first!)}`;
  if (!rest.length) return head;
  const others = rest.map((l) => {
    const sunday = mine.some((m) => m.language === l && m.sunday);
    return `${languageLabel(l)}${sunday ? ' on Sunday' : ''}`;
  });
  return `${head}, and in ${others.join(' and ')}`;
}

const REFORMED = 'the Mass of Paul VI';

export function massSaid(state: GameState): MassSaid {
  const standing = olderStanding(state);
  const norm = olderMassNorm(state);
  const latin = !!state.character?.credentials.includes('latin');
  const ordained = !!state.flags.ordained;
  const parishHours = state.parish?.routine.discretionary['older_mass'] ?? 0;

  // Where he stands under the law, in his own case.
  let mine: string;
  switch (standing) {
    case 'not_yet':
      mine = latin ? 'You have the Latin for it.' : 'You would need the Latin for it, which the seminary does not give unless you ask.';
      break;
    case 'free':
      mine = parishHours > 0 ? `You say it: ${parishHours} ${parishHours === 1 ? 'block' : 'blocks'} a week on the routine.` : 'Nothing stands between you and it: give it hours on the routine and it is yours to say.';
      break;
    case 'no_latin':
      mine = 'Only the Latin stands between you and it.';
      break;
    case 'faculties':
      mine = parishHours > 0 ? `You hold faculties for it and say it: ${parishHours} ${parishHours === 1 ? 'block' : 'blocks'} a week.` : state.parish ? 'You hold faculties for it: give it hours on the routine and it is yours on a weekday evening; the pastor decides whether it goes on a Sunday.' : 'You hold faculties for it, and may say it privately, at a side altar, wherever you are.';
      break;
    case 'begun':
      mine = `You were saying it before ${olderMassLaw(state)}, and what stood then stands.`;
      break;
    case 'by_leave':
      mine = state.religious ? "You hold no leave for it; for a religious the provincial's word comes before the bishop's." : state.parish ? 'You hold none; the Mass sheet has the letter to the chancery.' : 'You hold none, and there is no parish here to ask from; the bishop grants them to a priest with a parish.';
      break;
    default:
      mine = 'It is not yours to say.';
  }
  const older = `${norm} ${mine}`;

  // What he says, by where he is.
  if (!ordained) {
    const religious = !!state.religious;
    const year = state.seminary?.year ?? 1;
    const deacon = !religious && year >= 7;
    const line = religious
      ? `You do not yet say Mass. The conventual Mass of the house is ${REFORMED}, in the order's own manner, and a novice sits in choir for it.`
      : `You do not yet say Mass. The community Mass is ${REFORMED}, in English with the ordinary sometimes in Latin, and ${deacon ? 'a deacon assists at it, reads the Gospel, and preaches when the rector allows' : 'a seminarian serves it'}.`;
    return { form: 'ordinary', celebrant: false, line, older, standing };
  }
  if (state.see) {
    return { form: 'ordinary', celebrant: true, line: `${cap(REFORMED)} at the cathedral, with the whole diocese looking on; the older form in the diocese is yours to allow or not, within the law.`, older, standing };
  }
  if (state.religious) {
    const rite = state.religious.spends?.['order_rite'] ?? 0;
    const hasRite = !!state.character?.credentials.includes('dominican_rite');
    const line = rite > 0
      ? `The conventual Mass of the house, ${REFORMED}; and the rite of the order at a side altar, by leave, ${rite} ${rite === 1 ? 'block' : 'blocks'} a week.`
      : hasRite
        ? `The conventual Mass of the house, ${REFORMED}. You have the order's own rite, and the hours sheet can put it on the week.`
        : `The conventual Mass of the house, ${REFORMED}, as the house keeps it.`;
    return { form: rite > 0 ? 'order_rite' : 'ordinary', celebrant: true, line, older, standing };
  }
  if (state.study) {
    const city = state.study.city;
    const where = city === 'rome' ? "at the college's altar, in Italian or in Latin as the house has it" : city === 'washington' ? "at the college chapel, in English" : 'where the work takes you';
    return { form: 'ordinary', celebrant: true, line: `${cap(REFORMED)}, ${where}.`, older, standing };
  }
  if (state.parish) {
    const church = currentDecor(state, 'church');
    const keepsOlder = church.mass_form === 'mass_tlm';
    const saysOlder = parishHours > 0;
    let line = `${cap(REFORMED)}, ${languagesOf(state)}${latinOf(state)}, as the schedule has it.`;
    if (keepsOlder && saysOlder) line += ' The parish keeps the older form on Sunday as well, and you say it in the week.';
    else if (keepsOlder) line += " The parish keeps the older form on Sunday as well; it is the pastor's altar, not yours.";
    else if (saysOlder) line += ' You say the older form besides, on a weekday evening, for the people who drive in for it.';
    return { form: saysOlder && !keepsOlder ? 'older' : 'ordinary', celebrant: true, line, older, standing };
  }
  return { form: 'ordinary', celebrant: true, line: `${cap(REFORMED)}, wherever you are asked to say it.`, older, standing };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
