import { useState, useEffect, useRef } from 'react';
import { getSettings, getSetting, updateSettings, onSettingsChange } from '../lib/settings';
import { fetchModels } from '../lib/stream';
import { saveUserSettings } from '../lib/api';

export default function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState(getSetting('selectedModel') || '');
  const ref = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    return onSettingsChange(s => {
      if (s.selectedModel !== current) setCurrent(s.selectedModel || '');
    });
  }, [current]);

  useEffect(() => {
    if (fetchedRef.current) return;
    const s = getSettings();
    if (!s.endpoint || !s.apiKey) return;
    fetchedRef.current = true;
    fetchModels(s.endpoint, s.apiKey).then(m => {
      setModels(m);
      if (!getSetting('selectedModel') && m.length) {
        const def = m.find(x => x.includes('claude')) || m[0];
        updateSettings({ selectedModel: def });
        setCurrent(def);
      }
    }).catch(() => { fetchedRef.current = false; });
  });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = models.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  const select = (id) => {
    updateSettings({ selectedModel: id });
    setCurrent(id);
    setOpen(false);
    const s = getSettings();
    saveUserSettings({
      endpoint: s.endpoint,
      apiKey: s.apiKey,
      systemPrompt: s.systemPrompt,
      maxTokens: s.maxTokens,
      temperature: s.temperature,
      selectedModel: id,
    }).catch(() => {});
  };

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
        <span className="text-zinc-300 truncate">{current || 'Select model'}</span>
        <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[340px] max-w-[90vw] rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          style={{ background: 'rgba(16, 16, 20, 0.7)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="p-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-600 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 && <div className="p-4 text-center text-sm text-zinc-600">No models found</div>}
            {filtered.map(id => (
              <div key={id} onClick={() => select(id)}
                className="px-3.5 py-2.5 cursor-pointer transition text-[13px]"
                style={{ background: id === current ? 'rgba(124,92,252,0.1)' : 'transparent' }}
                onMouseEnter={e => { if (id !== current) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = id === current ? 'rgba(124,92,252,0.1)' : 'transparent'; }}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${id === current ? 'text-accent font-medium' : 'text-zinc-300'}`}>{id}</span>
                  {id === current && <span className="text-accent text-xs shrink-0">✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
