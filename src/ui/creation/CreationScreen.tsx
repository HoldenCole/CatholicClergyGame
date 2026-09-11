import { useMemo, useState } from 'react';
import { creationContent as content } from '@/content/creation';
import { useGameStore } from '@/engine/store';
import { careerAvailability, entryAge, maxYearsWorked, validateAnswers } from '@/systems/creation';
import type { CreationAnswers, CreationOption } from '@/types';
import OptionList from './OptionList';
import DioceseCards from './DioceseCards';
import { revealFieldForTie, revealFor } from '@/generation/world';
import { createRng } from '@/engine/rng';
import Portrait from '../portraits/Portrait';
import { adjustSpec, facesFor, parseSpec, serializeSpec, SPEC_KEYS, SPEC_LABELS } from '../portraits/spec';

type Step = 'name' | 'face' | 'diocese' | 'origin' | 'tie' | 'path' | 'field' | 'career' | 'motive' | 'family' | 'past' | 'summary';
const ORDER: Step[] = ['name', 'face', 'diocese', 'origin', 'tie', 'path', 'field', 'career', 'motive', 'family', 'past', 'summary'];

const QUESTIONS: Record<Step, { title: string; prompt: string }> = {
  name: { title: 'Your name', prompt: 'The vocation director writes it at the top of a file that will follow you for forty years.' },
  face: { title: 'Your face', prompt: 'The photograph clipped to the file. Start from one of these, then change what you like. It will be taken again at ordination, and again when the hair goes.' },
  diocese: { title: 'Choosing a diocese', prompt: 'You visited. You talked to the vocations director. You read what people say. Incardination is for life, and seven years will pass before you are ordained into it.' },
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
  const chooseDiocese = useGameStore((s) => s.chooseDiocese);
  const game = useGameStore((s) => s.game);
  const [dioceseChoice, setDioceseChoice] = useState<string | null>(null);
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
  const [facePage, setFacePage] = useState(0);

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
  const candidates = game?.candidates ?? [];
  const worldChosen = !!game?.world;
  const revealField = revealFieldForTie(full.tie);
  const reveal =
    step === 'tie' && revealField && game?.world
      ? revealFor({ diocese: game.world.diocese, npcs: Object.values(game.npcs) }, revealField, createRng(`${game.seed}:reveal`))
      : null;

  return (
    <div className="felt min-h-screen">
      <header className="plate flex items-baseline justify-between px-6 py-2">
        <h1 className="title text-lg tracking-wide" style={{ color: '#e6c25a' }}>Vocation</h1>
        <span className="text-xs opacity-80">
          Step {idx + 1} of {ORDER.length} · entering seminary in {startYear}
        </span>
      </header>
      <main className="paper paper-tilt-l mx-auto my-6 flex max-w-4xl flex-col gap-5 px-8 py-6">
        <div>
          <h2 className="title text-2xl">{q.title}</h2>
          <p className="ink-muted mt-1">{q.prompt}</p>
        </div>

        {step === 'name' && (
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <Input label="First name" value={answers.firstName} onChange={(v) => setAnswers((a) => ({ ...a, firstName: v }))} />
            <Input label="Surname" value={answers.lastName} onChange={(v) => setAnswers((a) => ({ ...a, lastName: v }))} />
          </div>
        )}
        {step === 'face' && game && (
          <FaceStep seed={game.seed} value={answers.portrait} age={entryAge(full, content)} page={facePage} onPage={() => setFacePage((p) => p + 1)} onChange={(v) => setAnswers((a) => ({ ...a, portrait: v }))} />
        )}
        {step === 'diocese' && (
          <DioceseCards
            dioceses={candidates.map((c) => c.diocese.visible)}
            selected={dioceseChoice ?? (game?.flags.surprise_me ? null : (game?.world?.diocese.presetId ?? null))}
            onSelect={setDioceseChoice}
            onSurprise={() => {
              chooseDiocese('surprise');
              setDioceseChoice(null);
              next();
            }}
          />
        )}
        {step === 'diocese' && game?.flags.surprise_me && (
          <p className="ink-muted text-sm">You asked to be surprised. Choosing a diocese by name now gives up the surprise and its small bonus.</p>
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
          <p className="rounded border rule bg-white/30 p-4 leading-relaxed">{seen[step]}</p>
        )}
        {reveal && (
          <p className="rounded border rule bg-white/30 p-4 text-sm leading-relaxed">
            <span className="heading">What a son of the diocese knows · </span>
            {reveal}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button className="pbtn" onClick={back} disabled={idx === 0}>
            Back
          </button>
          {step !== 'summary' ? (
            <button
              className="pbtn pbtn-primary"
              onClick={() => {
                if (step === 'diocese' && dioceseChoice && (dioceseChoice !== game?.world?.diocese.presetId || game?.flags.surprise_me)) chooseDiocese(dioceseChoice);
                next();
              }}
              disabled={
                (step === 'name' && (!answers.firstName.trim() || !answers.lastName.trim())) ||
                (step === 'face' && !parseSpec(answers.portrait)) ||
                (step === 'diocese' && !worldChosen && !dioceseChoice)
              }
            >
              Continue
            </button>
          ) : (
            <button
              className="pbtn pbtn-primary"
              onClick={() => startGame(full)}
              disabled={errors.length > 0 || !worldChosen}
            >
              Enter the seminary
            </button>
          )}
          {step === 'summary' && errors.length > 0 && <span className="ink-wine text-sm">{errors.join(' ')}</span>}
        </div>
      </main>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="heading">{label}</span>
      <input className="pinput" value={value} onChange={(e) => onChange(e.target.value)} />
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
  const careers = careerAvailability(answers, content);
  const max = maxYearsWorked(answers, content);
  const none: CreationOption = { id: 'none', label: 'Straight in', blurb: 'No career to speak of. The seminary is the first serious thing you have done.', outcome: 'You arrive without a trade, which is fine; the Church has one for you.', effects: [] };
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3">
        {[{ option: none, available: true, why: null }, ...careers].map(({ option: o, available, why }) => (
          <li key={o.id}>
            <button
              disabled={!available}
              onClick={() => onChange(o.id === 'none' ? { career: null, yearsWorked: 0 } : { career: o.id as CreationAnswers['career'], yearsWorked: Math.max(1, answers.yearsWorked) }, o)}
              className={'choice h-full border rule ' + ((answers.career ?? 'none') === o.id ? 'choice-chosen' : '')}
            >
              <div className="font-medium">{o.label}</div>
              <div className="ink-muted mt-1 text-sm leading-snug">{available ? o.blurb : why}</div>
            </button>
          </li>
        ))}
      </ul>
      {answers.career && (
        <label className="flex items-center gap-4 text-sm">
          <span className="ink-muted w-40">Years in that work</span>
          <input type="range" min={1} max={max} value={answers.yearsWorked} onChange={(e) => onChange({ yearsWorked: Number(e.target.value) })} className="w-64" />
          <span className="font-mono">{answers.yearsWorked}</span>
          <span className="ink-faint">entering at {entryAge(answers, content)}, ordained at {entryAge(answers, content) + 7}</span>
        </label>
      )}
    </div>
  );
}

function Summary({ answers, seen }: { answers: CreationAnswers; seen: Partial<Record<Step, string>> }) {
  const age = entryAge(answers, content);
  const paragraphs = (['origin', 'tie', 'path', 'field', 'career', 'motive', 'family', 'past'] as Step[]).map((k) => seen[k]).filter(Boolean);
  return (
    <div className="scroll-paper flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-2 leading-relaxed">
      <p>
        <span className="font-semibold">{answers.firstName} {answers.lastName}</span>, entering at {age}, to be ordained at {age + 7} if all goes well.
      </p>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function FaceStep({ seed, value, age, page, onPage, onChange }: { seed: string; value: string; age: number; page: number; onPage: () => void; onChange: (v: string) => void }) {
  const chosen = parseSpec(value);
  return (
    <div className="flex gap-6">
      <div>
        <div className="heading mb-2">Start from one</div>
        <ul className="grid grid-cols-4 gap-2">
          {facesFor(seed, page).map((spec) => {
            const id = serializeSpec(spec);
            return (
              <li key={id}>
                <button onClick={() => onChange(id)} className={'choice flex flex-col items-center border rule p-1.5 ' + (value === id ? 'choice-chosen' : '')}>
                  <Portrait portrait={{ spec, dress: 'seminarian', age, female: false }} size={64} />
                </button>
              </li>
            );
          })}
        </ul>
        <button className="pbtn-link mt-3" onClick={onPage}>Other faces</button>
      </div>
      <div className="flex-1">
        <div className="heading mb-2">Then change what you like</div>
        {chosen ? (
          <div className="flex gap-5">
            <Portrait portrait={{ spec: chosen, dress: 'seminarian', age, female: false }} size={150} />
            <ul className="flex flex-1 flex-col gap-1 text-sm">
              {SPEC_KEYS.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="ink-muted w-24">{SPEC_LABELS[k].label}</span>
                  <button className="pbtn px-2 py-0 text-xs" aria-label={`${SPEC_LABELS[k].label} back`} onClick={() => onChange(serializeSpec(adjustSpec(chosen, k, -1)))}>◀</button>
                  <span className="w-28 text-center">{SPEC_LABELS[k].values[chosen[k]]}</span>
                  <button className="pbtn px-2 py-0 text-xs" aria-label={`${SPEC_LABELS[k].label} forward`} onClick={() => onChange(serializeSpec(adjustSpec(chosen, k, 1)))}>▶</button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ink-faint text-sm">Pick a face to begin.</p>
        )}
      </div>
    </div>
  );
}
