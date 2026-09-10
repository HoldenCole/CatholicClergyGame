import { useGameStore } from '@/engine/store';
import { PROBLEM_LABEL } from '@/generation/parishes';
import Panel from '../Panel';

export default function AssignmentPanel() {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptAssignment);
  if (!game || game.mode.kind !== 'assignment' || !game.world) return null;
  const a = game.mode.assignment;
  const passedOver = [...game.career].reverse().find((e) => e.kind === 'passed_over' && e.week === game.clock.week);
  const parish = game.world.parishes.find((p) => p.id === a.parishId);
  const pastor = parish ? game.npcs[parish.pastorId] : undefined;
  return (
    <Panel title={a.role === 'pastor' ? 'Letter of appointment' : 'Letter of assignment'} tilt="r">
      <pre className="whitespace-pre-wrap font-[inherit] leading-relaxed">{a.letter}</pre>
      {parish && (
        <div className="ink-muted mt-4 text-sm">
          <p>
            {parish.name}, {parish.place}: about {parish.households.toLocaleString()} households, {parish.generational}, {parish.school === 'none' ? 'no school' : `school ${parish.school.replace('_', ' ')}`}.
            {parish.needsSpanish ? ' Spanish is needed.' : ''}
          </p>
          <p className="mt-1">{PROBLEM_LABEL[parish.problem] ?? parish.problem}</p>
          {pastor && (
            <p className="mt-1">
              The pastor, {pastor.title} {pastor.name.last}, is {new Date((game.clock.startDay + game.clock.week * 7) * 86_400_000).getUTCFullYear() - pastor.birthYear}.
            </p>
          )}
          <p className="ink-faint mt-2 text-xs">{a.role === 'pastor' ? 'Why you' : passedOver ? 'What the board decided' : 'Why you'}: {a.reasons.join('; ')}.</p>
          {passedOver && <p className="ink-wine mt-1 text-xs">{passedOver.text}</p>}
        </div>
      )}
      <button className="pbtn pbtn-primary mt-4" onClick={accept}>Report to the parish</button>
    </Panel>
  );
}
