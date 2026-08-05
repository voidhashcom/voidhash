import { Component, type ErrorInfo, type ReactNode } from "react";

export interface PreviewErrorBoundaryProps {
  children: ReactNode;
  /** Replaces the default full-size error panel (e.g. a compact card note). */
  fallback?: (error: Error) => ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

/**
 * Stops a runtime error in author code (a paywall or a component preview) from
 * blanking the whole Studio. Key it by the previewed entry's id upstream so
 * switching entries clears a previous error.
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // surface author errors in the dev console.
    console.error("[voidhash-studio] preview render error", error, info);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error);
      }
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700 text-sm">This paywall failed to render</p>
          <pre className="max-w-full overflow-auto whitespace-pre-wrap text-red-600 text-xs">
            {error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
