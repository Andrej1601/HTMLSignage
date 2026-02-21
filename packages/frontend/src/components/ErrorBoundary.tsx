import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unbehandelter Fehler:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-spa-bg-primary p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-spa-text-primary mb-2">
              Etwas ist schiefgelaufen
            </h1>
            <p className="text-spa-text-secondary mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder lade die Seite neu.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-spa-text-secondary hover:text-spa-text-primary">
                  Technische Details
                </summary>
                <pre className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Erneut versuchen
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-bg-secondary transition-colors"
              >
                Seite neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
