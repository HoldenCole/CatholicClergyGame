import type { GameState } from '@/types';

/** What counts as news of a person: the words the lines use when someone dies, leaves, is moved, or is named. */
const NEWS = /\b(died|has died|is dead|left the priesthood|has left|left the order|was moved|has been moved|has been made|has been named|named a bishop|is dean now|retired|has retired|is ill|drinking|thinking of leaving|sent away|on leave)\b/i;

/**
 * The clock stops for people (Q9): when a line this week names someone who
 * matters to the man (family, a classmate, a bishop, anyone he holds past
 * ±40) and says something happened to them. Off by the settings.
 */
export function peopleStop(state: GameState): string | null {
  if (state.settings?.stopForPeople === false) return null;
  const week = state.digest[state.digest.length - 1];
  if (!week || week.week !== state.clock.week) return null;
  const news = week.lines.filter((l) => NEWS.test(l));
  if (!news.length) return null;
  const names = Object.values(state.npcs)
    .filter((n) => n.id !== 'player' && (n.tags.includes('province_bishop') ? Math.abs(n.relationship) >= 40 : n.role === 'family' || n.role === 'classmate' || n.role === 'bishop' || n.tags.includes('bishop_emeritus') || Math.abs(n.relationship) >= 40))
    .map((n) => n.name.last)
    .filter((s) => s.length >= 3);
  if (!names.length) return null;
  const set = new Set(names);
  // News of the man himself is not news of his people: "Fr. Kowalski has been named" is his own line.
  const own = state.character ? new RegExp(`\\b(Fr|Msgr|Bishop|Archbishop|Cardinal)\\. ${state.character.name.last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) : null;
  for (const line of news) {
    if (own && own.test(line)) continue;
    for (const word of line.replace(/[.,;:'"]/g, ' ').split(/\s+/)) if (set.has(word)) return line;
  }
  return null;
}
