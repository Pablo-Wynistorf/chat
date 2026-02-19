import { useRef, useEffect, useState, useCallback } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { showToast } from './Toast';
import SplitText from './reactbits/SplitText';

// Track code blocks queued for copy when streaming finishes
const pendingCopyBlocks = new Set();

// Clipboard helper that works without user gesture (fallback for auto-copy)
function clipboardWrite(text) {
  if (navigator.clipboard && document.hasFocus()) {
    navigator.clipboard.writeText(text).catch(() => clipboardFallback(text));
  } else {
    clipboardFallback(text);
  }
}

function clipboardFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

function copyCodeFromBtn(btn) {
  const code = btn.closest('pre')?.querySelector('code');
  if (code) {
    clipboardWrite(code.textContent);
    showToast('Copied to clipboard');
    return true;
  }
  return false;
}

function handleCodeCopyClick(e, isStreaming) {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;

  const isIncomplete = btn.hasAttribute('data-incomplete');

  if (isStreaming && isIncomplete) {
    // Queue this block — mark it so we copy when the block completes
    const pre = btn.closest('pre');
    if (!pre) return;
    const blockId = 'pending-' + Math.random().toString(36).slice(2, 8);
    pre.setAttribute('data-pending-copy', blockId);
    pendingCopyBlocks.add(blockId);
    btn.textContent = 'Queued ✓';
    btn.style.color = '#7c5cfc';
    showToast('Will copy when code block is complete');
  } else {
    // Block is complete (or not streaming) — copy immediately
    copyCodeFromBtn(btn);
    btn.textContent = 'Copied!';
    btn.style.color = '#4ade80';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 1500);
  }
}

// Called when streaming ends — copies any queued blocks
function flushPendingCopies(containerEl) {
  if (!containerEl || pendingCopyBlocks.size === 0) return;
  containerEl.querySelectorAll('pre[data-pending-copy]').forEach(pre => {
    const id = pre.getAttribute('data-pending-copy');
    if (pendingCopyBlocks.has(id)) {
      const code = pre.querySelector('code');
      if (code) clipboardWrite(code.textContent);
      pre.removeAttribute('data-pending-copy');
      const btn = pre.querySelector('[data-copy]');
      if (btn) {
        btn.textContent = 'Copied!';
        btn.style.color = '#4ade80';
        setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 1500);
      }
    }
  });
  if (pendingCopyBlocks.size > 0) {
    showToast(`Copied ${pendingCopyBlocks.size} code block${pendingCopyBlocks.size > 1 ? 's' : ''}`);
  }
  pendingCopyBlocks.clear();
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-4 relative">
      <div className="relative z-10 flex flex-col items-center gap-4 px-8 py-10 rounded-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(12,12,14,0.85) 0%, rgba(12,12,14,0.5) 60%, transparent 100%)' }}>
        <div className="w-16 h-16 rounded-2xl bg-accent/20 backdrop-blur-sm flex items-center justify-center border border-accent/10">
          <svg className="w-9 h-9 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <div className="text-center">
          <SplitText
            text="How can I help?"
            className="text-zinc-200 text-lg font-semibold drop-shadow-lg"
            delay={50}
            animationFrom={{ opacity: 0, transform: 'translate3d(0,20px,0)' }}
            animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
            rootMargin="0px"
            threshold={0}
          />
          <p className="text-zinc-400 text-sm mt-1.5 drop-shadow-md">Ask anything or drop a file</p>
        </div>
      </div>
    </div>
  );
}

function Message({ msg, idx, streaming, onEditSave, onCopy, onRegenerate, onImageClick }) {
  const isUser = msg.role === 'user';
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef(null);

  const startEdit = () => {
    setEditText(msg.content);
    setEditing(true);
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.style.height = 'auto';
        editRef.current.style.height = editRef.current.scrollHeight + 'px';
        editRef.current.focus();
      }
    }, 0);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setEditing(false);
    onEditSave(idx, trimmed);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="message-row py-3 sm:py-4 fade-in group">
      <div className={`max-w-[740px] mx-auto px-4 sm:px-5 flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={isUser ? (editing ? 'max-w-[95%] sm:max-w-[85%]' : 'max-w-[85%] sm:max-w-[70%]') : 'max-w-[85%] sm:max-w-[80%] flex gap-3'}>
          {!isUser && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-surface-3 text-zinc-400 border border-border">AI</div>
          )}
          <div className="min-w-0">
            {msg.files?.length > 0 && (
              <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
                {msg.files.map((f, fi) => (
                  f.type === 'image' && f.content ? (
                    <img key={fi} src={f.content} alt={f.name} className="max-w-[200px] max-h-36 rounded-xl border border-border object-cover cursor-pointer hover:opacity-80 transition" onClick={() => onImageClick(f.content)} />
                  ) : f.type === 'image' ? (
                    <span key={fi} className="inline-flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
                      🖼 {f.name} <span className="text-zinc-600 text-[11px]">(image not stored)</span>
                    </span>
                  ) : (
                    <span key={fi} className="inline-flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
                      📄 {f.name}
                    </span>
                  )
                ))}
              </div>
            )}

            {isUser ? (
              editing ? (
                <div className="bg-surface-3 rounded-2xl rounded-br-md px-4 py-2.5">
                  <textarea
                    ref={editRef}
                    rows={1}
                    value={editText}
                    onChange={e => { setEditText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    onKeyDown={handleEditKeyDown}
                    className="w-full bg-transparent text-[14px] leading-[1.7] text-zinc-300 outline-none resize-none whitespace-pre-wrap overflow-x-auto"
                  />
                  <div className="flex gap-2 mt-1.5 justify-end">
                    <button onClick={cancelEdit} className="text-[11px] text-zinc-500 hover:text-zinc-300 px-3 py-1 rounded-lg hover:bg-surface-4 transition cursor-pointer">Cancel</button>
                    <button onClick={saveEdit} className="text-[11px] text-white bg-accent hover:bg-accent-hover px-3 py-1 rounded-lg transition cursor-pointer">Save & Send</button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-3 rounded-2xl rounded-br-md px-4 py-2.5">
                  <div className="text-[14px] leading-[1.7] break-words whitespace-pre-wrap text-zinc-300">{msg.content}</div>
                </div>
              )
            ) : (
              <div
                className="text-[14px] leading-[1.7] break-words md-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                onClick={(e) => handleCodeCopyClick(e, false)}
              />
            )}

            {!streaming && !editing && idx !== undefined && (
              <div className={`opacity-0 group-hover:opacity-100 touch-show transition-opacity mt-1.5 flex gap-1 ${isUser ? 'justify-end' : ''}`}>
                {isUser && (
                  <button onClick={startEdit} className="text-[11px] text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-surface-3 transition cursor-pointer">✎ Edit</button>
                )}
                {!isUser && (
                  <>
                    <button onClick={() => { onCopy(idx); showToast('Copied to clipboard'); }} className="text-[11px] text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-surface-3 transition cursor-pointer">⎘ Copy</button>
                    <button onClick={() => onRegenerate(idx)} className="text-[11px] text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-surface-3 transition cursor-pointer">↻ Regenerate</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamingMessage({ content, streamingRef }) {
  const contentRef = useRef(null);
  const renderedRef = useRef('');
  const timerRef = useRef(null);
  const pendingRef = useRef(content);
  const structureRef = useRef(''); // tracks structural shape to avoid full re-renders

  // Flush: render latest content to DOM with minimal updates
  const flush = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const text = pendingRef.current;
    if (text === renderedRef.current) return;

    const html = renderMarkdown(text, { isStreaming: true });

    // Parse new HTML into a temp container
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // Compute a structural signature: tag names + count of children
    // If structure hasn't changed, do a targeted update instead of full innerHTML
    const newChildren = wrapper.children;
    const structSig = Array.from(newChildren).map(c => c.tagName + (c.children.length || 0)).join(',');

    const existingChildren = el.querySelectorAll(':scope > :not(.cursor-blink)');
    const oldStructSig = structureRef.current;

    if (oldStructSig && structSig === oldStructSig && existingChildren.length === newChildren.length) {
      // Structure unchanged — do targeted update on changed nodes only
      for (let i = 0; i < newChildren.length; i++) {
        const newChild = newChildren[i];
        const oldChild = existingChildren[i];
        if (oldChild && newChild.innerHTML !== oldChild.innerHTML) {
          // For pre blocks, only update the code content, not the header
          if (newChild.tagName === 'PRE' && oldChild.tagName === 'PRE') {
            const newCode = newChild.querySelector('code');
            const oldCode = oldChild.querySelector('code');
            const newBtn = newChild.querySelector('[data-copy]');
            const oldBtn = oldChild.querySelector('[data-copy]');
            if (newCode && oldCode) {
              oldCode.innerHTML = newCode.innerHTML;
            }
            // Update button label if it changed (e.g. incomplete -> complete)
            if (newBtn && oldBtn) {
              const wasIncomplete = oldBtn.hasAttribute('data-incomplete');
              const nowIncomplete = newBtn.hasAttribute('data-incomplete');
              if (wasIncomplete && !nowIncomplete) {
                // Block just completed — check for pending copy
                const pre = oldChild;
                const pendingId = pre.getAttribute('data-pending-copy');
                if (pendingId && pendingCopyBlocks.has(pendingId)) {
                  const code = oldCode;
                  if (code) clipboardWrite(code.textContent);
                  pendingCopyBlocks.delete(pendingId);
                  pre.removeAttribute('data-pending-copy');
                  oldBtn.textContent = 'Copied!';
                  oldBtn.style.color = '#4ade80';
                  setTimeout(() => { oldBtn.textContent = 'Copy'; oldBtn.style.color = ''; }, 1500);
                  showToast('Code block copied');
                } else if (!pre.hasAttribute('data-pending-copy')) {
                  oldBtn.textContent = newBtn.textContent;
                  if (newBtn.hasAttribute('data-incomplete')) oldBtn.setAttribute('data-incomplete', '');
                  else oldBtn.removeAttribute('data-incomplete');
                }
              } else if (!oldBtn.textContent.includes('Queued') && !oldBtn.textContent.includes('Copied')) {
                oldBtn.textContent = newBtn.textContent;
                if (nowIncomplete) oldBtn.setAttribute('data-incomplete', '');
                else oldBtn.removeAttribute('data-incomplete');
              }
            }
          } else {
            oldChild.innerHTML = newChild.innerHTML;
          }
        }
      }
    } else {
      // Structure changed — full re-render needed
      // Save pending-copy states
      const savedStates = [];
      el.querySelectorAll('pre[data-pending-copy]').forEach(pre => {
        const id = pre.getAttribute('data-pending-copy');
        const btn = pre.querySelector('[data-copy]');
        const codeSnippet = pre.querySelector('code')?.textContent?.slice(0, 80) || '';
        if (id) savedStates.push({ id, codeSnippet, btnText: btn?.textContent, btnColor: btn?.style.color });
      });

      el.innerHTML = wrapper.innerHTML;

      // Restore pending-copy states
      if (savedStates.length > 0) {
        el.querySelectorAll('pre').forEach(pre => {
          const codeSnippet = pre.querySelector('code')?.textContent?.slice(0, 80) || '';
          const match = savedStates.find(s => codeSnippet.startsWith(s.codeSnippet.slice(0, 40)));
          if (match) {
            const btn = pre.querySelector('[data-copy]');
            const isNowComplete = !btn?.hasAttribute('data-incomplete');
            if (isNowComplete && pendingCopyBlocks.has(match.id)) {
              const code = pre.querySelector('code');
              if (code) clipboardWrite(code.textContent);
              pendingCopyBlocks.delete(match.id);
              if (btn) {
                btn.textContent = 'Copied!';
                btn.style.color = '#4ade80';
                setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 1500);
              }
              showToast('Code block copied');
            } else if (!isNowComplete) {
              pre.setAttribute('data-pending-copy', match.id);
              if (btn && match.btnText) { btn.textContent = match.btnText; btn.style.color = match.btnColor || ''; }
            }
          }
        });
      }
    }

    structureRef.current = structSig;

    // Ensure cursor blink exists at the end
    let cursor = el.querySelector('.cursor-blink');
    if (!cursor) {
      cursor = document.createElement('span');
      cursor.className = 'inline-block w-0.5 h-4 bg-accent cursor-blink align-text-bottom ml-px';
      el.appendChild(cursor);
    }

    renderedRef.current = text;
  }, []);

  // Continuously flush while content is changing, throttled to ~150ms
  useEffect(() => {
    pendingRef.current = content;

    const scheduleFlush = () => {
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
        // Keep scheduling if there's still unflushed content
        if (pendingRef.current !== renderedRef.current) {
          scheduleFlush();
        }
      }, 150);
    };

    scheduleFlush();
  }, [content, flush]);

  // Always flush on unmount (streaming ended) to show final state
  useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      flush();
    };
  }, [flush]);

  // Initial render
  useEffect(() => { flush(); }, [flush]);

  return (
    <div className="message-row py-3 sm:py-4 fade-in">
      <div className="max-w-[740px] mx-auto px-4 sm:px-5 flex gap-3 justify-start">
        <div className="max-w-[85%] sm:max-w-[80%] flex gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-surface-3 text-zinc-400 border border-border">AI</div>
          <div className="min-w-0" ref={streamingRef}>
            <div
              ref={contentRef}
              className="text-[14px] leading-[1.7] break-words md-content"
              onClick={(e) => handleCodeCopyClick(e, true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageArea({ chat, streaming, streamContent, continuing, onEditSave, onCopy, onRegenerate, onContinue, showContinue }) {
  const messagesRef = useRef(null);
  const streamingElRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const autoScrollRef = useRef(true);
  const wasStreamingRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!atBottom);
    // Only disable auto-scroll if user deliberately scrolled up during streaming
    if (streaming && !atBottom) autoScrollRef.current = false;
    // Re-enable if user scrolled back to bottom
    if (streaming && atBottom) autoScrollRef.current = true;
  }, [streaming]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  useEffect(() => {
    if (autoScrollRef.current && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [chat?.messages?.length, streamContent]);

  // Reset auto-scroll when chat changes or streaming starts
  useEffect(() => { autoScrollRef.current = true; }, [chat?.id]);
  useEffect(() => { if (streaming) autoScrollRef.current = true; }, [streaming]);

  // Flush pending copies when streaming ends
  useEffect(() => {
    if (wasStreamingRef.current && !streaming) {
      // Streaming just ended — flush any queued copy blocks from the now-finalized messages
      setTimeout(() => {
        if (messagesRef.current) flushPendingCopies(messagesRef.current);
      }, 100);
    }
    wasStreamingRef.current = streaming;
  }, [streaming]);

  const scrollToBottom = () => {
    autoScrollRef.current = true;
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  const messages = chat?.messages?.filter(m => m.role !== 'system') || [];

  // When continuing, hide the last assistant message (it's being replaced by the streaming view)
  const displayMessages = (streaming && continuing && messages.length > 0 && messages[messages.length - 1].role === 'assistant')
    ? messages.slice(0, -1)
    : messages;

  return (
    <div className="flex-1 relative min-h-0">
      <div ref={messagesRef} className="h-full overflow-y-auto scroll-smooth">
        {displayMessages.length === 0 && !streaming ? (
          <EmptyState />
        ) : (
          <>
            {displayMessages.map((msg, i) => (
              <Message key={i} msg={msg} idx={i} streaming={streaming} onEditSave={onEditSave} onCopy={onCopy} onRegenerate={onRegenerate} onImageClick={setLightboxSrc} />
            ))}
            {streaming && streamContent && <StreamingMessage content={streamContent} streamingRef={streamingElRef} />}
            {streaming && !streamContent && (
              <div className="message-row py-3 sm:py-4 fade-in">
                <div className="max-w-[740px] mx-auto px-4 sm:px-5 flex gap-3 justify-start">
                  <div className="max-w-[85%] sm:max-w-[80%] flex gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-surface-3 text-zinc-400 border border-border">AI</div>
                    <div className="flex items-center gap-1.5 py-2">
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showContinue && !streaming && (
              <div className="max-w-[740px] mx-auto px-4 sm:px-5 pb-2">
                <button onClick={onContinue}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border-light bg-surface-2 text-zinc-400 text-xs hover:border-accent hover:text-zinc-200 hover:bg-surface-3 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  Continue generating
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={scrollToBottom}
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface-3 border border-border-light text-zinc-400 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer shadow-lg shadow-black/40 transition-all hover:bg-surface-4 hover:text-zinc-200 hover:border-accent ${showScrollBtn ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
      </button>

      {lightboxSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Preview" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxSrc(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-3/80 border border-border text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition text-lg">&times;</button>
        </div>
      )}
    </div>
  );
}
