import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { RotateCw, Trash2, Copy, ZoomIn, ZoomOut } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useAgentStore } from '../stores/agentStore';
import { TERMINAL_THEMES } from '../design/tokens';

interface TerminalViewProps {
  sessionId: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const { cwd, setAgentStatus } = useAgentStore();
  const [fontSize, setFontSize] = useState(13);

  // Initialize terminal and PTY
  useEffect(() => {
    if (!containerRef.current) return;

    const currentTheme = theme === 'light' ? TERMINAL_THEMES.light : TERMINAL_THEMES.dark;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize,
      lineHeight: 1.3,
      letterSpacing: 0.5,
      theme: currentTheme,
      allowTransparency: false,
      convertEol: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // Graceful fallback to canvas/DOM renderer
    }

    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Stream user input to PTY
    const onDataDisposable = term.onData((data) => {
      window.whis?.writePty(sessionId, data);
    });

    // Listen to output from PTY
    const unsubscribeData = window.whis?.onPtyData(sessionId, (data) => {
      term.write(data);
    });

    // Listen to exit
    const unsubscribeExit = window.whis?.onPtyExit(sessionId, (info) => {
      setAgentStatus('exited');
      term.writeln(`\r\n\x1b[33m[Whis Process finished with code ${info.exitCode ?? 0}]\x1b[0m\r\n`);
    });

    // Spawn the Whis PTY session
    setAgentStatus('running');
    window.whis
      ?.spawnPty({
        id: sessionId,
        command: 'whis',
        cwd: cwd || undefined,
        cols: term.cols,
        rows: term.rows
      })
      .then((res) => {
        if (!res?.success) {
          term.writeln(`\r\n\x1b[31m[Error launching Whis CLI: ${res?.error || 'Unknown error'}]\x1b[0m\r\n`);
          term.writeln(`\x1b[90mEnsure 'whis' is installed and in PATH or select workspace folder.\x1b[0m\r\n`);
          setAgentStatus('idle');
        }
      });

    // Auto-fit terminal on resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (term.cols > 0 && term.rows > 0) {
          window.whis?.resizePty(sessionId, term.cols, term.rows);
        }
      } catch {
        // Suppress layout race errors
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      onDataDisposable.dispose();
      unsubscribeData?.();
      unsubscribeExit?.();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cwd]);

  // Dynamically update terminal theme on Light/Dark mode changes
  useEffect(() => {
    if (termRef.current) {
      const activeTheme = theme === 'light' ? TERMINAL_THEMES.light : TERMINAL_THEMES.dark;
      termRef.current.options.theme = activeTheme;
    }
  }, [theme]);

  // Adjust font size
  const handleZoom = (delta: number) => {
    const next = Math.max(10, Math.min(22, fontSize + delta));
    setFontSize(next);
    if (termRef.current) {
      termRef.current.options.fontSize = next;
      fitAddonRef.current?.fit();
      if (termRef.current.cols > 0 && termRef.current.rows > 0) {
        window.whis?.resizePty(sessionId, termRef.current.cols, termRef.current.rows);
      }
    }
  };

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  const handleRestart = () => {
    if (termRef.current) {
      termRef.current.reset();
      setAgentStatus('running');
      window.whis
        ?.spawnPty({
          id: sessionId,
          command: 'whis',
          cwd: cwd || undefined,
          cols: termRef.current.cols,
          rows: termRef.current.rows
        })
        .then((res) => {
          if (!res?.success) {
            termRef.current?.writeln(`\r\n\x1b[31m[Failed to restart Whis CLI: ${res?.error}]\x1b[0m\r\n`);
          }
        });
    }
  };

  const handleCopy = () => {
    if (termRef.current && termRef.current.hasSelection()) {
      const selection = termRef.current.getSelection();
      navigator.clipboard.writeText(selection);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--color-surface-panel)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      {/* Terminal Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--color-accent-amber)'
            }}
          >
            whis terminal
          </span>
          <span style={{ color: 'var(--color-ink-muted)', fontSize: '11px' }}>
            interactive pty
          </span>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => handleZoom(1)}
            title="Zoom In"
            style={actionButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            title="Zoom Out"
            style={actionButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy Selection"
            style={actionButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleClear}
            title="Clear Terminal"
            style={actionButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={handleRestart}
            title="Restart Whis Process"
            style={{
              ...actionButtonStyle,
              color: 'var(--color-accent-amber)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          padding: '8px 10px',
          backgroundColor: 'var(--term-bg)',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

const actionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-ink-secondary)',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: 'var(--radius-xs)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease'
};
