import React from 'react';

interface PixelPanelProps {
  title?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PixelPanel: React.FC<PixelPanelProps> = ({
  title,
  badge,
  actions,
  children,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        ...style
      }}
    >
      {(title || actions || badge) && (
        <div
          style={{
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: '12px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-ink-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{title}</span>
            {badge}
          </div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
};
