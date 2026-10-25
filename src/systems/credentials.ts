import { languageDefs } from './languages';
import { studyProgram } from '@/content/study';

/**
 * What a credential is called when the sheet names it. Content writes ids
 * (`spanish`, `cpe_unit`, `partial_jcl`); the player reads words. A language
 * takes its own label, a degree the word a diocese uses for it, and anything
 * unknown falls back to its id with the underscores read as spaces.
 */
const WORDS: Record<string, string> = {
  STL: 'a licentiate in theology (STL)',
  STD: 'a doctorate in theology (STD)',
  JCL: 'a licentiate in canon law (JCL)',
  JCD: 'a doctorate in canon law (JCD)',
  MBA: 'an MBA',
  MSW: 'an MSW',
  partial_cpa: 'coursework toward a CPA',
  partial_jcl: 'coursework in canon law',
  partial_doctorate: 'coursework toward a doctorate',
  partial_msw: 'coursework toward an MSW',
  cpe_unit: 'a unit of clinical pastoral education',
  translator: "the chancery's translator",
  dominican_rite: 'the Dominican rite',
  italian_basic: 'enough Italian to get by',
  greek: 'Greek',
};

export function credentialLabel(id: string): string {
  const word = WORDS[id];
  if (word) return word;
  const language = languageDefs.find((l) => l.credential === id || l.id === id);
  if (language) return language.label;
  const program = studyProgram(id);
  if (program) return program.label.charAt(0).toLowerCase() + program.label.slice(1);
  return id.replace(/_/g, ' ');
}

/** A list of credentials as a sentence fragment: "Spanish, Latin, and a unit of clinical pastoral education". */
export function credentialList(ids: readonly string[]): string {
  const words = ids.map(credentialLabel);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}
