import SpotlightCard from './reactbits/SpotlightCard';

export default function Sidebar({ chats, activeChatId, onNewChat, onSelectChat, onDeleteChat, onOpenSettings, open, onClose }) {
  return (
    <>
      <aside className={`w-[260px] bg-surface border-r border-border flex flex-col shrink-0 h-full fixed sm:relative z-20 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}>
        <div className="p-4 flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
            <svg className="w-[18px] h-[18px] text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Chat.</span>
        </div>

        <div className="px-3 pb-2">
          <button onClick={onNewChat} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/15 transition text-sm font-medium cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14m-7-7h14" /></svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {chats.map(chat => (
            <SpotlightCard key={chat.id} className="rounded-xl" spotlightColor="rgba(124,92,252,0.08)">
              <div
                onClick={() => onSelectChat(chat.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition text-[13px] ${chat.id === activeChatId ? 'bg-surface-3 text-zinc-100' : 'text-zinc-500 hover:bg-surface-2 hover:text-zinc-300'}`}
              >
                <svg className={`w-4 h-4 shrink-0 ${chat.id === activeChatId ? 'text-accent' : 'text-zinc-600'}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="flex-1 truncate">{chat.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                  className="opacity-0 group-hover:opacity-100 touch-show w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-surface-4 transition shrink-0 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
            </SpotlightCard>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <button onClick={onOpenSettings} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 transition cursor-pointer">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-10 bg-black/40 sm:hidden" onClick={onClose} />}
    </>
  );
}
