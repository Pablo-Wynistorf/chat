import { useState, useEffect, useCallback } from 'react';

let toastId = 0;
let addToastFn = null;

export function showToast(message, type = 'success') {
  if (addToastFn) addToastFn({ id: ++toastId, message, type });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  addToastFn = useCallback((toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, toast.type === 'error' ? 6000 : 2500);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none max-w-[90vw]">
      {toasts.map(t => (
        <div key={t.id} className={`fade-in flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl shadow-black/40 text-sm pointer-events-auto ${
          t.type === 'error' ? 'bg-red-950/80 border border-red-800/40 text-red-200' : 'bg-surface-3 border border-border-light text-zinc-200'
        }`}>
          {t.type === 'success' && (
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span className="break-words">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
