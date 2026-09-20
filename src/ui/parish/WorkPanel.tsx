import { useGameStore } from '@/engine/store';
import { brotherLines, favoursFrom } from '@/systems/brothers';
import Sheet from '../Sheet';

/** The men he was ordained with, whom he has either kept up with or not (DESIGN §9.5). The thing he makes besides the parish (§8.8) is on the You sheet. */
export default function WorkPanel() {
  const game = useGameStore((s) => s.game);
  const ask = useGameStore((s) => s.askBrother);
  const line = useGameStore((s) => s.lastHouseLine);
  if (!game?.character) return null;
  const men = brotherLines(game);

  return (
    <>
      <Sheet title="The men you were ordained with">
        <p className="ink-muted text-xs leading-relaxed">
          A diocesan priest has no community and no rule. What he has is the men who were in the same building at twenty-four, and whichever of them he has bothered to keep up with. The hours in the routine go to whoever he has left longest.
        </p>
        {line && <p className="mt-2 text-sm">{line}</p>}
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {men.map(({ npc, regard, kept }) => {
            const favours = favoursFrom(game, npc);
            const open = favours.filter((f) => f.available);
            return (
              <li key={npc.id}>
                <div>
                  {npc.title || 'Fr.'} {npc.name.first} {npc.name.last}
                  <span className="ink-faint ml-2 text-xs">{regard} · last {kept}</span>
                </div>
                {open.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {open.map((f) => (
                      <button key={f.def.id} className="pbtn px-2 py-0.5 text-xs" title={f.def.blurb} onClick={() => ask(npc.id, f.def.id)}>
                        {f.def.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ink-faint text-xs">{favours[0]?.why ?? 'Nothing to ask of him just now.'}</div>
                )}
              </li>
            );
          })}
          {men.length === 0 && <li className="ink-faint">Nobody yet. The men you are ordained with arrive with ordination.</li>}
        </ul>
        <p className="ink-faint mt-2 text-xs">A favour costs something with the man who does it. That is what makes it a favour.</p>
      </Sheet>
    </>
  );
}
