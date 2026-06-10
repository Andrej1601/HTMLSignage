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
      <div className="min-h-screen flex items-center justify-center bg-spa-bg-primary text-spa-text-primary p-6">
        <div className="max-w-lg w-full rounded-3xl border border-spa-bg-secondary bg-spa-surface shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold mb-3 text-spa-primary">Display neu laden</h1>
          <p className="text-sm text-spa-text-secondary mb-6">
            Im Anzeigemodus ist ein unerwarteter Fehler aufgetreten.
          </p>
          {this.state.error ? (
            <p className="text-xs text-spa-text-secondary/70 mb-6 break-words">
              {this.state.error.message}
            </p>
          ) : null}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-spa-primary text-white hover:bg-spa-primary-dark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-spa-primary"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg border border-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-spa-primary"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }
}
