import { useEffect, useState } from 'react';
import { useGameStore } from '@/engine/store';
import { checkAccess, GITHUB, parseRepo, type GithubConfig } from '@/engine/github';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!iso || Number.isNaN(then)) return 'saved';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * The repository shelf: saves committed to a branch of the game's own
 * repository, so a run crosses from one machine to another. The token is
 * the player's, kept in this browser only.
 */
export default function RepoSavePanel({ mode }: { mode: 'title' | 'sheet' }) {
  const game = useGameStore((s) => s.game);
  const cfg = useGameStore((s) => s.github);
  const setGithub = useGameStore((s) => s.setGithub);
  const saves = useGameStore((s) => s.repoSaves);
  const busy = useGameStore((s) => s.repoBusy);
  const repoError = useGameStore((s) => s.repoError);
  const repoNote = useGameStore((s) => s.repoNote);
  const refresh = useGameStore((s) => s.refreshRepoSaves);
  const push = useGameStore((s) => s.pushToRepo);
  const pull = useGameStore((s) => s.pullFromRepo);
  const remove = useGameStore((s) => s.deleteRepoSave);

  const [open, setOpen] = useState(false);
  const [repoText, setRepoText] = useState(cfg ? `${cfg.owner}/${cfg.repo}` : 'HoldenCole/CatholicClergyGame');
  const [branch, setBranch] = useState(cfg?.branch ?? GITHUB.defaultBranch);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  // Read the shelf once when the repository is linked, so it is there to click.
  useEffect(() => {
    if (cfg) void refresh();
  }, [cfg, refresh]);

  const link = async () => {
    const parsed = parseRepo(repoText);
    if (!parsed || !token.trim()) {
      setChecking('A repository as owner/name, and a token.');
      return;
    }
    const next: GithubConfig = { ...parsed, branch: branch.trim() || GITHUB.defaultBranch, token: token.trim(), autoPush: cfg?.autoPush !== false };
    setChecking('Asking GitHub…');
    try {
      const full = await checkAccess(next);
      setGithub(next);
      setToken('');
      setOpen(false);
      setChecking(`Linked to ${full}.`);
    } catch (err) {
      setChecking(err instanceof Error ? err.message : String(err));
    }
  };

  const setup = (
    <div className="mt-2 flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="heading">Repository</span>
        <input className="pinput font-mono text-sm" value={repoText} onChange={(e) => setRepoText(e.target.value)} placeholder="owner/name" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="heading">Branch</span>
        <input className="pinput font-mono text-sm" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={GITHUB.defaultBranch} />
        <span className="ink-faint text-xs">A branch of its own, so saving never rebuilds the site. It is made for you the first time you save.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="heading">Token</span>
        <input className="pinput font-mono text-sm" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" />
      </label>
      <p className="ink-faint text-xs">
        Make a <a className="underline" href={TOKEN_URL} target="_blank" rel="noreferrer">fine-grained token</a> for this one repository, with <span className="font-mono">Contents</span> set to read and write, and nothing else. It is kept in this browser
        only, on this machine: it is never written into a save, never committed, and goes nowhere but GitHub. Anyone who can read the repository can read the saves on it, which are a fictional priest and nothing more.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="pbtn pbtn-primary" onClick={() => void link()}>Link it</button>
        <button className="pbtn" onClick={() => { setOpen(false); setChecking(null); }}>Not now</button>
        {cfg && <button className="pbtn text-xs" onClick={() => { setGithub(null); setOpen(false); }}>Forget the token on this machine</button>}
      </div>
      {checking && <p className="ink-muted text-xs">{checking}</p>}
    </div>
  );

  if (!cfg) {
    return (
      <div className={mode === 'title' ? '' : 'mt-3 border-t rule pt-3'}>
        <h3 className="heading text-sm">Across machines</h3>
        {open ? setup : (
          <>
            <p className="ink-faint mt-1 text-xs">Saves live in this browser. Link the game&rsquo;s repository and a run will commit to it, so the computer you play on next can pick it up.</p>
            <button className="pbtn mt-2 text-xs" onClick={() => setOpen(true)}>Link a repository</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={mode === 'title' ? '' : 'mt-3 border-t rule pt-3'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="heading text-sm">Across machines</h3>
        <span className="ink-faint text-xs">
          <span className="font-mono">{cfg.owner}/{cfg.repo}</span> · {cfg.branch}{' '}
          <button className="pbtn ml-1 px-2 py-0 text-xs" onClick={() => setOpen((o) => !o)}>Change</button>
        </span>
      </div>
      {open && setup}

      {mode === 'sheet' && game && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="pinput min-w-0 flex-1 text-sm" placeholder="Name it on the repository (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="pbtn pbtn-primary" disabled={busy} onClick={() => void push(name).then(() => setName(''))}>
            {busy ? 'Committing…' : 'Save to the repository'}
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button className="pbtn px-2 text-xs" disabled={busy} onClick={() => void refresh()}>{busy ? 'Reading…' : 'Refresh'}</button>
        {saves.length === 0 && !busy && <span className="ink-faint text-xs">Nothing on the repository yet.</span>}
      </div>

      {saves.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {saves.map((s) => (
            <li key={s.path} className="flex flex-wrap items-center justify-between gap-2 rounded border rule bg-white/30 px-2 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="block">{s.line}</span>
                <span className="ink-faint block text-xs">{s.name} · {ago(s.savedAt)} · {Math.round(s.bytes / 1024)} KB</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button className="pbtn pbtn-primary px-2 text-xs" disabled={busy} onClick={() => void pull(s.path)}>{mode === 'title' ? 'Continue' : 'Load'}</button>
                {confirm === s.path ? (
                  <button className="pbtn px-2 text-xs" disabled={busy} onClick={() => { void remove(s.path); setConfirm(null); }}>Sure?</button>
                ) : (
                  <button className="pbtn px-2 text-xs" onClick={() => setConfirm(s.path)}>Delete</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {mode === 'sheet' && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={cfg.autoPush !== false} onChange={(e) => setGithub({ ...cfg, autoPush: e.target.checked })} />
          <span className="ink-muted">Commit the run when I close the page, so the next machine has it.</span>
        </label>
      )}

      {mode === 'sheet' && (
        <p className="ink-faint mt-2 text-xs">
          Saving commits the run to the <span className="font-mono">{cfg.branch}</span> branch, which the Pages build does not watch, so it never redeploys the site. Two machines writing the same run will not merge: the last one saved is the one that is there.
        </p>
      )}
      {repoNote && <p className="ink-muted mt-2 text-xs">{repoNote}</p>}
      {repoError && <p className="ink-wine mt-2 text-xs">{repoError}</p>}
    </div>
  );
}
