/**
 * The claude.ai artifact viewer hands a published page a `window.claude`
 * with one method. Everywhere else it is absent, and the game must not
 * care. Only what the save sheet uses is declared here.
 */
interface HostDownloads {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

interface Window {
  claude?: { use(name: 'downloads'): Promise<HostDownloads | null> };
}
