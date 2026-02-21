import { useState, useEffect, useRef } from 'react';
import { getSettings, getSetting, updateSettings, onSettingsChange } from '../lib/settings';
import { fetchModels } from '../lib/stream';
import { saveUserSettings } from '../lib/api';

export default function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [modelsByProvider, setModelsByProvider] = useState({}); // { providerId: { name, models: [] } }
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState(getSetting('selectedModel') || '');
  const [currentProvider, setCurrentProvider] = useState(getSetting('selectedProvider') || '');
  const ref = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    return onSettingsChange(s => {
      if (s.selectedModel !== current) setCurrent(s.selectedModel || '');
      if (s.selectedProvider !== currentProvider) setCurrentProvider(s.selectedProvider || '');
    });
  }, [current, currentProvider]);

  // Fetch models from all providers
  useEffect(() => {
    if (fetchedRef.current) return;
    const s = getSettings();
    const providers = s.providers || [];
    if (providers.length === 0) return;
    fetchedRef.current = true;

    const results = {};
    Promise.allSettled(
      providers.map(async (p) => {
        try {
          const models = await fetchModels(p.endpoint, p.apiKey);
          results[p.id] = { name: p.name, models };
        } catch {
          results[p.id] = { name: p.name, models: [] };
        }
      })
    ).then(() => {
      setModelsByProvider(results);
      // Auto-select first model if none selected
      if (!getSetting('selectedModel')) {
        for (const pid of Object.keys(results)) {
          if (results[pid].models.length > 0) {
            const model = results[pid].models[0];
            updateSettings({ selectedModel: model, selectedProvider: pid });
            setCurrent(model);
            setCurrentProvider(pid);
            break;
          }
        }
      }
    });
  });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build flat list for filtering
  const allModels = [];
  for (const [pid, data] of Object.entries(modelsByProvider)) {
    for (const model of data.models) {
      allModels.push({ pid, providerName: data.name, model });
    }
  }
  const filtered = allModels.filter(m =>
    m.model.toLowerCase().includes(search.toLowerCase()) ||
    m.providerName.toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered results by provider
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.pid]) grouped[item.pid] = { name: item.providerName, models: [] };
    grouped[item.pid].models.push(item.model);
  }

  const select = (pid, model) => {
    updateSettings({ selectedModel: model, selectedProvider: pid });
    setCurrent(model);
    setCurrentProvider(pid);
    setOpen(false);
    const s = getSettings();
    saveUserSettings({
      providers: JSON.stringify(s.providers || []),
      selectedProvider: pid,
      systemPrompt: s.systemPrompt,
      maxTokens: s.maxTokens,
      temperature: s.temperature,
      selectedModel: model,
      mcpServers: JSON.stringify(s.mcpServers || []),
    }).catch(() => {});
  };

  // Display name: "ProviderName / model-id"
  const currentProviderName = modelsByProvider[currentProvider]?.name || '';
  const displayName = current
    ? (currentProviderName ? `${currentProviderName} / ${current}` : current)
    : 'Select model';

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl transition text-sm max-w-[60vw] sm:max-w-[70vw]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
        <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span className="text-zinc-300 truncate">{displayName}</span>
        <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[380px] max-w-[90vw] rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          style={{ background: 'rgba(16, 16, 20, 0.7)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="p-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models or providers..." autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-600 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {Object.keys(grouped).length === 0 && (
              <div className="p-4 text-center text-sm text-zinc-600">
                {allModels.length === 0 ? 'No providers configured' : 'No models found'}
              </div>
            )}
            {Object.entries(grouped).map(([pid, data]) => (
              <div key={pid}>
                <div className="px-3.5 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider sticky top-0"
                  style={{ background: 'rgba(16,16,20,0.9)' }}>
                  {data.name}
                </div>
                {data.models.map(model => {
                  const isActive = model === current && pid === currentProvider;
                  return (
                    <div key={`${pid}-${model}`} onClick={() => select(pid, model)}
                      className="px-3.5 py-2 cursor-pointer transition text-[13px]"
                      style={{ background: isActive ? 'rgba(124,92,252,0.1)' : 'transparent' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(124,92,252,0.1)' : 'transparent'; }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate ${isActive ? 'text-accent font-medium' : 'text-zinc-300'}`}>{model}</span>
                        {isActive && <span className="text-accent text-xs shrink-0">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
