import { useState, useEffect } from 'react';
import { getCfgValue, setCfgValue } from '../lib/storage';
import GradientText from './reactbits/GradientText';

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

  const glassStyle = {
    background: 'rgba(16, 16, 20, 0.65)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[95vh]"
        style={glassStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <GradientText
            className="text-sm font-semibold"
            colors={['#7c5cfc', '#00ffd1', '#ff5c7a', '#7c5cfc']}
            animationSpeed={6}
          >
            Settings
          </GradientText>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 overflow-y-auto">
          <Field label="API Endpoint" tip="Base URL of your gateway">
            <input value={endpoint} onChange={e => { setEndpoint(e.target.value); save('endpoint', e.target.value); }}
              placeholder="https://xxx.execute-api.region.amazonaws.com/v1"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
          </Field>
          <Field label="API Key" tip="Secret key for auth. Sent as Bearer token.">
            <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); save('apikey', e.target.value); }}
              placeholder="Your API key"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
          </Field>
          <Field label="System Prompt" tip="Instructions at the start of every chat.">
            <textarea value={system} onChange={e => { setSystem(e.target.value); save('system', e.target.value); }}
              rows={2} placeholder="You are a helpful assistant."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 resize-none leading-relaxed text-zinc-200 focus:ring-1 focus:ring-accent/50"
              style={inputStyle} />
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

          {/* Danger zone */}
          <div className="pt-3 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-300">Delete all chats</div>
                <div className="text-xs text-zinc-600 mt-0.5">Permanently remove all conversations</div>
              </div>
              <button
                onClick={onDeleteAll}
                className="px-4 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 transition font-medium cursor-pointer"
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.15)'; }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-between items-center shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded-xl transition font-medium text-zinc-500 hover:text-zinc-200 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="text-sm px-5 py-1.5 rounded-xl transition font-medium text-white cursor-pointer"
            style={{ background: 'rgba(124,92,252,0.8)', border: '1px solid rgba(124,92,252,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,92,252,1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,92,252,0.8)'}
          >
            Done
          </button>
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
            <span
              className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-zinc-600 text-[9px] cursor-default"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >?</span>
            <span
              className="hidden group-hover:block absolute left-1/2 top-full mt-1.5 -translate-x-1/2 text-zinc-400 text-[11.5px] leading-relaxed p-2 rounded-lg w-[220px] z-50 shadow-lg shadow-black/50 pointer-events-none"
              style={{ background: 'rgba(16,16,20,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}
            >{tip}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
