import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../lib/settings';
import { saveUserSettings } from '../lib/api';
import { getUserInfo } from '../lib/auth';
import GradientText from './reactbits/GradientText';

export default function Settings({ open, onClose, onDeleteAll, onLogout }) {
  const [system, setSystem] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temp, setTemp] = useState(1);
  const [userInfo, setUserInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [mcpServers, setMcpServers] = useState([]);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    if (!open) return;
    const s = getSettings();
    setSystem(s.systemPrompt || '');
    setMaxTokens(s.maxTokens || 4096);
    setTemp(s.temperature ?? 1);
    setMcpServers(s.mcpServers || []);
    setProviders(s.providers || []);
    getUserInfo().then(setUserInfo).catch(() => {});
  }, [open]);

  const save = (partial) => {
    updateSettings(partial);
    clearTimeout(window.__settingsSyncTimer);
    window.__settingsSyncTimer = setTimeout(() => {
      const s = getSettings();
      saveUserSettings({
        providers: JSON.stringify(s.providers || []),
        selectedProvider: s.selectedProvider || '',
        systemPrompt: s.systemPrompt,
        maxTokens: s.maxTokens,
        temperature: s.temperature,
        selectedModel: s.selectedModel,
        mcpServers: JSON.stringify(s.mcpServers || []),
      }).catch(() => {});
    }, 1000);
  };

  if (!open) return null;

  const glassStyle = {
    background: 'rgba(16, 16, 20, 0.75)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: profileIcon },
    { id: 'providers', label: 'Providers', icon: apiIcon },
    { id: 'mcp', label: 'MCP', icon: mcpIcon },
    { id: 'chat', label: 'Chat', icon: chatIcon },
    { id: 'danger', label: 'Danger Zone', icon: dangerIcon },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 inset-2 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[94vw] sm:max-w-lg rounded-2xl shadow-2xl shadow-black/60 flex flex-col sm:max-h-[90vh]"
        style={glassStyle}
      >
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <GradientText className="text-sm font-semibold" colors={['#7c5cfc', '#00ffd1', '#ff5c7a', '#7c5cfc']} animationSpeed={6}>
            Settings
          </GradientText>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === t.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={{
                background: activeTab === t.id ? 'rgba(124,92,252,0.15)' : 'transparent',
                border: activeTab === t.id ? '1px solid rgba(124,92,252,0.2)' : '1px solid transparent',
              }}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'profile' && <ProfileTab userInfo={userInfo} onLogout={onLogout} />}
          {activeTab === 'providers' && (
            <ProvidersTab providers={providers} setProviders={setProviders} save={save} inputStyle={inputStyle} />
          )}
          {activeTab === 'mcp' && (
            <McpTab mcpServers={mcpServers} setMcpServers={setMcpServers} save={save} inputStyle={inputStyle} />
          )}
          {activeTab === 'chat' && (
            <ChatTab system={system} setSystem={setSystem} maxTokens={maxTokens} setMaxTokens={setMaxTokens} temp={temp} setTemp={setTemp} save={save} inputStyle={inputStyle} />
          )}
          {activeTab === 'danger' && <DangerTab onDeleteAll={onDeleteAll} onLogout={onLogout} />}
        </div>
      </div>
    </>
  );
}

function ProvidersTab({ providers, setProviders, save, inputStyle }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(null); // provider id that was just saved

  const resetForm = () => { setName(''); setEndpoint(''); setApiKey(''); setAdding(false); setEditId(null); };

  const saveProvider = () => {
    if (!endpoint.trim() || !apiKey.trim()) return;
    let updated;
    if (editId) {
      updated = providers.map(p => p.id === editId ? { ...p, name: name.trim() || guessName(endpoint), endpoint: endpoint.trim(), apiKey: apiKey.trim() } : p);
    } else {
      const newP = { id: crypto.randomUUID(), name: name.trim() || guessName(endpoint), endpoint: endpoint.trim(), apiKey: apiKey.trim() };
      updated = [...providers, newP];
    }
    setProviders(updated);
    save({ providers: updated });
    setSaved(editId || updated[updated.length - 1].id);
    setTimeout(() => setSaved(null), 2000);
    resetForm();
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setName(p.name);
    setEndpoint(p.endpoint);
    setApiKey(p.apiKey);
    setAdding(true);
  };

  const removeProvider = (id) => {
    const updated = providers.filter(p => p.id !== id);
    setProviders(updated);
    save({ providers: updated });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-300">API Providers</div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="text-xs text-accent hover:text-accent-hover transition cursor-pointer px-2 py-1 rounded-lg"
            style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.2)' }}>
            + Add Provider
          </button>
        )}
      </div>

      {providers.length === 0 && !adding && (
        <p className="text-xs text-zinc-600 py-4 text-center">No providers configured. Add one to get started.</p>
      )}

      {providers.map(p => (
        <div key={p.id} className="rounded-xl p-3" style={{
          background: saved === p.id ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
          border: saved === p.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)',
          transition: 'all 0.3s',
        }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-200 truncate">{p.name}</div>
              <div className="text-[11px] text-zinc-600 truncate font-mono">{p.endpoint}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => startEdit(p)}
                className="text-zinc-600 hover:text-zinc-300 transition cursor-pointer p-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              </button>
              <button onClick={() => removeProvider(p.id)}
                className="text-zinc-600 hover:text-red-400 transition cursor-pointer p-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(124,92,252,0.04)', border: '1px solid rgba(124,92,252,0.15)' }}>
          <Field label="Display Name" tip="A friendly name shown in the model picker.">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Anthropic Production"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
          </Field>
          <Field label="API Endpoint" tip="Supports OpenAI, Anthropic, Google Gemini, xAI, and any OpenAI-compatible API.">
            <input value={endpoint} onChange={e => setEndpoint(e.target.value)}
              placeholder="https://api.anthropic.com/v1"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
          </Field>
          <Field label="API Key" tip="Secret key for this provider.">
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="Your API key"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={resetForm}
              className="flex-1 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={saveProvider}
              className="flex-1 py-2 rounded-xl text-xs text-white transition cursor-pointer"
              style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}>
              {editId ? 'Save Changes' : 'Add Provider'}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Add multiple providers to access all your models in one place. The backend auto-detects the provider format from the endpoint URL.
      </p>
    </div>
  );
}

function guessName(endpoint) {
  const lower = endpoint.toLowerCase();
  if (lower.includes('anthropic')) return 'Anthropic';
  if (lower.includes('openai.com')) return 'OpenAI';
  if (lower.includes('googleapis') || lower.includes('gemini')) return 'Google Gemini';
  if (lower.includes('x.ai') || lower.includes('grok')) return 'xAI';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('mistral')) return 'Mistral';
  if (lower.includes('groq')) return 'Groq';
  try { return new URL(endpoint).hostname; } catch { return 'Provider'; }
}

function ProfileTab({ userInfo, onLogout }) {
  const initial = (userInfo?.name || userInfo?.email || '?')[0].toUpperCase();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.6), rgba(0,255,209,0.4))' }}>
          {initial}
        </div>
        <div className="min-w-0">
          {userInfo?.name && <div className="text-sm font-medium text-zinc-200 truncate">{userInfo.name}</div>}
          {userInfo?.email && <div className="text-xs text-zinc-500 truncate">{userInfo.email}</div>}
          {!userInfo && <div className="text-xs text-zinc-600">Loading profile...</div>}
        </div>
      </div>
      {userInfo && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <InfoRow label="Provider" value={userInfo.provider} />
          <InfoRow label="User ID" value={userInfo.sub} mono />
          {userInfo.email && <InfoRow label="Email" value={userInfo.email} />}
        </div>
      )}
      {onLogout && (
        <button onClick={onLogout}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 transition cursor-pointer"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
          Sign Out
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-zinc-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-xs text-zinc-400 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function McpTab({ mcpServers, setMcpServers, save, inputStyle }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderVal, setNewHeaderVal] = useState('');
  const [newHeaders, setNewHeaders] = useState({});
  const [showAuth, setShowAuth] = useState(false);

  const addServer = () => {
    if (!newUrl.trim()) return;
    const server = {
      id: crypto.randomUUID(),
      name: newName.trim() || new URL(newUrl.trim()).hostname,
      url: newUrl.trim(),
      headers: Object.keys(newHeaders).length > 0 ? { ...newHeaders } : {},
      enabled: true,
    };
    const updated = [...mcpServers, server];
    setMcpServers(updated);
    save({ mcpServers: updated });
    setNewName(''); setNewUrl(''); setNewHeaders({}); setNewHeaderKey(''); setNewHeaderVal(''); setShowAuth(false); setAdding(false);
  };

  const addHeader = () => {
    if (!newHeaderKey.trim()) return;
    setNewHeaders({ ...newHeaders, [newHeaderKey.trim()]: newHeaderVal });
    setNewHeaderKey(''); setNewHeaderVal('');
  };

  const removeHeader = (key) => { const h = { ...newHeaders }; delete h[key]; setNewHeaders(h); };

  const toggleServer = (id) => {
    const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setMcpServers(updated); save({ mcpServers: updated });
  };

  const removeServer = (id) => {
    const updated = mcpServers.filter(s => s.id !== id);
    setMcpServers(updated); save({ mcpServers: updated });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-300">MCP Servers</div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="text-xs text-accent hover:text-accent-hover transition cursor-pointer px-2 py-1 rounded-lg"
            style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.2)' }}>
            + Add Server
          </button>
        )}
      </div>
      {mcpServers.length === 0 && !adding && (
        <p className="text-xs text-zinc-600 py-4 text-center">No MCP servers configured.</p>
      )}
      {mcpServers.map(s => (
        <div key={s.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-200 truncate">{s.name}</div>
              <div className="text-[11px] text-zinc-600 truncate font-mono">{s.url}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => toggleServer(s.id)}
                className={`w-9 h-5 rounded-full transition cursor-pointer relative ${s.enabled ? 'bg-accent' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.enabled ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <button onClick={() => removeServer(s.id)} className="text-zinc-600 hover:text-red-400 transition cursor-pointer p-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      ))}
      {adding && (
        <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(124,92,252,0.04)', border: '1px solid rgba(124,92,252,0.15)' }}>
          <Field label="Server Name"><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. My Tools" className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50" style={inputStyle} /></Field>
          <Field label="Server URL"><input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50" style={inputStyle} /></Field>
          <button onClick={() => setShowAuth(!showAuth)} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer flex items-center gap-1">
            <svg className={`w-3 h-3 transition-transform ${showAuth ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M9 5l7 7-7 7" /></svg>
            Auth Headers (optional)
          </button>
          {showAuth && (
            <div className="space-y-2 pl-2">
              {Object.entries(newHeaders).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 font-mono truncate">{k}:</span>
                  <span className="text-zinc-600 font-mono truncate flex-1">{v.slice(0, 20)}...</span>
                  <button onClick={() => removeHeader(k)} className="text-zinc-600 hover:text-red-400 cursor-pointer text-[10px]">✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newHeaderKey} onChange={e => setNewHeaderKey(e.target.value)} placeholder="Header name" className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none text-zinc-200 placeholder:text-zinc-700 focus:ring-1 focus:ring-accent/50" style={inputStyle} />
                <input value={newHeaderVal} onChange={e => setNewHeaderVal(e.target.value)} placeholder="Value" type="password" className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none text-zinc-200 placeholder:text-zinc-700 focus:ring-1 focus:ring-accent/50" style={inputStyle} />
                <button onClick={addHeader} className="text-xs text-accent hover:text-accent-hover cursor-pointer px-2 py-1 rounded-lg shrink-0" style={{ background: 'rgba(124,92,252,0.1)' }}>Add</button>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAdding(false); setNewName(''); setNewUrl(''); setNewHeaders({}); setShowAuth(false); }}
              className="flex-1 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
            <button onClick={addServer}
              className="flex-1 py-2 rounded-xl text-xs text-white transition cursor-pointer"
              style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}>Add Server</button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-zinc-600 leading-relaxed">MCP servers extend the AI with external tools. Only enabled servers are sent with each request.</p>
    </div>
  );
}

function ChatTab({ system, setSystem, maxTokens, setMaxTokens, temp, setTemp, save, inputStyle }) {
  return (
    <div className="space-y-3">
      <Field label="System Prompt" tip="Instructions at the start of every chat.">
        <textarea value={system} onChange={e => { setSystem(e.target.value); save({ systemPrompt: e.target.value }); }}
          rows={3} placeholder="You are a helpful assistant."
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 resize-none leading-relaxed text-zinc-200 focus:ring-1 focus:ring-accent/50"
          style={inputStyle} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={<>Max Tokens <span className="text-zinc-500 font-normal text-xs">{maxTokens}</span></>} tip="Max response length.">
          <input type="range" min="256" max="65536" step="256" value={maxTokens}
            onChange={e => { const v = parseInt(e.target.value); setMaxTokens(v); save({ maxTokens: v }); }}
            className="w-full accent-accent" />
          <div className="flex justify-between text-[10px] text-zinc-600"><span>256</span><span>65k</span></div>
        </Field>
        <Field label={<>Temp <span className="text-zinc-500 font-normal text-xs">{temp}</span></>} tip="0 = precise, 1 = creative.">
          <input type="range" min="0" max="1" step="0.05" value={temp}
            onChange={e => { const v = parseFloat(e.target.value); setTemp(v); save({ temperature: v }); }}
            className="w-full accent-accent" />
          <div className="flex justify-between text-[10px] text-zinc-600"><span>Precise</span><span>Creative</span></div>
        </Field>
      </div>
    </div>
  );
}

function DangerTab({ onDeleteAll, onLogout }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-300">Delete all chats</div>
            <div className="text-xs text-zinc-600 mt-0.5">Permanently remove all conversations</div>
          </div>
          <button onClick={onDeleteAll}
            className="px-4 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 transition font-medium cursor-pointer"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>Delete All</button>
        </div>
      </div>
      {onLogout && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-300">Sign out</div>
              <div className="text-xs text-zinc-600 mt-0.5">End your current session</div>
            </div>
            <button onClick={onLogout}
              className="px-4 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 transition font-medium cursor-pointer"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>Sign Out</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, tip, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
        {label}
        {tip && (
          <span className="relative inline-flex group">
            <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-zinc-600 text-[9px] cursor-default"
              style={{ background: 'rgba(255,255,255,0.06)' }}>?</span>
            <span className="hidden group-hover:block absolute left-1/2 top-full mt-1.5 -translate-x-1/2 text-zinc-400 text-[11.5px] leading-relaxed p-2 rounded-lg w-[220px] z-50 shadow-lg shadow-black/50 pointer-events-none"
              style={{ background: 'rgba(16,16,20,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>{tip}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const profileIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>;
const apiIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>;
const mcpIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" /></svg>;
const chatIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
const dangerIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
