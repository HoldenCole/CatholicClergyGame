import { useGameStore } from '@/engine/store';
import { PILLARS, type EvaluationResult, type Pillar } from '@/types';
import { FORMATION } from '@/systems/formation';
import Panel from '../Panel';

const RESULT_TEXT: Record<EvaluationResult, { title: string; body: string }> = {
  ADVANCED: { title: 'Advanced', body: 'The rector reads the report aloud, which he does only when it is good. You are recommended without reservation.' },
  ADVANCED_WITH_CONCERNS: { title: 'Advanced, with concerns', body: 'You are recommended to continue. The concerns go into the file, and the file goes to the bishop.' },
  HELD_BACK: { title: 'Held back', body: 'You will repeat the year. The rector is careful to say it is not a punishment. It will feel like one.' },
  DISMISSED: { title: 'Dismissed', body: 'The seminary will not recommend you for continued formation. The vocation director will call.' },
};

const PILLAR_LABEL: Record<Pillar, string> = { human: 'Human', spiritual: 'Spiritual', intellectual: 'Intellectual', pastoral: 'Pastoral' };

export function pillarWord(score: number): string {
  if (score <= 0) return 'neglected';
  if (score < FORMATION.failingPillar) return 'failing';
  if (score < FORMATION.weakPillar) return 'thin';
  if (score < 9) return 'steady';
  if (score < 13) return 'strong';
  return 'exceptional';
}

export default function EvaluationPanel() {
  const game = useGameStore((s) => s.game);
  const ack = useGameStore((s) => s.acknowledgeEvaluation);
  if (!game || game.mode.kind !== 'evaluation') return null;
  const rec = game.mode.record;
  const text = RESULT_TEXT[rec.result];
  return (
    <Panel title={`Annual evaluation · year ${rec.year}`}>
      <h2 className="text-xl">{text.title}</h2>
      <p className="mt-2 text-stone-300 leading-relaxed">{text.body}</p>
      <dl className="mt-4 grid grid-cols-4 gap-3">
        {PILLARS.map((p) => (
          <div key={p}>
            <dt className="text-xs uppercase tracking-wider text-stone-500">{PILLAR_LABEL[p]}</dt>
            <dd className="text-lg">{pillarWord(rec.pillars[p])}</dd>
          </div>
        ))}
      </dl>
      {rec.notes.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-sm text-stone-400">
          {rec.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      <button className="mt-4 rounded bg-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-600" onClick={ack}>
        {rec.result === 'DISMISSED' ? 'Pack' : rec.year >= 7 && rec.result.startsWith('ADVANCED') ? 'To ordination' : 'Continue'}
      </button>
    </Panel>
  );
}
