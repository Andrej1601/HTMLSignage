import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered in place of the children if the design renderer throws. */
  fallback: ReactNode;
  /** Optional telemetry hook (wired to the audit log from Phase 6). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Key that resets the boundary when it changes (e.g. slide id). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  lastKey: string | undefined;
}

/**
 * Error boundary scoped to a single design-rendered slide.
 *
 * A crashing renderer must not take the whole display down. When this
 * boundary catches an error it swaps to `fallback` (typically the
 * legacy component path) and logs. When the slide changes (`resetKey`
 * updates), the boundary resets automatically so transient failures
 * don't persist across unrelated slides.
 */
export class DesignErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, lastKey: undefined };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.lastKey) {
      return { hasError: false, lastKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
