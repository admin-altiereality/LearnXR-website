import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight boundary for non-critical UI (maps, charts) so one failure
 * does not take down the whole marketing page.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(`SectionErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            This section could not be loaded. Please refresh the page.
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
