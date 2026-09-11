import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '@/engine/store';

interface State { error: Error | null }

/**
 * The crash net: a bug in year thirty never costs the run. The error is shown,
 * the last auto-resolved week can be taken back, and the save can be kept.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Vocation crashed', error, info.componentStack);
  }

  private takeBack = () => {
    try {
      useGameStore.getState().rewind();
    } catch (e) {
      console.error(e);
    }
    this.setState({ error: null });
  };

  private keep = () => {
    try {
      const json = useGameStore.getState().exportSave();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'vocation-rescued.json';
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const game = useGameStore.getState().game;
    return (
      <div className="felt flex min-h-screen items-center justify-center p-6">
        <div className="paper paper-tilt-l flex w-full max-w-xl flex-col gap-3 px-8 py-8">
          <h1 className="title text-xl">Something broke</h1>
          <p className="text-sm leading-relaxed">The game hit an error it could not recover from on its own. Nothing is lost: the autosave is from the last good week{game ? `, week ${game.clock.week}` : ''}.</p>
          <pre className="ink-wine max-h-40 overflow-auto whitespace-pre-wrap rounded border rule bg-white/30 p-2 font-mono text-xs">{this.state.error.message}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button className="pbtn pbtn-primary" onClick={this.takeBack}>Take it back a week</button>
            <button className="pbtn" onClick={() => this.setState({ error: null })}>Try again</button>
            <button className="pbtn-link" onClick={this.keep}>Keep the save</button>
            <button className="pbtn-link" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
