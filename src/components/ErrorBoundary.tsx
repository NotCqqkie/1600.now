import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  hasAttemptedChunkReload,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/lib/chunkLoadRecovery";
import { reportError } from "@/lib/reportError";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    if (isChunkLoadError(error) && !hasAttemptedChunkReload()) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error) && !hasAttemptedChunkReload()) {
      recoverFromChunkLoadError();
      return;
    }
    reportError(error, { source: "error_boundary", componentStack: errorInfo.componentStack });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[1000] w-[min(calc(100vw-2rem),360px)] rounded-lg border border-destructive/25 bg-background p-3 text-foreground shadow-2xl"
        >
          <h2 className="text-sm font-semibold">Something went wrong</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            This part of the page could not load. You can keep working or try again.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
              {this.state.error?.toString()}
            </pre>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleRefresh}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-cobalt hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
