import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Whis Desktop renderer:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'var(--color-bg-canvas, #12100E)',
            color: 'var(--color-ink-primary, #F5E8D0)',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            padding: '24px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--color-surface-panel, #1C1814)',
              border: '1px solid var(--color-border, #332B22)',
              borderRadius: '10px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(232, 191, 83, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--color-accent-amber, #E8BF53)'
              }}
            >
              <AlertTriangle size={26} />
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--color-accent-amber, #E8BF53)'
              }}
            >
              Whis Desktop Encountered a Display Issue
            </h2>

            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '13px',
                color: 'var(--color-ink-secondary, #B8A99A)',
                lineHeight: 1.5
              }}
            >
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>

            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                backgroundColor: 'var(--color-accent-amber, #E8BF53)',
                color: '#1C1405',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1.0')}
            >
              <RefreshCw size={14} />
              <span>Reload Whis</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
