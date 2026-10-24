import React, { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { SessionSidebar } from './components/SessionSidebar';
import { TerminalView } from './components/TerminalView';
import { QuickPromptBar } from './components/QuickPromptBar';
import { ProviderModal } from './components/ProviderModal';
import { useThemeStore } from './stores/themeStore';
import { useAgentStore } from './stores/agentStore';
import { useProviderStore } from './stores/providerStore';

export const App: React.FC = () => {
  const initTheme = useThemeStore((s) => s.initTheme);
  const { initWorkspace, activeSessionId } = useAgentStore();
  const fetchProviders = useProviderStore((s) => s.fetchProviders);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    initTheme();
    initWorkspace();
    fetchProviders();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-canvas)',
        overflow: 'hidden'
      }}
    >
      {/* Sleek Custom TitleBar */}
      <TitleBar />

      {/* Main Content Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* Collapsible Session Navigation */}
        <SessionSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Central Terminal & Workspace Canvas */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '10px 14px 12px 14px',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          {/* Active Terminal Canvas */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <TerminalView key={activeSessionId} sessionId={activeSessionId} />
          </div>

          {/* Quick Prompt & Command Injection Bar */}
          <QuickPromptBar />
        </main>
      </div>

      {/* Model & Provider Settings Modal */}
      <ProviderModal />
    </div>
  );
};

export default App;
