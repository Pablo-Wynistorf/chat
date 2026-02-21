import { useState, useRef, useEffect, useMemo } from 'react';
import { getSettings, onSettingsChange } from '../lib/settings';
import { countTokens, calculateCost, formatCost } from '../lib/pricing';

export default function InputBar({ onSend, onStop, streaming, centered, messages }) {
  const [animating, setAnimating] = useState(false);

  // When transitioning from centered to docked, trigger animation
  const prevCenteredRef = useRef(centered);
  useEffect(() => {
    if (prevCenteredRef.current && !centered) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 3000);
      return () => clearTimeout(timer);
    }
    prevCenteredRef.current = centered;
  }, [centered]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const barRef = useRef(null);

  // Token counting & cost estimation
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  useEffect(() => {
    const s = getSettings();
    setModel(s.selectedModel || '');
    setMaxTokens(s.maxTokens || 4096);
    return onSettingsChange(s => {
      setModel(s.selectedModel || '');
      setMaxTokens(s.maxTokens || 4096);
    });
  }, []);

  const tokenInfo = useMemo(() => {
    // Build the messages array including the current draft
    const msgs = [...(messages || [])];
    if (text.trim()) msgs.push({ role: 'user', content: text });
    if (msgs.length === 0) return null;
    const inputTokens = countTokens(msgs);
    const cost = calculateCost(inputTokens, maxTokens, model);
    return { inputTokens, cost };
  }, [messages, text, model, maxTokens]);

  const resize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  };

  // Ensure focus on mount and after transitions
  useEffect(() => {
    textareaRef.current?.focus();
  }, [centered, animating, streaming]);

  // Handle mobile virtual keyboard — adjust layout when keyboard appears
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // On mobile, when keyboard opens, visualViewport.height shrinks
      const keyboardOffset = window.innerHeight - vv.height;
      if (barRef.current) {
        barRef.current.style.paddingBottom = keyboardOffset > 50 ? `${keyboardOffset}px` : '';
      }
      // Scroll textarea into view
      if (keyboardOffset > 50) {
        requestAnimationFrame(() => textareaRef.current?.scrollIntoView({ block: 'nearest' }));
      }
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const compressImage = (dataUrl, maxDim = 1024, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const handleFiles = (fileList) => {
    for (const f of fileList) {
      const reader = new FileReader();
      if (f.type.startsWith('image/')) {
        reader.onload = async () => {
          const compressed = await compressImage(reader.result);
          setFiles(prev => [...prev, { name: f.name, content: compressed, type: 'image' }]);
        };
        reader.readAsDataURL(f);
      } else {
        reader.onload = () => setFiles(prev => [...prev, { name: f.name, content: reader.result, type: 'text' }]);
        reader.readAsText(f);
      }
    }
  };

  const send = () => {
    if (streaming) { onStop(); return; }
    const trimmed = text.trim();
    if (!trimmed && !files.length) return;
    onSend(trimmed, files);
    setText('');
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) { e.preventDefault(); handleFiles([item.getAsFile()]); }
    }
  };

  const fileAttachments = files.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) => (
        f.type === 'image' && f.content ? (
          <div key={i} className="relative group">
            <img src={f.content} alt={f.name} className="h-16 max-w-[120px] rounded-lg border border-border object-cover" />
            <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-3 border border-border text-zinc-500 hover:text-red-400 hover:border-red-400 text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100 touch-show">&times;</button>
          </div>
        ) : (
          <span key={i} className="inline-flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
            📄 {f.name}
            <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-zinc-600 hover:text-red-400 text-sm">&times;</button>
          </span>
        )
      ))}
    </div>
  );

  // The real interactive input bar — only rendered once, always owns the ref
  const inputContent = (
    <>
      {fileAttachments}
      <div className="flex items-end gap-1.5 sm:gap-2 bg-surface-2 border border-border rounded-2xl px-2.5 sm:px-3 py-2 sm:py-2.5 focus-within:border-accent/40 transition shadow-lg shadow-black/10">
        <label className="shrink-0 cursor-pointer p-1.5 rounded-xl hover:bg-surface-3 transition text-zinc-500 hover:text-zinc-300 touch-target">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
        </label>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={e => { setText(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask anything..."
          autoFocus
          className="flex-1 bg-transparent text-[15px] outline-none resize-none max-h-40 leading-relaxed placeholder:text-zinc-600 min-h-[36px] py-[7px]"
        />
        <button onClick={send}
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition text-white touch-target ${streaming ? 'bg-red-600 hover:bg-red-500' : 'bg-accent hover:bg-accent-hover'}`}>
          {streaming ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          ) : (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          )}
        </button>
      </div>
      {tokenInfo && (
        <div className="flex items-center justify-end gap-3 px-1 pt-1.5 text-[11px] text-zinc-600">
          <span>{tokenInfo.inputTokens.toLocaleString()} input tokens</span>
          {tokenInfo.cost && (
            <>
              <span>Input: {formatCost(tokenInfo.cost.inputCost)}</span>
              <span>Max output: {formatCost(tokenInfo.cost.maxOutputCost)}</span>
              <span className="text-zinc-500">Total: {formatCost(tokenInfo.cost.totalCost)}</span>
            </>
          )}
        </div>
      )}
    </>
  );

  // Decorative ghost for the slide animation — no refs, no interactivity
  const ghostContent = (
    <div className="flex items-end gap-1.5 sm:gap-2 bg-surface-2 border border-border rounded-2xl px-2.5 sm:px-3 py-2 sm:py-2.5 shadow-lg shadow-black/10" aria-hidden="true">
      <div className="shrink-0 p-1.5 rounded-xl text-zinc-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
      </div>
      <div className="flex-1 text-[15px] text-zinc-600 min-h-[36px] py-[7px]">Ask anything...</div>
      <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white bg-accent">
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </div>
    </div>
  );

  // Measure the docked bar's inner content position so we can animate to it precisely
  const dockedRef = useRef(null);
  const dockedInnerRef = useRef(null);
  const overlayInnerRef = useRef(null);

  // When animation starts, measure the docked target and set the overlay's end position via CSS custom properties
  useEffect(() => {
    if (animating && dockedInnerRef.current && overlayInnerRef.current) {
      requestAnimationFrame(() => {
        const docked = dockedInnerRef.current?.getBoundingClientRect();
        const overlay = overlayInnerRef.current?.getBoundingClientRect();
        if (docked && overlay) {
          const deltaY = docked.top - overlay.top;
          overlayInnerRef.current.style.transition = 'transform 3s cubic-bezier(0.22, 1, 0.36, 1)';
          overlayInnerRef.current.style.transform = `translateY(${deltaY}px)`;
        }
      });
    }
  }, [animating]);

  if (centered) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div className="px-3 py-3 sm:p-4" style={{ width: '100%', pointerEvents: 'auto' }}>
          <div className="max-w-[740px] mx-auto">
            {inputContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating overlay that animates from center to docked position */}
      {animating && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            ref={overlayInnerRef}
            className="px-3 py-3 sm:p-4"
            style={{ width: '100%', transform: 'translateY(0)' }}
          >
            <div className="max-w-[740px] mx-auto">
              {ghostContent}
            </div>
          </div>
        </div>
      )}
      <div
        ref={(el) => { dockedRef.current = el; barRef.current = el; }}
        className="shrink-0 relative z-10"
        style={{
          background: 'rgba(12,12,14,0.6)',
          backdropFilter: 'blur(16px)',
          opacity: animating ? 0 : 1,
        }}
      >
        <div ref={dockedInnerRef} className="px-3 py-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[740px] mx-auto">
            {inputContent}
          </div>
        </div>
      </div>
    </>
  );
}
