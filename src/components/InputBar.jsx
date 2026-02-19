import { useState, useRef } from 'react';

export default function InputBar({ onSend, onStop, streaming }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const resize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  };

  const handleFiles = (fileList) => {
    for (const f of fileList) {
      const reader = new FileReader();
      if (f.type.startsWith('image/')) {
        reader.onload = () => setFiles(prev => [...prev, { name: f.name, content: reader.result, type: 'image' }]);
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

  return (
    <div className="p-3 sm:p-4 shrink-0 relative z-10 backdrop-blur-xl" style={{ background: 'rgba(12,12,14,0.6)' }}>
      <div className="max-w-[740px] mx-auto">
        {files.length > 0 && (
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
        )}
        <div className="flex items-end gap-2 bg-surface-2 border border-border rounded-2xl px-3 py-2.5 focus-within:border-accent/40 transition shadow-lg shadow-black/10">
          <label className="shrink-0 cursor-pointer p-1.5 rounded-xl hover:bg-surface-3 transition text-zinc-500 hover:text-zinc-300">
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
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition text-white ${streaming ? 'bg-red-600 hover:bg-red-500' : 'bg-accent hover:bg-accent-hover'}`}>
            {streaming ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
