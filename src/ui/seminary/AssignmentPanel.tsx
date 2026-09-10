import { useGameStore } from '@/engine/store';
import { PROBLEM_LABEL } from '@/generation/parishes';
import Panel from '../Panel';

export default function AssignmentPanel() {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptAssignment);
  if (!game || game.mode.kind !== 'assignment' || !game.world) return null;
  const a = game.mode.assignment;
  const parish = game.world.parishes.find((p) => p.id === a.parishId);
  const pastor = parish ? game.npcs[parish.pastorId] : undefined;
  return (
    <Panel title="Letter of assignment">
      <pre className="whitespace-pre-wrap font-serif text-stone-200 leading-relaxed">{a.letter}</pre>
      {parish && (
        <div className="mt-4 text-sm text-stone-400">
          <p>
            {parish.name}, {parish.place}: about {parish.households.toLocaleString()} households, {parish.generational}, {parish.school === 'none' ? 'no school' : `school ${parish.school.replace('_', ' ')}`}.
            {parish.needsSpanish ? ' Spanish is needed.' : ''}
          </p>
          <p className="mt-1">{PROBLEM_LABEL[parish.problem] ?? parish.problem}</p>
          {pastor && (
            <p className="mt-1">
              The pastor, {pastor.title} {pastor.name.last}, is {game.clock.week >= 0 ? new Date((game.clock.startDay + game.clock.week * 7) * 86_400_000).getUTCFullYear() - pastor.birthYear : '?'}.
            </p>
          )}
          <p className="mt-2 text-xs text-stone-500">Why you: {a.reasons.join('; ')}.</p>
        </div>
      )}
      <button className="mt-4 rounded bg-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-600" onClick={accept}>
        Report to the parish
      </button>
    </Panel>
  );
}
