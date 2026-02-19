import { useState, useEffect, useRef } from 'react';
import { getCfgValue, setCfgValue } from '../lib/storage';
import { fetchModels, getConfig } from '../lib/stream';

export default function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState(getCfgValue('model') || 'global.anthropic.claude-opus-4-6-v1');
  const ref = useRef(null);

  useEffect(() => {
    const { endpoint, apiKey } = getConfig();
    if (endpoint && apiKey) {
      fetchModels(endpoint, apiKey).then(m => {
        setModels(m);
        if (!getCfgValue('model') && m.length) {
          const def = m.find(x => x.includes('opus-4-6')) || m.find(x => x.includes('claude')) || m[0];
          setCfgValue('model', def);
          setCurrent(def);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = models.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  const select = (id) => {
    setCfgValue('model', id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border hover:border-border-light hover:bg-surface-2 transition text-sm max-w-[70vw]">
        <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span className="text-zinc-300 truncate">{current || 'Select model'}</span>
        <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[340px] max-w-[90vw] bg-surface-2 border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="p-2.5 border-b border-border">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." autoFocus
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition placeholder:text-zinc-600" />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 && <div className="p-4 text-center text-sm text-zinc-600">No models found</div>}
            {filtered.map(id => (
              <div key={id} onClick={() => select(id)}
                className={`px-3.5 py-2.5 cursor-pointer transition text-[13px] hover:bg-surface-3 ${id === current ? 'bg-surface-3' : ''}`}>
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
