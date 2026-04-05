import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Key to reset the boundary when the slide changes */
  slideKey?: string | number;
}

interface State {
  hasError: boolean;
}

const AUTO_RECOVER_MS = 10000;

/**
 * Lightweight error boundary for individual slides.
 * If a slide throws during render, this shows a minimal fallback
 * and auto-recovers after 10 seconds (or immediately on slide change).
 */
export class SlideErrorBoundary extends Component<Props, State> {
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[SlideErrorBoundary] Slide render error:', error.message);
  }

  componentDidUpdate(prevProps: Props) {
    // Reset when the slide changes
    if (prevProps.slideKey !== this.props.slideKey && this.state.hasError) {
      this.clearTimer();
      this.setState({ hasError: false });
    }
  }

  componentWillUnmount() {
    this.clearTimer();
  }

  private clearTimer() {
    if (this.recoverTimer) {
      clearTimeout(this.recoverTimer);
      this.recoverTimer = null;
    }
  }

  private scheduleRecovery() {
    this.clearTimer();
    this.recoverTimer = setTimeout(() => {
      this.recoverTimer = null;
      this.setState({ hasError: false });
    }, AUTO_RECOVER_MS);
  }

  render() {
    if (this.state.hasError) {
      if (!this.recoverTimer) {
        this.scheduleRecovery();
      }

      return (
        <div className="w-full h-full bg-black/90 flex items-center justify-center">
          <div className="text-center text-white/40 select-none">
            <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            <p className="text-xs tracking-wider uppercase">Wird wiederhergestellt</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
