import { useMemo, useState } from 'react';
import { creationContent as content } from '@/content/creation';
import { useGameStore } from '@/engine/store';
import { availableCareers, entryAge, maxYearsWorked, validateAnswers } from '@/systems/creation';
import type { CreationAnswers, CreationOption } from '@/types';
import OptionList from './OptionList';

type Step = 'name' | 'origin' | 'tie' | 'path' | 'field' | 'career' | 'motive' | 'family' | 'past' | 'summary';
const ORDER: Step[] = ['name', 'origin', 'tie', 'path', 'field', 'career', 'motive', 'family', 'past', 'summary'];

const QUESTIONS: Record<Step, { title: string; prompt: string }> = {
  name: { title: 'Your name', prompt: 'The vocation director writes it at the top of a file that will follow you for forty years.' },
  origin: { title: 'Where you are from', prompt: 'Not where you live now. Where you learned what a parish was.' },
  tie: { title: 'Your tie to the diocese', prompt: 'How much of a native you are. It matters for the whole career.' },
  path: { title: 'Your road to seminary', prompt: 'Seminary is seven years whatever you did before it. What you did before it is the question.' },
  field: { title: 'What you studied', prompt: 'The field shapes how you read, and what the Church will think you are for.' },
  career: { title: 'What you did for a living', prompt: 'Optional. Years of work before entering, if any. Every year is a year older at ordination.' },
  motive: { title: 'Why you went', prompt: 'The answer you gave the vocation director was true. This is the truer one.' },
  family: { title: 'Family and obligations', prompt: 'Who you leave, and who will not entirely let you.' },
  past: { title: 'Something in your past', prompt: 'Optional. Taking one makes you more than you would otherwise be, and gives the future something to find.' },
  summary: { title: 'The file', prompt: 'What the vocation director has written about you.' },
};

export default function CreationScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const game = useGameStore((s) => s.game);
  const [step, setStep] = useState<Step>('name');
  const [answers, setAnswers] = useState<CreationAnswers>({
    firstName: '',
    lastName: '',
    portrait: 'p1',
    entryYear: 2010,
    origin: 'urban_ethnic',
    tie: 'son',
    path: 'college',
    field: 'philosophy',
    career: null,
    yearsWorked: 0,
    motive: 'certainty',
    family: 'supportive',
    past: null,
  });
  const [seen, setSeen] = useState<Partial<Record<Step, string>>>({});

  const startYear = useMemo(() => {
    if (!game) return 2010;
    return new Date(game.clock.startDay * 86_400_000).getUTCFullYear();
  }, [game]);
  const full = { ...answers, entryYear: startYear };

  const idx = ORDER.indexOf(step);
  const pathOpt = content.paths.find((p) => p.id === full.path);
  const next = () => {
    let i = idx + 1;
    while (ORDER[i] === 'field' && !pathOpt?.hasField) i++;
    setStep(ORDER[i] ?? 'summary');
  };
  const back = () => {
    let i = idx - 1;
    while (ORDER[i] === 'field' && !pathOpt?.hasField) i--;
    setStep(ORDER[Math.max(0, i)] ?? 'name');
  };
  const choose = <T extends CreationOption>(key: Step, option: T, patch: Partial<CreationAnswers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setSeen((s) => ({ ...s, [key]: option.outcome }));
  };

  const q = QUESTIONS[step];
  const errors = validateAnswers(full, content);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-wide">Vocation</h1>
        <span className="text-xs text-stone-500">
          Step {idx + 1} of {ORDER.length} · entering seminary in {startYear}
        </span>
      </header>
      <main className="mx-auto max-w-4xl p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-2xl">{q.title}</h2>
          <p className="mt-1 text-stone-400">{q.prompt}</p>
        </div>

        {step === 'name' && (
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <Input label="First name" value={answers.firstName} onChange={(v) => setAnswers((a) => ({ ...a, firstName: v }))} />
            <Input label="Surname" value={answers.lastName} onChange={(v) => setAnswers((a) => ({ ...a, lastName: v }))} />
          </div>
        )}
        {step === 'origin' && (
          <OptionList options={content.origins} selected={full.origin} onSelect={(o) => choose('origin', o, { origin: o.id })} />
        )}
        {step === 'tie' && (
          <OptionList options={content.ties} selected={full.tie} onSelect={(o) => choose('tie', o, { tie: o.id })} />
        )}
        {step === 'path' && (
          <OptionList
            options={content.paths}
            selected={full.path}
            onSelect={(o) => choose('path', o, { path: o.id, field: o.hasField ? (full.field ?? 'philosophy') : null, career: null, yearsWorked: 0 })}
          />
        )}
        {step === 'field' && (
          <OptionList options={content.fields} selected={full.field} onSelect={(o) => choose('field', o, { field: o.id, career: null, yearsWorked: 0 })} />
        )}
        {step === 'career' && (
          <CareerStep answers={full} onChange={(patch, o) => (o ? choose('career', o, patch) : setAnswers((a) => ({ ...a, ...patch })))} />
        )}
        {step === 'motive' && (
          <OptionList options={content.motives} selected={full.motive} onSelect={(o) => choose('motive', o, { motive: o.id })} />
        )}
        {step === 'family' && (
          <OptionList options={content.families} selected={full.family} onSelect={(o) => choose('family', o, { family: o.id })} />
        )}
        {step === 'past' && (
          <OptionList
            options={[{ id: 'none', label: 'Nothing worth mentioning', blurb: 'A quiet past, or one you have decided is nobody’s business. Safe, and slightly weaker.', outcome: 'The file is thin, which the diocese prefers.', effects: [] }, ...content.pasts]}
            selected={full.past ?? 'none'}
            onSelect={(o) => choose('past', o, { past: o.id === 'none' ? null : (o.id as CreationAnswers['past']) })}
          />
        )}
        {step === 'summary' && <Summary answers={full} seen={seen} />}

        {step !== 'summary' && seen[step] && (
          <p className="rounded border border-amber-900/50 bg-amber-950/30 p-4 text-stone-200 leading-relaxed">{seen[step]}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 disabled:opacity-40" onClick={back} disabled={idx === 0}>
            Back
          </button>
          {step !== 'summary' ? (
            <button
              className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-amber-600 disabled:opacity-40"
              onClick={next}
              disabled={step === 'name' && (!answers.firstName.trim() || !answers.lastName.trim())}
            >
              Continue
            </button>
          ) : (
            <button
              className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-amber-600 disabled:opacity-40"
              onClick={() => startGame(full)}
              disabled={errors.length > 0}
            >
              Enter the seminary
            </button>
          )}
          {step === 'summary' && errors.length > 0 && <span className="text-sm text-red-400">{errors.join(' ')}</span>}
        </div>
      </main>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-stone-400">{label}</span>
      <input className="rounded border border-stone-700 bg-stone-950 px-3 py-2 text-stone-100" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CareerStep({
  answers,
  onChange,
}: {
  answers: CreationAnswers;
  onChange: (patch: Partial<CreationAnswers>, option?: CreationOption) => void;
}) {
  const careers = availableCareers(answers, content);
  const max = maxYearsWorked(answers, content);
  return (
    <div className="flex flex-col gap-4">
      <OptionList
        options={[{ id: 'none', label: 'Straight in', blurb: 'No career to speak of. The seminary is the first serious thing you have done.', outcome: 'You arrive without a trade, which is fine; the Church has one for you.', effects: [] }, ...careers]}
        selected={answers.career ?? 'none'}
        onSelect={(o) => onChange(o.id === 'none' ? { career: null, yearsWorked: 0 } : { career: o.id as CreationAnswers['career'], yearsWorked: Math.max(1, answers.yearsWorked) }, o)}
      />
      {answers.career && (
        <label className="flex items-center gap-4 text-sm">
          <span className="text-stone-400 w-40">Years in that work</span>
          <input type="range" min={1} max={max} value={answers.yearsWorked} onChange={(e) => onChange({ yearsWorked: Number(e.target.value) })} className="w-64" />
          <span className="font-mono">{answers.yearsWorked}</span>
          <span className="text-stone-500">entering at {entryAge(answers, content)}, ordained at {entryAge(answers, content) + 7}</span>
        </label>
      )}
    </div>
  );
}

function Summary({ answers, seen }: { answers: CreationAnswers; seen: Partial<Record<Step, string>> }) {
  const age = entryAge(answers, content);
  const paragraphs = (['origin', 'tie', 'path', 'field', 'career', 'motive', 'family', 'past'] as Step[]).map((k) => seen[k]).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 text-stone-200 leading-relaxed max-h-[480px] overflow-y-auto pr-2">
      <p>
        <span className="font-semibold">{answers.firstName} {answers.lastName}</span>, entering at {age}, to be ordained at {age + 7} if all goes well.
      </p>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
