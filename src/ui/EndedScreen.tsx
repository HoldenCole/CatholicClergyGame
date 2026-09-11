import { useGameStore } from '@/engine/store';
import { careerSummary } from '@/engine/career';
import { lifeOf } from '@/systems/life';
import Portrait from './portraits/Portrait';
import { portraitForCharacter, portraitForNpc, yearOf } from './portraits/spec';

const ENDING_TITLE: Record<string, string> = {
  dismissed: 'Dismissed',
  left_seminary: 'You left',
  left_priesthood: 'You left the priesthood',
  died: 'Requiescat',
  retired: 'Retired',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t rule pt-3">
      <h2 className="ink-faint mb-1.5 text-[11px] uppercase tracking-[0.18em]">{title}</h2>
      {children}
    </section>
  );
}

/** The shelf: a life read back, not a score. DESIGN §15. */
export default function EndedScreen() {
  const game = useGameStore((s) => s.game);
  const newGame = useGameStore((s) => s.newGame);
  const exportSave = useGameStore((s) => s.exportSave);
  if (!game || game.mode.kind !== 'ended') return null;
  const c = game.character;
  const ending = game.mode.ending;
  const priest = !!game.flags.ordained && (ending === 'left_priesthood' || ending === 'retired' || ending === 'died');
  const life = c && priest ? lifeOf(game) : null;
  const summary = c && priest && !/years a priest/.test(game.mode.summary) ? careerSummary(game, ending as 'left_priesthood' | 'retired' | 'died') : null;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const download = () => {
    const blob = new Blob([exportSave()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vocation-${c ? `${c.name.first}-${c.name.last}`.toLowerCase() : 'life'}.json`;
    a.click();
  };

  return (
    <div className="felt min-h-screen p-6">
      <div className="paper paper-tilt-r mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 py-8">
        <div className="flex items-start gap-4">
          {c && <Portrait portrait={portraitForCharacter(c, year, game.flags.ordained_bishop ? 'bishop' : game.phase)} size={72} />}
          <div className="min-w-0 flex-1">
            <h1 className="title text-2xl">{ENDING_TITLE[ending] ?? ending}</h1>
            {c && <p className="ink-muted text-sm">{c.name.first} {c.name.last}{life ? `, ${life.age}, ${life.years} years a priest` : game.seminary ? `, year ${game.seminary.year} of formation` : ''}.</p>}
          </div>
        </div>
        <p className="whitespace-pre-line leading-relaxed">{game.mode.summary}</p>
        {summary && <p className="ink-muted whitespace-pre-line leading-relaxed">{summary.split('\n').slice(0, 4).join(' ')}</p>}

        {life && life.posts.length > 0 && (
          <Section title="The posts">
            <ol className="flex flex-col gap-1 text-sm">
              {life.posts.map((t, i) => (
                <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="ink-faint w-20 shrink-0 text-xs">{t.years}</span>
                  <span className="min-w-0 flex-1">
                    {t.label} of {t.place}{t.verdict ? `, ${t.verdict.toLowerCase()} when you left` : ''}{t.left && t.left !== 'still there' ? `; ${t.left}` : ''}.
                    {t.rows && t.rows.some((r) => r.sign !== 0) && <span className="ink-faint ml-1 text-xs">{t.rows.filter((r) => r.sign !== 0).map((r) => `${r.label.toLowerCase()} ${r.then} to ${r.now}`).join('; ')}.</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {life && life.bishops.length > 0 && (
          <Section title="The bishops">
            <ul className="flex flex-col gap-1.5 text-sm">
              {life.bishops.map((b) => (
                <li key={b.npc.id} className="flex items-start gap-2">
                  <Portrait portrait={portraitForNpc(b.npc, year)} size={24} />
                  <span className="min-w-0 flex-1">{b.npc.title} {b.npc.name.first} {b.npc.name.last}, {b.ordinal}: {b.reading} <span className="ink-faint">In the end, {b.regard}.</span></span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {life && (
          <Section title="The record">
            <p className="text-sm">You were {life.record.standing}. {life.record.bishopLine}</p>
            {life.record.rows.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {life.record.rows.slice(0, 8).map((r, i) => (
                  <li key={i} className="ink-muted">On {r.topic}, {r.side}, {r.volume}.</li>
                ))}
                {life.record.rows.length > 8 && <li className="ink-faint text-xs">and {life.record.rows.length - 8} more.</li>}
              </ul>
            )}
          </Section>
        )}

        {life && (life.friends.length > 0 || life.enemies.length > 0) && (
          <Section title="The people">
            <ul className="flex flex-col gap-1 text-sm">
              {life.friends.map((p) => (
                <li key={p.npc.id} className="flex items-center gap-2">
                  <Portrait portrait={portraitForNpc(p.npc, year, p.npc.role === 'classmate')} size={22} />
                  <span className="flex-1">{p.npc.title ? `${p.npc.title} ` : ''}{p.npc.name.first} {p.npc.name.last}, {p.who}{p.npc.status !== 'active' ? `, ${p.npc.status}` : ''}</span>
                  <span className="ink-muted">{p.regard}</span>
                </li>
              ))}
              {life.enemies.map((p) => (
                <li key={p.npc.id} className="flex items-center gap-2">
                  <Portrait portrait={portraitForNpc(p.npc, year, p.npc.role === 'classmate')} size={22} />
                  <span className="flex-1">{p.npc.title ? `${p.npc.title} ` : ''}{p.npc.name.first} {p.npc.name.last}, {p.who}</span>
                  <span className="ink-wine">{p.regard}</span>
                </li>
              ))}
            </ul>
            {life.founded.length > 0 && <p className="ink-muted mt-1 text-sm">You founded {life.founded.join(', ')}; some of it outlived your leaving.</p>}
          </Section>
        )}

        {life && (life.sacraments.baptized + life.sacraments.married + life.sacraments.buried + life.sacraments.anointed > 0) && (
          <Section title="The parish remembers">
            <p className="text-sm">
              You baptized {life.sacraments.baptized}, married {life.sacraments.married}, buried {life.sacraments.buried}, and anointed {life.sacraments.anointed} of the people whose names you knew.
            </p>
            {life.remembered.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {life.remembered.map((r) => <li key={r.npc.id} className="ink-muted">{r.npc.name.first} {r.npc.name.last}, {r.phrase}.</li>)}
              </ul>
            )}
          </Section>
        )}

        {life && life.classmates.length > 0 && (
          <Section title="The class">
            <ul className="flex flex-col gap-0.5 text-sm">
              {life.classmates.map((l) => (
                <li key={l.npc.id} className={l.npc.status !== 'active' ? 'ink-faint' : ''}>
                  {l.npc.title ? `${l.npc.title} ` : ''}{l.npc.name.first} {l.npc.name.last}, {l.post}; {l.regard}.
                </li>
              ))}
            </ul>
          </Section>
        )}

        {life && life.file.length > 0 && (
          <Section title="The file">
            <ul className="flex flex-col gap-0.5 text-sm">
              {life.file.map((t, i) => <li key={i} className="ink-muted">{t}</li>)}
            </ul>
          </Section>
        )}

        {life && life.letters.length > 0 && (
          <Section title="The drawer">
            <ul className="flex flex-col gap-0.5 text-sm">
              {life.letters.slice(-6).map((l, i) => <li key={i} className="ink-muted"><span className="ink-faint mr-2 text-xs">{l.week}</span>{l.title}. {l.line}</li>)}
            </ul>
          </Section>
        )}

        <div className="flex items-center gap-3 border-t rule pt-4">
          <button className="pbtn" onClick={() => newGame({ seed: `run-${Date.now().toString(36)}` })}>Begin again</button>
          <button className="pbtn-link" onClick={download}>Keep this life</button>
          <span className="ink-faint ml-auto text-xs">{game.history.length} decisions recorded.</span>
        </div>
      </div>
    </div>
  );
}
