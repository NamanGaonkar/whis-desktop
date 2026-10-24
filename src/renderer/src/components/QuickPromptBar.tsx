import React, { useState } from 'react';
import { Send, Sparkles, Terminal, BookOpen, CheckCircle, RefreshCw } from 'lucide-react';
import { useAgentStore } from '../stores/agentStore';

const QUICK_COMMANDS = [
  { label: 'whis --mini', cmd: 'whis --mini\r', icon: Terminal },
  { label: '/compact', cmd: '/compact\r', icon: RefreshCw },
  { label: 'whis models', cmd: 'whis models\r', icon: Sparkles },
  { label: 'git status', cmd: 'git status\r', icon: CheckCircle },
  { label: 'explain codebase', cmd: 'Explain the structure and architecture of this project\r', icon: BookOpen }
];

export const QuickPromptBar: React.FC = () => {
  const [input, setInput] = useState('');
  const activeSessionId = useAgentStore((s) => s.activeSessionId);

  const handleSend = () => {
    if (!input.trim()) return;
    window.whis?.writePty(activeSessionId, `${input}\r`);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const sendQuickCmd = (cmd: string) => {
    window.whis?.writePty(activeSessionId, cmd);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: 'var(--color-surface-panel)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Quick Command Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-ink-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginRight: '4px',
            whiteSpace: 'nowrap'
          }}
        >
          Quick Actions:
        </span>
        {QUICK_COMMANDS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => sendQuickCmd(item.cmd)}
              title={`Execute: ${item.cmd.replace('\r', '')}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-ink-primary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-amber-dim)';
                e.currentTarget.style.borderColor = 'var(--color-accent-amber)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-card)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <Icon size={11} style={{ color: 'var(--color-accent-amber)' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Input Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 10px',
            gap: '8px',
            transition: 'border-color 0.15s'
          }}
          onFocus={() => {}}
        >
          <span style={{ color: 'var(--color-accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            &gt;
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or instruction to send to Whis..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-ink-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 0'
            }}
          />
        </div>

        <button
          onClick={handleSend}
          title="Send to Terminal (Enter)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            backgroundColor: 'var(--color-accent-amber)',
            color: '#1C1405',
            fontWeight: 600,
            fontSize: '12px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-amber-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-amber)')}
        >
          <span>Send</span>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
