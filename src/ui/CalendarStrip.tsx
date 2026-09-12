import { useGameStore } from '@/engine/store';
import { seasonOf } from '@/engine/time';
import { SEASON_LABELS } from '@/engine/calendar';
import { upcomingFeasts } from '@/engine/feasts';

const SEASON_COLOR: Record<string, string> = { advent: '#6b4fa0', christmas: '#e6dcc4', ordinary: '#3f7a3f', lent: '#6b4fa0', holy_week: '#8a1f1f', easter: '#e6dcc4' };

/** The liturgical year on screen: the season, and the feasts ahead of the parish. */
export default function CalendarStrip() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const parish = game.world?.parishes.find((p) => p.id === game.assignment?.parishId);
  const season = seasonOf(game.clock);
  const ahead = upcomingFeasts(game.clock, parish, 5);
  return (
    <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 pt-2 text-xs text-[#cbbfa4]">
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/30" style={{ background: SEASON_COLOR[season] ?? '#3f7a3f' }} title="The liturgical color of the week" />
      <span className="shrink-0">{SEASON_LABELS[season]}</span>
      <span className="opacity-40">·</span>
      <span className="truncate">
        {ahead.length === 0
          ? 'Nothing on the calendar for a while.'
          : ahead.map((f, i) => (
              <span key={f.key} className={f.weeks === 0 ? 'text-[#e6c25a]' : ''}>
                {i > 0 ? ' · ' : ''}
                {f.label}
                {f.weeks === 0 ? ' this week' : f.weeks === 1 ? ' next week' : ` in ${f.weeks} weeks`}
              </span>
            ))}
      </span>
    </div>
  );
}
