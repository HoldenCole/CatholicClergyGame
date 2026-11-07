import { useGameStore } from '@/engine/store';
import { renderText } from '@/engine/text';
import { interviewAnswers, interviewer, interviewQuestions } from '@/systems/interview';
import { interviewContent } from '@/content/seminary';
import Panel from '../Panel';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';

/**
 * The vocations director's interview before the first year. DESIGN §6.1a.
 * One question at a time; what the last answer did sits above the next.
 */
export default function InterviewPanel() {
  const game = useGameStore((s) => s.game);
  const answer = useGameStore((s) => s.answerInterview);
  if (!game || game.mode.kind !== 'interview') return null;
  const questions = interviewQuestions(game);
  const q = questions[game.mode.index];
  const npc = interviewer(game);
  const b = npc ? { '@vocation_director': npc.id } : {};
  const year = yearOf(game.clock.startDay, game.clock.week);
  if (!q) return null;
  return (
    <Panel title="The vocations director" tilt="l">
      <div className="flex items-start gap-3">
        {npc && <Portrait portrait={portraitForNpc(npc, year)} size={48} />}
        <div className="min-w-0 flex-1">
          {game.mode.index === 0 && <p className="ink-muted text-sm leading-relaxed">{renderText(interviewContent.intro, game, b)}</p>}
          {game.mode.said && <p className="ink-muted text-sm leading-relaxed">{game.mode.said}</p>}
          <p className="mt-3 text-sm leading-relaxed">{renderText(q.prompt, game, b)}</p>
          <p className="ink-faint mt-1 text-xs">Question {game.mode.index + 1} of {questions.length}. He is writing.</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {interviewAnswers(game, q).map(({ answer: a, available }) => (
          <li key={a.id}>
            <button disabled={!available} onClick={() => answer(a.id)} className="choice w-full border rule text-left">
              <div className="text-sm leading-snug">{renderText(a.label, game, b)}</div>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
