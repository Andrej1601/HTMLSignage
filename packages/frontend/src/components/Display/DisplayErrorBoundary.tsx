import { Component, type ErrorInfo, type ReactNode } from 'react';

interface DisplayErrorBoundaryProps {
  children: ReactNode;
}

interface DisplayErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

export class DisplayErrorBoundary extends Component<
  DisplayErrorBoundaryProps,
  DisplayErrorBoundaryState
> {
  state: DisplayErrorBoundaryState = {
    error: null,
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): DisplayErrorBoundaryState {
    return {
      error,
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[DisplayErrorBoundary] Unhandled display error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      error: null,
      hasError: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="max-w-lg w-full rounded-3xl border border-white/15 bg-white/8 backdrop-blur-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">Display neu laden</h1>
          <p className="text-sm text-white/75 mb-6">
            Im Anzeigemodus ist ein unerwarteter Fehler aufgetreten.
          </p>
          {this.state.error ? (
            <p className="text-xs text-white/50 mb-6 break-words">
              {this.state.error.message}
            </p>
          ) : null}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90"
            >
              Erneut versuchen
            </button>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }
}
