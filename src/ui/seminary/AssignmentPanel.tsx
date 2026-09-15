import { useGameStore } from '@/engine/store';
import { PROBLEM_LABEL } from '@/generation/parishes';
import { isMoveTo, officesHeld } from '@/systems/offices';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

export default function AssignmentPanel() {
  const game = useGameStore((s) => s.game);
  const accept = useGameStore((s) => s.acceptAssignment);
  if (!game || game.mode.kind !== 'assignment' || !game.world) return null;
  const a = game.mode.assignment;
  const passedOver = [...game.career].reverse().find((e) => e.kind === 'passed_over' && e.week === game.clock.week);
  const parish = game.world.parishes.find((p) => p.id === a.parishId);
  const pastor = parish ? game.npcs[parish.pastorId] : undefined;
  const moving = isMoveTo(game, a.parishId);
  const held = officesHeld(game);
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
          {pastor && a.role !== 'pastor' && (
            <p className="mt-1 flex items-center gap-2">
              <Portrait portrait={portraitForNpc(pastor, yearOf(game.clock.startDay, game.clock.week))} size={30} />
              <span>The pastor, {pastor.title} {pastor.name.last}, is {yearOf(game.clock.startDay, game.clock.week) - pastor.birthYear}.</span>
            </p>
          )}
          <p className="ink-faint mt-2 text-xs">{a.role === 'pastor' ? 'Why you' : passedOver ? 'What the board decided' : 'Why you'}: {a.reasons.join('; ')}.</p>
          {passedOver && <p className="ink-wine mt-1 text-xs">{passedOver.text}</p>}
        </div>
      )}
      {moving && held.length > 0 ? (
        <div className="mt-4">
          <p className="ink-muted text-sm">You hold {held.map((h) => h.toLowerCase()).join(' and ')}. A move within the diocese does not take it from you; the chancery asks whether you will carry it to the new parish or hand it on to a man who stays put.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="pbtn pbtn-primary" onClick={() => accept(true)}>Report to the parish, and keep the office</button>
            <button className="pbtn" onClick={() => accept(false)}>Report, and hand the office on</button>
          </div>
        </div>
      ) : (
        <button className="pbtn pbtn-primary mt-4" onClick={() => accept(true)}>Report to the parish</button>
      )}
    </Panel>
  );
}
