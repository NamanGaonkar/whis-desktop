import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Cpu,
  Key,
  Globe,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Activity,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useProviderStore } from '../stores/providerStore';
import { ProviderConfig, ProviderType } from '../../../shared/types';

export const ProviderModal: React.FC = () => {
  const {
    providers,
    activeProvider,
    isModalOpen,
    closeModal,
    setActiveProvider,
    updateProvider,
    addCustomProvider,
    deleteProvider
  } = useProviderStore();

  const [selectedId, setSelectedId] = useState<string>('');
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message?: string; ok?: boolean } | null>(null);

  // Sync selection
  useEffect(() => {
    if (isModalOpen) {
      const targetId = activeProvider?.id || providers[0]?.id || '';
      setSelectedId(targetId);
      const prov = providers.find((p) => p.id === targetId) || null;
      setEditingProvider(prov ? { ...prov } : null);
      setTestStatus(null);
    }
  }, [isModalOpen, activeProvider]);

  const handleSelectProvider = (prov: ProviderConfig) => {
    setSelectedId(prov.id);
    setEditingProvider({ ...prov });
    setTestStatus(null);
    setShowApiKey(false);
  };

  const handleSave = async () => {
    if (!editingProvider) return;
    await updateProvider(editingProvider);
    setTestStatus({ testing: false, ok: true, message: 'Settings saved successfully!' });
  };

  const handleMakeActive = async () => {
    if (!editingProvider) return;
    await updateProvider(editingProvider);
    await setActiveProvider(editingProvider.id);
    setTestStatus({ testing: false, ok: true, message: `Activated ${editingProvider.name} for Whis!` });
  };

  const handleTestConnection = async () => {
    if (!editingProvider || !window.whis?.testProviderConnection) return;
    setTestStatus({ testing: true });
    try {
      const res = await window.whis.testProviderConnection(editingProvider);
      setTestStatus({ testing: false, ok: res.ok, message: res.message });
    } catch (err: any) {
      setTestStatus({ testing: false, ok: false, message: err?.message || 'Connection failed' });
    }
  };

  const handleAddCustom = async () => {
    await addCustomProvider({
      name: 'Custom Provider',
      type: 'custom',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      selectedModel: 'gpt-4o',
      availableModels: ['gpt-4o', 'claude-3-7-sonnet']
    });
  };

  const handleAddModel = () => {
    if (!customModelInput.trim() || !editingProvider) return;
    const model = customModelInput.trim();
    if (!editingProvider.availableModels.includes(model)) {
      setEditingProvider({
        ...editingProvider,
        availableModels: [...editingProvider.availableModels, model],
        selectedModel: model
      });
    }
    setCustomModelInput('');
  };

  if (!isModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        style={{
          width: '840px',
          maxWidth: '95vw',
          height: '560px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--color-surface-card)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} style={{ color: 'var(--color-accent-amber)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                LLM Providers &amp; Models
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Configure credentials and models for Whis CLI
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-xs)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Master-Detail Layout */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left Column: Providers List */}
          <div
            style={{
              width: '260px',
              borderRight: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-inset)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                Providers ({providers.length})
              </span>
              <button
                onClick={handleAddCustom}
                title="Add Custom Provider"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-accent-amber)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '2px 6px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {providers.map((p) => {
                const isSelected = p.id === selectedId;
                const isActive = p.isActive;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProvider(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--color-accent-amber)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--color-surface-panel)' : 'transparent',
                      color: 'var(--color-ink-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s'
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.selectedModel}
                      </div>
                    </div>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--color-accent-amber)',
                          color: '#1C1405'
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Provider Editor */}
          <div
            style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {editingProvider ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                      {editingProvider.name}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      Type: {editingProvider.type}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingProvider.id.startsWith('prov-custom') && (
                      <button
                        onClick={() => deleteProvider(editingProvider.id)}
                        title="Delete Provider"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-error)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                    <button
                      onClick={handleMakeActive}
                      disabled={editingProvider.isActive}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: editingProvider.isActive ? 'var(--color-surface-card)' : 'var(--color-accent-amber)',
                        color: editingProvider.isActive ? 'var(--color-ink-muted)' : '#1C1405',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: editingProvider.isActive ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Check size={14} />
                      <span>{editingProvider.isActive ? 'Currently Active' : 'Set as Active'}</span>
                    </button>
                  </div>
                </div>

                {/* Base URL (if applicable) */}
                {(editingProvider.type === 'ollama' ||
                  editingProvider.type === 'deepseek' ||
                  editingProvider.type === 'groq' ||
                  editingProvider.type === 'openrouter' ||
                  editingProvider.type === 'custom') && (
                  <div>
                    <label style={labelStyle}>
                      <Globe size={13} /> Base Endpoint URL:
                    </label>
                    <input
                      type="text"
                      value={editingProvider.baseUrl || ''}
                      onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                      placeholder="e.g. http://localhost:11434"
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* API Key (for cloud providers) */}
                {editingProvider.type !== 'ollama' && (
                  <div>
                    <label style={labelStyle}>
                      <Key size={13} /> API Key (Encrypted securely):
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={editingProvider.apiKey || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                        placeholder={`Enter your ${editingProvider.name} API Key...`}
                        style={{ ...inputStyle, paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-ink-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Model Selector */}
                <div>
                  <label style={labelStyle}>
                    <Cpu size={13} /> Selected Model:
                  </label>
                  <select
                    value={editingProvider.selectedModel}
                    onChange={(e) => setEditingProvider({ ...editingProvider, selectedModel: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {editingProvider.availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add Custom Model */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Add custom model identifier (e.g. deepseek-v3)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={handleAddModel}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-surface-card)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-ink-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Add Model
                  </button>
                </div>

                {/* Test Result Alert */}
                {testStatus && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: testStatus.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${testStatus.ok ? 'var(--color-success)' : 'var(--color-error)'}`,
                      color: testStatus.ok ? 'var(--color-success)' : 'var(--color-error)'
                    }}
                  >
                    {testStatus.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{testStatus.testing ? 'Testing connection...' : testStatus.message}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus?.testing}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-card)',
                      color: 'var(--color-ink-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Activity size={14} />
                    <span>Test Connection</span>
                  </button>

                  <button
                    onClick={handleSave}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--color-accent-amber)',
                      color: '#1C1405',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--color-ink-muted)', textAlign: 'center', marginTop: '40px' }}>
                Select a provider from the list to edit settings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-ink-secondary)',
  marginBottom: '4px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface-card)',
  color: 'var(--color-ink-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box'
};
