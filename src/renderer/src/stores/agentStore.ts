import { create } from 'zustand';
import { SessionRecord } from '../../../shared/types';

interface AgentState {
  cwd: string;
  activeSessionId: string;
  sessions: SessionRecord[];
  agentStatus: 'idle' | 'running' | 'exited';
  appVersion: string;

  initWorkspace: () => Promise<void>;
  setCwd: (path: string) => void;
  browseDirectory: () => Promise<void>;
  createNewSession: () => Promise<string>;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  setAgentStatus: (status: 'idle' | 'running' | 'exited') => void;
  restartAgent: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  cwd: '',
  activeSessionId: 'whis-primary',
  sessions: [],
  agentStatus: 'idle',
  appVersion: '1.0.0',

  initWorkspace: async () => {
    try {
      let defaultCwd = '';
      if (window.whis?.getDefaultCwd) {
        defaultCwd = await window.whis.getDefaultCwd();
      }

      let version = '1.0.0';
      if (window.whis?.getAppVersion) {
        version = await window.whis.getAppVersion();
      }

      let savedSessions: SessionRecord[] = [];
      if (window.whis?.getSessions) {
        savedSessions = await window.whis.getSessions();
      }

      if (savedSessions.length === 0) {
        const primarySession: SessionRecord = {
          id: 'whis-primary',
          title: 'Main Session',
          cwd: defaultCwd,
          createdAt: Date.now()
        };
        savedSessions = [primarySession];
        if (window.whis?.saveSession) {
          await window.whis.saveSession(primarySession);
        }
      }

      const active = savedSessions[0];
      set({
        cwd: active.cwd || defaultCwd,
        activeSessionId: active.id,
        sessions: savedSessions,
        appVersion: version
      });
    } catch (e) {
      console.error('Failed to init workspace:', e);
    }
  },

  setCwd: (newPath: string) => {
    const { activeSessionId, sessions } = get();
    set({ cwd: newPath });

    const updated = sessions.map((s) => (s.id === activeSessionId ? { ...s, cwd: newPath } : s));
    set({ sessions: updated });

    const current = updated.find((s) => s.id === activeSessionId);
    if (current && window.whis?.saveSession) {
      window.whis.saveSession(current);
    }
  },

  browseDirectory: async () => {
    if (!window.whis?.selectDirectory) return;
    try {
      const selected = await window.whis.selectDirectory(get().cwd);
      if (selected) {
        get().setCwd(selected);
        // Restart agent session in new cwd
        get().restartAgent();
      }
    } catch (e) {
      console.error('Failed to browse directory:', e);
    }
  },

  createNewSession: async () => {
    const id = `session-${Date.now().toString(36)}`;
    const title = `Session ${get().sessions.length + 1}`;
    const newSession: SessionRecord = {
      id,
      title,
      cwd: get().cwd,
      createdAt: Date.now()
    };

    const nextSessions = [newSession, ...get().sessions];
    set({
      activeSessionId: id,
      sessions: nextSessions,
      agentStatus: 'idle'
    });

    if (window.whis?.saveSession) {
      await window.whis.saveSession(newSession);
    }
    return id;
  },

  switchSession: (id: string) => {
    const target = get().sessions.find((s) => s.id === id);
    if (!target) return;
    set({
      activeSessionId: id,
      cwd: target.cwd || get().cwd,
      agentStatus: 'idle'
    });
  },

  deleteSession: async (id: string) => {
    const { sessions, activeSessionId } = get();
    if (sessions.length <= 1) return; // Retain at least one session

    if (window.whis?.killPty) {
      window.whis.killPty(id);
    }
    if (window.whis?.deleteSession) {
      await window.whis.deleteSession(id);
    }

    const filtered = sessions.filter((s) => s.id !== id);
    let nextActiveId = activeSessionId;
    if (activeSessionId === id) {
      nextActiveId = filtered[0].id;
    }

    set({
      sessions: filtered,
      activeSessionId: nextActiveId,
      cwd: filtered.find((s) => s.id === nextActiveId)?.cwd || get().cwd
    });
  },

  setAgentStatus: (status) => set({ agentStatus: status }),

  restartAgent: () => {
    const id = get().activeSessionId;
    if (window.whis?.killPty) {
      window.whis.killPty(id);
    }
    set({ agentStatus: 'idle' });
  }
}));
