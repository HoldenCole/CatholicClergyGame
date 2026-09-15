import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkAccess,
  deleteRemote,
  ensureBranch,
  fromBase64,
  GITHUB,
  GithubError,
  listRemote,
  parseRepo,
  readRemote,
  saveFileName,
  toBase64,
  writeRemote,
  type GithubConfig,
} from '@/engine/github';
import { resetAutosaveClock, setWeekDraw, useGameStore } from '@/engine/store';
import { noDraw } from '@/engine/clock';

const cfg: GithubConfig = { token: 'github_pat_test', owner: 'HoldenCole', repo: 'CatholicClergyGame', branch: 'saves' };

/** GitHub, as much of it as the game uses: files on branches, and the refs. */
class FakeGithub {
  files = new Map<string, string>();
  branches = new Set<string>(['main']);
  calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  /** Set to make the next call fail with this status. */
  fail: { status: number; body?: string } | null = null;
  network = true;

  handler = async (url: string, init?: RequestInit): Promise<Response> => {
    if (!this.network) throw new TypeError('network down');
    const u = new URL(url);
    const path = u.pathname;
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    this.calls.push({ method, path, ...(body ? { body } : {}) });
    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (auth !== `Bearer ${cfg.token}`) return this.res(401, { message: 'Bad credentials' });
    if (this.fail) {
      const f = this.fail;
      this.fail = null;
      return new Response(f.body ?? JSON.stringify({ message: 'nope' }), { status: f.status });
    }
    const branch = u.searchParams.get('ref') ?? (body?.branch as string | undefined) ?? 'main';

    const ref = /^\/repos\/[^/]+\/[^/]+\/git\/ref\/heads\/(.+)$/.exec(path);
    if (ref) return this.branches.has(ref[1]!) ? this.res(200, { object: { sha: `sha-${ref[1]}` } }) : this.res(404, { message: 'Not Found' });
    if (path.endsWith('/git/refs') && method === 'POST') {
      this.branches.add(String(body!.ref).replace('refs/heads/', ''));
      return this.res(201, {});
    }
    if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) return this.res(200, { full_name: `${cfg.owner}/${cfg.repo}`, default_branch: 'main', permissions: { push: true } });

    const contents = /^\/repos\/[^/]+\/[^/]+\/contents\/(.*)$/.exec(path);
    if (contents) {
      const target = decodeURIComponent(contents[1]!);
      const key = `${branch}:${target}`;
      if (method === 'PUT') {
        this.files.set(key, fromBase64(String(body!.content)));
        return this.res(200, { content: { path: target, sha: `sha:${key}` } });
      }
      if (method === 'DELETE') {
        this.files.delete(key);
        return this.res(200, {});
      }
      // A folder.
      if (!target.endsWith('.json')) {
        const inside = [...this.files.keys()].filter((k) => k.startsWith(`${branch}:${target}/`));
        if (inside.length === 0) return this.res(404, { message: 'Not Found' });
        return this.res(
          200,
          inside.map((k) => {
            const p = k.slice(branch.length + 1);
            return { name: p.split('/').pop(), path: p, sha: `sha:${k}`, size: this.files.get(k)!.length };
          }),
        );
      }
      const text = this.files.get(key);
      if (text === undefined) return this.res(404, { message: 'Not Found' });
      const raw = (init?.headers as Record<string, string>)?.Accept === 'application/vnd.github.raw';
      return raw ? new Response(text, { status: 200 }) : this.res(200, { name: target.split('/').pop(), path: target, sha: `sha:${key}`, size: text.length });
    }
    return this.res(404, { message: 'Not Found' });
  };

  private res(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

let fake: FakeGithub;

beforeEach(() => {
  fake = new FakeGithub();
  vi.stubGlobal('fetch', ((url: string, init?: RequestInit) => fake.handler(String(url), init)) as typeof fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('engine/github', () => {
  it('reads a repository from anything a man would paste, and names a file after the run', () => {
    expect(parseRepo('HoldenCole/CatholicClergyGame')).toEqual({ owner: 'HoldenCole', repo: 'CatholicClergyGame' });
    expect(parseRepo('https://github.com/HoldenCole/CatholicClergyGame')).toEqual({ owner: 'HoldenCole', repo: 'CatholicClergyGame' });
    expect(parseRepo('https://github.com/HoldenCole/CatholicClergyGame.git')).toEqual({ owner: 'HoldenCole', repo: 'CatholicClergyGame' });
    expect(parseRepo('nonsense')).toBeNull();
    expect(saveFileName('run-1a2b')).toBe('saves/run-1a2b.json');
    expect(saveFileName('run-1a2b', 'Before Rome')).toBe('saves/run-1a2b--before-rome.json');
  });

  it('carries a name with accents through base64 unharmed', () => {
    const text = JSON.stringify({ name: 'Muñoz', place: 'Trần Phú', dash: '—' });
    expect(fromBase64(toBase64(text))).toBe(text);
  });

  it('makes the saves branch from the repository head, once', async () => {
    expect(fake.branches.has('saves')).toBe(false);
    await ensureBranch(cfg);
    expect(fake.branches.has('saves')).toBe(true);
    expect(fake.calls.some((c) => c.method === 'POST' && c.body?.ref === 'refs/heads/saves' && c.body?.sha === 'sha-main')).toBe(true);
    fake.calls = [];
    await ensureBranch(cfg);
    expect(fake.calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('commits a save and its index to the saves branch, and reads them back', async () => {
    const json = '{"state":"a save"}';
    const meta = { name: 'Before Rome', line: 'Fr. Reilly, pastor of St. Ita, 1994', seed: 'run-x', week: 700 };
    const written = await writeRemote(cfg, json, meta);
    expect(written.path).toBe('saves/run-x--before-rome.json');
    expect(fake.files.get(`saves:${written.path}`)).toBe(json);
    // Everything went to the saves branch, never to main.
    expect([...fake.files.keys()].every((k) => k.startsWith('saves:'))).toBe(true);
    expect(fake.calls.filter((c) => c.method === 'PUT').every((c) => c.body?.branch === 'saves')).toBe(true);
    expect(fake.calls.find((c) => c.method === 'PUT')!.body!.message).toMatch(/Fr\. Reilly/);

    const shelf = await listRemote(cfg);
    expect(shelf.length).toBe(1);
    expect(shelf[0]).toMatchObject({ path: written.path, name: 'Before Rome', line: meta.line, seed: 'run-x', week: 700 });
    expect(shelf[0]!.savedAt).not.toBe('');
    expect(await readRemote(cfg, written.path)).toBe(json);

    // Writing the same run again replaces it in place, with the blob's sha.
    await writeRemote(cfg, '{"state":"later"}', { ...meta, week: 900 });
    expect((await listRemote(cfg)).length).toBe(1);
    expect((await listRemote(cfg))[0]!.week).toBe(900);
    expect(fake.calls.some((c) => c.method === 'PUT' && typeof c.body?.sha === 'string')).toBe(true);

    // A second run sits beside the first, newest first.
    await writeRemote(cfg, '{"state":"other"}', { name: 'Another man', line: 'Fr. Novak, year 3 of seminary, 2011', seed: 'run-y', week: 120 });
    const both = await listRemote(cfg);
    expect(both.map((s) => s.seed)).toEqual(['run-y', 'run-x']);
    // The index is not offered as a save.
    expect(both.some((s) => s.path === GITHUB.indexPath)).toBe(false);

    await deleteRemote(cfg, 'saves/run-x--before-rome.json');
    const left = await listRemote(cfg);
    expect(left.map((s) => s.seed)).toEqual(['run-y']);
    expect(fake.files.has('saves:saves/run-x--before-rome.json')).toBe(false);
  });

  it('a file on the branch with no index entry is still offered, by its name', async () => {
    fake.branches.add('saves');
    fake.files.set('saves:saves/an-old-run.json', '{"state":"orphan"}');
    const shelf = await listRemote(cfg);
    expect(shelf.length).toBe(1);
    expect(shelf[0]!.name).toBe('an-old-run');
    expect(shelf[0]!.line).toBe('an-old-run');
  });

  it('says what GitHub refused, in words a player can act on', async () => {
    const wrongToken = { ...cfg, token: 'nope' };
    await expect(listRemote(wrongToken)).rejects.toThrow(/refused the token/);
    fake.fail = { status: 403, body: JSON.stringify({ message: 'Resource not accessible' }) };
    await expect(checkAccess(cfg)).rejects.toThrow(/Contents read and write/);
    fake.fail = { status: 403, body: JSON.stringify({ message: 'API rate limit exceeded' }) };
    await expect(checkAccess(cfg)).rejects.toThrow(/rate-limiting/);
    await expect(checkAccess({ ...cfg, repo: 'NotAThing' })).resolves.toBeTruthy(); // the fake answers any repo
    fake.fail = { status: 404, body: JSON.stringify({ message: 'Not Found' }) };
    await expect(checkAccess(cfg)).rejects.toThrow(/cannot see/);
    fake.network = false;
    await expect(checkAccess(cfg)).rejects.toThrow(/could not reach GitHub/);
    expect(new GithubError('x', 404).status).toBe(404);
  });

  it('a token that can read but not write is caught before anything is saved', async () => {
    vi.stubGlobal('fetch', (async () => new Response(JSON.stringify({ full_name: 'a/b', default_branch: 'main', permissions: { push: false } }), { status: 200 })) as typeof fetch);
    await expect(checkAccess(cfg)).rejects.toThrow(/not write to it/);
  });
});

describe('the store saves across machines', () => {
  beforeEach(() => {
    setWeekDraw(noDraw);
    resetAutosaveClock();
    useGameStore.getState().newGame({ seed: 'across', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.setState((s) => ({ game: { ...s.game!, mode: { kind: 'clock' } }, repoSaves: [], repoError: null, repoNote: null }));
    useGameStore.setState({ github: cfg });
  });
  afterEach(() => useGameStore.setState({ github: null }));

  it('commits this run, lists it, takes it back off, and deletes it', async () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    s.tick();
    const week = useGameStore.getState().game!.clock.week;

    await useGameStore.getState().pushToRepo('On the desktop');
    expect(useGameStore.getState().repoError).toBeNull();
    expect(useGameStore.getState().repoNote).toMatch(/Committed/);
    const shelf = useGameStore.getState().repoSaves;
    expect(shelf.length).toBe(1);
    expect(shelf[0]!.name).toBe('On the desktop');
    expect(shelf[0]!.week).toBe(week);

    // Another machine: a different game running, the same repository.
    useGameStore.getState().newGame({ seed: 'the-other-machine', start: { year: 2010, month: 8, day: 20 } });
    useGameStore.setState({ github: cfg });
    await useGameStore.getState().refreshRepoSaves();
    expect(useGameStore.getState().repoSaves.length).toBe(1);
    await useGameStore.getState().pullFromRepo(shelf[0]!.path);
    expect(useGameStore.getState().game!.seed).toBe('across');
    expect(useGameStore.getState().game!.clock.week).toBe(week);
    expect(useGameStore.getState().game!.speed).toBe('PAUSED');
    expect(useGameStore.getState().repoNote).toMatch(/off the repository/);

    // The run plays on from there.
    useGameStore.getState().setSpeed('MANUAL');
    useGameStore.getState().tick();
    expect(useGameStore.getState().game!.clock.week).toBe(week + 1);

    await useGameStore.getState().deleteRepoSave(shelf[0]!.path);
    expect(useGameStore.getState().repoSaves).toEqual([]);
  });

  it('leaving the page commits once, and not again until the week moves', async () => {
    const s = useGameStore.getState();
    s.setSpeed('MANUAL');
    s.tick();
    useGameStore.getState().pushOnLeaving();
    await vi.waitFor(() => expect(useGameStore.getState().repoSaves.length).toBe(1));
    const first = useGameStore.getState().repoSaves[0]!.savedAt;

    // Hidden again with nothing played: nothing is committed.
    useGameStore.getState().pushOnLeaving();
    await new Promise((r) => setTimeout(r, 50));
    expect(useGameStore.getState().repoSaves[0]!.savedAt).toBe(first);

    // And a man who turned it off is left alone.
    useGameStore.setState({ github: { ...cfg, autoPush: false } });
    useGameStore.getState().tick();
    useGameStore.getState().pushOnLeaving();
    await new Promise((r) => setTimeout(r, 50));
    expect(useGameStore.getState().repoSaves[0]!.savedAt).toBe(first);
  });

  it('a refusal is reported and the game is untouched', async () => {
    useGameStore.setState({ github: { ...cfg, token: 'wrong' } });
    const before = useGameStore.getState().game;
    await useGameStore.getState().pushToRepo();
    expect(useGameStore.getState().repoError).toMatch(/refused the token/);
    expect(useGameStore.getState().repoBusy).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
    await useGameStore.getState().refreshRepoSaves();
    expect(useGameStore.getState().repoError).toMatch(/refused the token/);
  });
});
