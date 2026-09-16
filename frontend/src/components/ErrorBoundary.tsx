import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0A0A0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <div
            style={{
              background: '#141416',
              border: '1px solid #262626',
              borderRadius: 12,
              padding: '40px 48px',
              maxWidth: 520,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,59,48,0.15)',
                border: '1px solid rgba(255,59,48,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 20,
              }}
            >
              ⚠
            </div>
            <h2
              style={{
                color: '#F5F5F5',
                fontSize: 18,
                fontWeight: 600,
                margin: '0 0 8px',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: '#6B7280',
                fontSize: 13,
                lineHeight: 1.6,
                margin: '0 0 20px',
              }}
            >
              The dashboard hit an unexpected error. This usually fixes itself on reload.
            </p>

            {this.state.error && (
              <pre
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid #262626',
                  borderRadius: 6,
                  padding: '12px 16px',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#FF3B30',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 120,
                  marginBottom: 20,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  background: 'rgba(255,59,48,0.15)',
                  border: '1px solid rgba(255,59,48,0.3)',
                  color: '#FF3B30',
                  padding: '8px 20px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleDismiss}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #262626',
                  color: '#6B7280',
                  padding: '8px 20px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
