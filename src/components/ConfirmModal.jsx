export default function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/60 p-6">
        <h3 className="text-[15px] font-semibold mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-3 transition cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-500 text-white transition font-medium cursor-pointer">{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
