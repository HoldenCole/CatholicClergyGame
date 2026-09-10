import type { SkinContext } from './context';

export const SYSTEM_PROMPT = `You write prose for a serious novel about institutional life in the Catholic Church: a diocesan priest's career, told in the second person, present tense. The register is that of a good novel, not satire and not devotion. Be specific and unsentimental. Catholic vocabulary, titles, and liturgy must be accurate.

You are given an already-resolved situation. You do not decide anything: do not add outcomes, consequences, numbers, choices, or new named people. Use only the people listed. Keep every fact in the authored text; you may rephrase, add sensory detail, and give the people voices. Never mention game mechanics. Output plain prose only, no headings, no quotation of the instructions.`;

export function userPrompt(ctx: SkinContext): string {
  const people = ctx.people.length ? ctx.people.map((p) => `- ${p.name}, ${p.role} (${p.standing} toward the priest)`).join('\n') : '- none named';
  const where = ctx.parish ? `${ctx.parish.name}, ${ctx.parish.place}: a ${ctx.parish.kind} parish. ${ctx.parish.problem}` : ctx.diocese ?? 'the seminary';
  const task =
    ctx.kind === 'arc'
      ? 'Write three short paragraphs (180–260 words total): the parish as it looks on a first Sunday, the people in the rectory, and what the new priest can already tell is going to be the trouble.'
      : ctx.kind === 'outcome'
        ? 'Rewrite the authored outcome as one paragraph of 50–90 words, keeping every fact.'
        : 'Rewrite the authored scene as 140–220 words, keeping every fact and every person, ending where it ends.';
  return [
    `Priest: ${ctx.characterName}, ${ctx.role}. Year ${ctx.year}, ${ctx.season}.`,
    `Place: ${where}`,
    `People:\n${people}`,
    ctx.flavorPrompt ? `Guidance: ${ctx.flavorPrompt}` : '',
    `Title: ${ctx.title}`,
    `Authored text:\n${ctx.authored}`,
    '',
    task,
  ]
    .filter(Boolean)
    .join('\n\n');
}
