import React from 'react';
import {
  Folder,
  Sliders,
  Sun,
  Moon,
  Minus,
  Square,
  X,
  Terminal,
  Cpu
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useAgentStore } from '../stores/agentStore';
import { useProviderStore } from '../stores/providerStore';

export const TitleBar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { cwd, browseDirectory, agentStatus } = useAgentStore();
  const { activeProvider, openModal } = useProviderStore();

  const handleMinimize = () => window.whis?.minimizeWindow();
  const handleMaximize = () => window.whis?.maximizeWindow();
  const handleClose = () => window.whis?.closeWindow();

  // Extract basename for cleaner folder display
  const folderName = cwd
    ? cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() || cwd
    : 'Select Workspace';

  return (
    <header
      className="app-drag-region"
      style={{
        height: '42px',
        backgroundColor: 'var(--color-surface-panel)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        userSelect: 'none',
        zIndex: 50,
        transition: 'background-color 0.2s ease, border-color 0.2s ease'
      }}
    >
      {/* Left section: App Brand & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-accent-amber)',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.08em'
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--color-surface-inset)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-amber)'
            }}
          >
            <Terminal size={14} strokeWidth={2.5} />
          </div>
          <span>WHIS</span>
        </div>

        {/* Live Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-surface-inset)',
            border: '1px solid var(--color-border)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-ink-secondary)'
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor:
                agentStatus === 'running'
                  ? 'var(--color-success)'
                  : agentStatus === 'idle'
                  ? 'var(--color-accent-amber)'
                  : 'var(--color-ink-muted)',
              boxShadow: agentStatus === 'running' ? '0 0 6px var(--color-success)' : undefined
            }}
          />
          <span style={{ textTransform: 'capitalize' }}>{agentStatus}</span>
        </div>
      </div>

      {/* Middle section: Workspace Selector & Provider Badge */}
      <div
        className="app-no-drag"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        {/* Workspace directory button */}
        <button
          onClick={browseDirectory}
          title={`Working directory: ${cwd}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-ink-primary)',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            maxWidth: '260px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card)')}
        >
          <Folder size={13} style={{ color: 'var(--color-accent-amber)', flexShrink: 0 }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500
            }}
          >
            {folderName}
          </span>
        </button>

        {/* Active Provider & Model Pill */}
        <button
          onClick={openModal}
          title="Configure AI Models & Providers"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-accent-amber-dim)',
            color: 'var(--color-accent-amber)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-amber-dim)')}
        >
          <Cpu size={13} />
          <span>{activeProvider ? activeProvider.selectedModel : 'Configure Provider'}</span>
          <Sliders size={12} style={{ opacity: 0.75 }} />
        </button>
      </div>

      {/* Right section: Theme Toggle & Window Controls */}
      <div
        className="app-no-drag"
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {/* Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-ink-primary)',
            cursor: 'pointer',
            marginRight: '8px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card)')}
        >
          {theme === 'dark' ? (
            <Sun size={15} style={{ color: 'var(--color-accent-amber)' }} />
          ) : (
            <Moon size={15} style={{ color: 'var(--color-ink-primary)' }} />
          )}
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-secondary)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-xs)',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Minus size={13} />
        </button>

        {/* Maximize */}
        <button
          onClick={handleMaximize}
          title="Maximize"
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-secondary)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-xs)',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Square size={12} />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          title="Close Whis"
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-secondary)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-xs)',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-error)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-ink-secondary)';
          }}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
