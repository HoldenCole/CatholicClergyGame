/**
 * The repository as a shelf, so a run started on one machine can be picked up
 * on another. Saves are committed as JSON to a branch of the game's own
 * repository — `saves` by default, which the Pages workflow does not watch, so
 * saving never redeploys the site.
 *
 * The token is the player's own fine-grained personal access token, scoped to
 * this one repository with Contents: read and write, and it is kept in the
 * browser's storage on that machine only. It is never part of a save, never
 * committed, and never sent anywhere but api.github.com. Requested in
 * playtesting.
 */

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Commit the run when the page is closed or hidden, so nothing is left behind on this machine. */
  autoPush?: boolean;
}

export interface RemoteSave {
  /** Path in the repository, e.g. "saves/run-abc.json". */
  path: string;
  name: string;
  /** Who and where, when the index knows; the filename otherwise. */
  line: string;
  seed: string;
  week: number;
  savedAt: string;
  bytes: number;
  /** Git blob sha, needed to write over it or delete it. */
  sha: string;
}

export const GITHUB = {
  key: 'vocation:github',
  folder: 'saves',
  indexPath: 'saves/index.json',
  defaultBranch: 'saves',
  api: 'https://api.github.com',
} as const;

export class GithubError extends Error {
  override name = 'GithubError';
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

/** "owner/repo", or any GitHub URL of one. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
  const m = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/.exec(trimmed);
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}

export function loadGithub(): GithubConfig | null {
  try {
    const raw = globalThis.localStorage?.getItem(GITHUB.key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GithubConfig>;
    if (!parsed.token || !parsed.owner || !parsed.repo) return null;
    return { token: parsed.token, owner: parsed.owner, repo: parsed.repo, branch: parsed.branch || GITHUB.defaultBranch, autoPush: parsed.autoPush !== false };
  } catch {
    return null;
  }
}

export function saveGithub(cfg: GithubConfig | null): void {
  try {
    if (cfg) globalThis.localStorage?.setItem(GITHUB.key, JSON.stringify(cfg));
    else globalThis.localStorage?.removeItem(GITHUB.key);
  } catch {
    /* a browser that refuses storage: the settings last the session */
  }
}

/** UTF-8 to base64, in chunks, because a save is far too long for one call. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** A file name from a run's seed and the name the player gave it. */
export function saveFileName(seed: string, name?: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'run';
  const label = name?.trim() ? `--${slug(name)}` : '';
  return `${GITHUB.folder}/${slug(seed)}${label}.json`;
}

interface FetchOpts {
  method?: string;
  body?: unknown;
  raw?: boolean;
  /** 404 is an answer, not a failure: a missing file or branch. */
  allow404?: boolean;
}

async function call(cfg: GithubConfig, path: string, opts: FetchOpts = {}): Promise<unknown> {
  const res = await fetch(`${GITHUB.api}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: opts.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  }).catch(() => {
    throw new GithubError('could not reach GitHub: check the connection');
  });
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const message = /"message"\s*:\s*"([^"]+)"/.exec(detail)?.[1] ?? res.statusText;
    if (res.status === 401) throw new GithubError('GitHub refused the token: check it, and that it has not expired', 401);
    if (res.status === 403 && /rate limit/i.test(detail)) throw new GithubError('GitHub is rate-limiting: wait a few minutes', 403);
    if (res.status === 403) throw new GithubError('the token may not write to that repository: it needs Contents read and write', 403);
    if (res.status === 404) throw new GithubError(`GitHub cannot see ${cfg.owner}/${cfg.repo}: check the name, and that the token covers it`, 404);
    if (res.status === 409 || res.status === 422) throw new GithubError(`GitHub would not take the write: ${message}`, res.status);
    throw new GithubError(`GitHub said: ${message}`, res.status);
  }
  return opts.raw ? await res.text() : res.status === 204 ? null : await res.json();
}

/** The saves branch, made from the repository's own head the first time it is needed. */
export async function ensureBranch(cfg: GithubConfig): Promise<void> {
  const ref = await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.branch}`, { allow404: true });
  if (ref) return;
  const repo = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}`)) as { default_branch: string };
  const head = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${repo.default_branch}`)) as { object: { sha: string } };
  await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${cfg.branch}`, sha: head.object.sha } });
}

interface ContentFile {
  name: string;
  path: string;
  sha: string;
  size: number;
}

/** Every save on the branch, newest first. One request for the folder, one for the index. */
export async function listRemote(cfg: GithubConfig): Promise<RemoteSave[]> {
  const listing = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${GITHUB.folder}?ref=${cfg.branch}`, { allow404: true })) as ContentFile[] | null;
  if (!Array.isArray(listing)) return [];
  const files = listing.filter((f) => f.name.endsWith('.json') && f.path !== GITHUB.indexPath);
  const index = await readIndex(cfg);
  const saves = files.map((f) => {
    const meta = index.find((m) => m.path === f.path);
    return {
      path: f.path,
      name: meta?.name ?? f.name.replace(/\.json$/, ''),
      line: meta?.line ?? f.name.replace(/\.json$/, ''),
      seed: meta?.seed ?? '',
      week: meta?.week ?? 0,
      savedAt: meta?.savedAt ?? '',
      bytes: f.size,
      sha: f.sha,
    };
  });
  return saves.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

type IndexEntry = Omit<RemoteSave, 'sha'>;

async function readIndex(cfg: GithubConfig): Promise<IndexEntry[]> {
  try {
    const raw = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${GITHUB.indexPath}?ref=${cfg.branch}`, { raw: true, allow404: true })) as string | null;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as IndexEntry[]).filter((m) => typeof m?.path === 'string') : [];
  } catch {
    return [];
  }
}

async function shaOf(cfg: GithubConfig, path: string): Promise<string | undefined> {
  const file = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`, { allow404: true })) as ContentFile | null;
  return file?.sha;
}

async function put(cfg: GithubConfig, path: string, text: string, message: string): Promise<void> {
  const sha = await shaOf(cfg, path);
  await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    body: { message, content: toBase64(text), branch: cfg.branch, ...(sha ? { sha } : {}) },
  });
}

/** Commit one save, and keep the index beside it so the shelf reads in prose. */
export async function writeRemote(cfg: GithubConfig, json: string, meta: { name: string; line: string; seed: string; week: number }): Promise<RemoteSave> {
  await ensureBranch(cfg);
  const path = saveFileName(meta.seed, meta.name);
  await put(cfg, path, json, `Save: ${meta.line}`);
  const entry: IndexEntry = { path, name: meta.name, line: meta.line, seed: meta.seed, week: meta.week, savedAt: new Date().toISOString(), bytes: json.length };
  const index = [...(await readIndex(cfg)).filter((m) => m.path !== path), entry];
  await put(cfg, GITHUB.indexPath, `${JSON.stringify(index, null, 2)}\n`, 'Save index');
  return { ...entry, sha: (await shaOf(cfg, path)) ?? '' };
}

/** The JSON of one save on the branch. */
export async function readRemote(cfg: GithubConfig, path: string): Promise<string> {
  const raw = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`, { raw: true })) as string;
  return raw;
}

export async function deleteRemote(cfg: GithubConfig, path: string): Promise<void> {
  const sha = await shaOf(cfg, path);
  if (!sha) return;
  await call(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, { method: 'DELETE', body: { message: `Delete save ${path}`, sha, branch: cfg.branch } });
  const index = (await readIndex(cfg)).filter((m) => m.path !== path);
  await put(cfg, GITHUB.indexPath, `${JSON.stringify(index, null, 2)}\n`, 'Save index');
}

/** Whether the token and repository work at all, for the settings box. */
export async function checkAccess(cfg: GithubConfig): Promise<string> {
  const repo = (await call(cfg, `/repos/${cfg.owner}/${cfg.repo}`)) as { full_name: string; permissions?: { push?: boolean } };
  if (repo.permissions && !repo.permissions.push) throw new GithubError('that token can read the repository but not write to it: it needs Contents read and write', 403);
  return repo.full_name;
}
