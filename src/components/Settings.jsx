import { useState, useEffect } from 'react';
import { getCfgValue, setCfgValue } from '../lib/storage';

export default function Settings({ open, onClose, onDeleteAll }) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [system, setSystem] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temp, setTemp] = useState(1);

  useEffect(() => {
    setEndpoint(getCfgValue('endpoint'));
    setApiKey(getCfgValue('apikey'));
    setSystem(getCfgValue('system'));
    setMaxTokens(parseInt(getCfgValue('maxtokens')) || 4096);
    setTemp(parseFloat(getCfgValue('temp') || '1'));
  }, [open]);

  const save = (key, val) => { setCfgValue(key, val); };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <Field label="API Endpoint" tip="Base URL of your gateway">
            <input value={endpoint} onChange={e => { setEndpoint(e.target.value); save('endpoint', e.target.value); }}
              placeholder="https://xxx.execute-api.region.amazonaws.com/v1"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition placeholder:text-zinc-700" />
          </Field>
          <Field label="API Key" tip="Secret key for auth. Sent as Bearer token.">
            <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); save('apikey', e.target.value); }}
              placeholder="Your API key"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition placeholder:text-zinc-700" />
          </Field>
          <Field label="System Prompt" tip="Instructions at the start of every chat.">
            <textarea value={system} onChange={e => { setSystem(e.target.value); save('system', e.target.value); }}
              rows={2} placeholder="You are a helpful assistant."
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition placeholder:text-zinc-700 resize-none leading-relaxed" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={<>Max Tokens <span className="text-zinc-500 font-normal text-xs">{maxTokens}</span></>} tip="Max response length.">
              <input type="range" min="256" max="65536" step="256" value={maxTokens}
                onChange={e => { const v = parseInt(e.target.value); setMaxTokens(v); save('maxtokens', v); }}
                className="w-full accent-accent" />
              <div className="flex justify-between text-[10px] text-zinc-600"><span>256</span><span>65k</span></div>
            </Field>
            <Field label={<>Temp <span className="text-zinc-500 font-normal text-xs">{temp}</span></>} tip="0 = precise, 1 = creative.">
              <input type="range" min="0" max="1" step="0.05" value={temp}
                onChange={e => { const v = parseFloat(e.target.value); setTemp(v); save('temp', v); }}
                className="w-full accent-accent" />
              <div className="flex justify-between text-[10px] text-zinc-600"><span>Precise</span><span>Creative</span></div>
            </Field>
          </div>

          <div className="pt-3 mt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-300">Delete all chats</div>
                <div className="text-xs text-zinc-600 mt-0.5">Permanently remove all conversations</div>
              </div>
              <button onClick={onDeleteAll} className="px-4 py-2 rounded-xl text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300 border border-red-600/20 transition font-medium cursor-pointer">Delete All</button>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-between shrink-0">
          <button onClick={onClose} className="text-sm px-4 py-1.5 rounded-xl transition font-medium text-zinc-500 hover:text-zinc-200 hover:bg-surface-3 cursor-pointer">Close</button>
          <button onClick={onClose} className="bg-accent hover:bg-accent-hover text-sm px-5 py-1.5 rounded-xl transition font-medium text-white cursor-pointer">Done</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, tip, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
        {label}
        {tip && (
          <span className="relative inline-flex group">
            <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-surface-3 text-zinc-600 text-[9px] cursor-default">?</span>
            <span className="hidden group-hover:block absolute left-1/2 top-full mt-1.5 -translate-x-1/2 bg-surface-2 border border-border-light text-zinc-400 text-[11.5px] leading-relaxed p-2 rounded-lg w-[220px] z-50 shadow-lg shadow-black/50 pointer-events-none">{tip}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
