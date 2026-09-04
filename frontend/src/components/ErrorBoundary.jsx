/**
 * Catches render-time exceptions so one bad record cannot blank the whole app.
 * Much of what we render is LLM-generated and reaches the client unvalidated,
 * so a missing field is a realistic failure mode rather than a theoretical one.
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="ui-root flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg space-y-3 rounded-lg bg-card p-5 shadow-raised ring-1 ring-border/60">
          <h2 className="font-display text-base font-bold">Something went wrong</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This view failed to render. Reloading usually clears it — the full error is in
            the browser console.
          </p>
          <pre className="max-h-40 overflow-auto rounded-md bg-secondary/50 p-2.5 text-[0.65rem] leading-relaxed text-secondary-foreground/90">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
