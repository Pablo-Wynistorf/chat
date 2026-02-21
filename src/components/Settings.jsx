import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../lib/settings';
import { saveUserSettings } from '../lib/api';
import { getUserInfo } from '../lib/auth';
import GradientText from './reactbits/GradientText';

export default function Settings({ open, onClose, onDeleteAll, onLogout }) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [system, setSystem] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temp, setTemp] = useState(1);
  const [userInfo, setUserInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (!open) return;
    const s = getSettings();
    setEndpoint(s.endpoint || '');
    setApiKey(s.apiKey || '');
    setSystem(s.systemPrompt || '');
    setMaxTokens(s.maxTokens || 4096);
    setTemp(s.temperature ?? 1);
    getUserInfo().then(setUserInfo).catch(() => {});
  }, [open]);

  const save = (partial) => {
    updateSettings(partial);
    clearTimeout(window.__settingsSyncTimer);
    window.__settingsSyncTimer = setTimeout(() => {
      const s = getSettings();
      saveUserSettings({
        endpoint: s.endpoint,
        apiKey: s.apiKey,
        systemPrompt: s.systemPrompt,
        maxTokens: s.maxTokens,
        temperature: s.temperature,
        selectedModel: s.selectedModel,
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
    { id: 'api', label: 'API', icon: apiIcon },
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
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-lg rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[90vh]"
        style={glassStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <GradientText className="text-sm font-semibold" colors={['#7c5cfc', '#00ffd1', '#ff5c7a', '#7c5cfc']} animationSpeed={6}>
            Settings
          </GradientText>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
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

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'profile' && (
            <ProfileTab userInfo={userInfo} onLogout={onLogout} />
          )}
          {activeTab === 'api' && (
            <ApiTab
              endpoint={endpoint} setEndpoint={setEndpoint}
              apiKey={apiKey} setApiKey={setApiKey}
              save={save} inputStyle={inputStyle}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              system={system} setSystem={setSystem}
              maxTokens={maxTokens} setMaxTokens={setMaxTokens}
              temp={temp} setTemp={setTemp}
              save={save} inputStyle={inputStyle}
            />
          )}
          {activeTab === 'danger' && (
            <DangerTab onDeleteAll={onDeleteAll} onLogout={onLogout} />
          )}
        </div>
      </div>
    </>
  );
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

function ApiTab({ endpoint, setEndpoint, apiKey, setApiKey, save, inputStyle }) {
  return (
    <div className="space-y-3">
      <Field label="API Endpoint" tip="Base URL of your AI provider. Requests are proxied through the backend.">
        <input value={endpoint} onChange={e => { setEndpoint(e.target.value); save({ endpoint: e.target.value }); }}
          placeholder="https://api.example.com/v1"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
          style={inputStyle} />
      </Field>
      <Field label="API Key" tip="Secret key for your AI provider. Stored in your account only.">
        <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); save({ apiKey: e.target.value }); }}
          placeholder="Your API key"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
          style={inputStyle} />
      </Field>
      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Your API credentials are stored securely in your account database. They are never exposed to the browser after saving.
      </p>
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
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
            Delete All
          </button>
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
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
              Sign Out
            </button>
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

// Tab icons
const profileIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>;
const apiIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>;
const chatIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
const dangerIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
