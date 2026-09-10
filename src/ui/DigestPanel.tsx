import { useGameStore } from '@/engine/store';
import Panel from './Panel';

const SHOWN = 12;

export default function DigestPanel() {
  const digest = useGameStore((s) => s.game?.digest);
  if (!digest) return null;
  const recent = digest.slice(-SHOWN).reverse();

  return (
    <Panel title="Digest">
      {recent.length === 0 ? (
        <p className="text-sm text-stone-500">No weeks have passed yet.</p>
      ) : (
        <ol className="flex flex-col gap-1 font-mono text-sm">
          {recent.map((w) => (
            <li key={w.week} className="flex gap-3">
              <span className="w-10 shrink-0 text-right text-stone-600">{w.week}</span>
              <span className="text-stone-300">{w.lines.join(' ')}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
