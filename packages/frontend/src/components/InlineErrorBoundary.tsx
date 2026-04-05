import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class InlineErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[InlineErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-spa-error/20 bg-spa-error-light/50 p-6 text-center" role="alert">
          <AlertTriangle className="w-6 h-6 text-spa-error mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-spa-error-dark">
            {this.props.fallbackLabel ?? 'Dieser Bereich konnte nicht geladen werden.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
