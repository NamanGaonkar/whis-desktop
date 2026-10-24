import React from 'react';
import { Plus, Terminal, Trash2, FolderGit2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useAgentStore } from '../stores/agentStore';
import { useProviderStore } from '../stores/providerStore';

interface SessionSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const {
    sessions,
    activeSessionId,
    switchSession,
    createNewSession,
    deleteSession,
    cwd
  } = useAgentStore();
  const activeProvider = useProviderStore((s) => s.activeProvider);

  return (
    <aside
      style={{
        width: collapsed ? '48px' : '230px',
        height: '100%',
        backgroundColor: 'var(--color-surface-panel)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0' : '0 10px',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-card)'
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--color-ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Sessions ({sessions.length})
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!collapsed && (
            <button
              onClick={() => createNewSession()}
              title="New Terminal Session"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--color-accent-amber)',
                cursor: 'pointer',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;

          if (collapsed) {
            return (
              <button
                key={session.id}
                onClick={() => switchSession(session.id)}
                title={session.title}
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  border: isActive ? '1px solid var(--color-accent-amber)' : '1px solid transparent',
                  backgroundColor: isActive ? 'var(--color-accent-amber-dim)' : 'transparent',
                  color: isActive ? 'var(--color-accent-amber)' : 'var(--color-ink-muted)',
                  cursor: 'pointer'
                }}
              >
                <Terminal size={16} />
              </button>
            );
          }

          return (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                border: isActive ? '1px solid var(--color-accent-amber)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--color-surface-card)' : 'transparent',
                color: 'var(--color-ink-primary)',
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <Terminal
                  size={14}
                  style={{
                    color: isActive ? 'var(--color-accent-amber)' : 'var(--color-ink-muted)',
                    flexShrink: 0
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {session.title}
                </span>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  title="Close Session"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-ink-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: 'var(--radius-xs)',
                    opacity: isActive ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div
          style={{
            padding: '10px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-inset)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink-secondary)' }}>
            <FolderGit2 size={13} style={{ color: 'var(--color-accent-amber)' }} />
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cwd.split(/\\|\//).pop() || 'Whis Project'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink-muted)' }}>
            <Sparkles size={12} style={{ color: 'var(--color-accent-amber)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProvider?.selectedModel || 'Default Model'}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
