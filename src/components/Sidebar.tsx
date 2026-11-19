import {useState, type RefObject} from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  History,
  Moon,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Search,
  SquarePen,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type {Conversation} from '../types/chat';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  theme: 'light' | 'dark';
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onClearAll: () => void;
  onOpenHistory: () => void;
}

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOf7Days = startOfToday - 7 * 86_400_000;
  const startOf30Days = startOfToday - 30 * 86_400_000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfYesterday) return 'Yesterday';
  if (timestamp >= startOf7Days) return 'Previous 7 Days';
  if (timestamp >= startOf30Days) return 'Previous 30 Days';

  return new Date(timestamp).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

export function Sidebar({
  conversations,
  activeId,
  isOpen,
  theme,
  searchInputRef,
  onToggleTheme,
  onToggleSidebar,
  onCloseMobile,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onTogglePin,
  onToggleArchive,
  onDeleteChat,
  onClearAll,
  onOpenHistory,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pinned' | 'archived'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = conversations
    .filter((conv) => {
      if (filterMode === 'pinned') return Boolean(conv.pinned) && !conv.archived;
      if (filterMode === 'archived') return Boolean(conv.archived);
      if (!normalizedQuery && conv.archived) return false;
      if (!normalizedQuery) return true;
      if (conv.title.toLowerCase().includes(normalizedQuery)) return true;
      return conv.messages.some((m) => m.text.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const groups: Array<{label: string; items: Conversation[]}> = [];
  const pinnedItems = filtered.filter((c) => c.pinned && filterMode !== 'archived');
  if (pinnedItems.length > 0) {
    groups.push({label: 'Pinned', items: pinnedItems});
  }

  const remaining = filtered.filter((c) => !(c.pinned && filterMode !== 'archived'));
  const groupMap = new Map<string, Conversation[]>();
  for (const conv of remaining) {
    const label = getDateGroup(conv.updatedAt);
    const list = groupMap.get(label);
    if (list) {
      list.push(conv);
    } else {
      groupMap.set(label, [conv]);
    }
  }
  for (const [label, items] of groupMap.entries()) {
    groups.push({label, items});
  }

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitEditing = () => {
    if (editingId && editingTitle.trim()) {
      onRenameChat(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const hasPinned = conversations.some((c) => c.pinned && !c.archived);
  const hasArchived = conversations.some((c) => c.archived);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] shrink-0 flex-col border-r border-black/[0.06] bg-[#f9f9f9] transition-transform duration-200 ease-out dark:border-white/[0.08] dark:bg-[#0a0a0a] lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
        }`}
        aria-label="Conversation history"
      >
        {/* ChatGPT-style Sidebar Header: Brand + Collapse */}
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-2 font-display text-sm font-semibold tracking-tight text-[#0d0d0d] transition-colors hover:bg-[#ececec] whitespace-nowrap shrink-0 dark:text-[#f5f5f5] dark:hover:bg-[#1a1a1a]"
          >
            <img
              src="/assets/aistudio/a88fd0eb-38f8-44c1-9e03-66d496fdc0ca_624e8b59.png"
              alt="Flowr logo"
              referrerPolicy="no-referrer"
              className="h-6 w-6 rounded-md bg-black object-cover"
            />
            <span>Flowr</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#5d5d5d] transition-colors hover:bg-[#ececec] hover:text-[#0d0d0d] lg:inline-flex dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#ececec] hover:text-[#0d0d0d] lg:hidden dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ChatGPT-style Primary Sidebar Actions */}
        <div className="space-y-0.5 px-2 pb-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-[#0d0d0d] transition-colors hover:bg-[#ececec] focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:text-[#f5f5f5] dark:hover:bg-[#1a1a1a]"
          >
            <SquarePen className="h-4 w-4 shrink-0 text-[#0d0d0d] dark:text-[#f5f5f5]" />
            <span>New chat</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="flex h-10 w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-[#3d3d3d] transition-colors hover:bg-[#ececec] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:text-[#d4d4d4] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
          >
            <span className="inline-flex items-center gap-2.5">
              <History className="h-4 w-4 shrink-0 text-[#5d5d5d] dark:text-[#a3a3a3]" />
              <span>Chat history</span>
            </span>
            <span className="text-[11px] text-[#8f8f8f] tabular-nums dark:text-[#737373]">
              {conversations.length}
            </span>
          </button>

          {/* Search Input */}
          <div className="pt-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#8f8f8f] dark:text-[#737373]" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats (Ctrl+K)"
                aria-label="Search conversations"
                className="h-9 w-full rounded-lg border border-black/10 bg-white pr-3 pl-8 text-xs text-[#0d0d0d] placeholder:text-[#8f8f8f] focus:border-black/25 focus:outline-none dark:border-white/10 dark:bg-[#141414] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:focus:border-white/25"
              />
            </div>
          </div>

          {(hasPinned || hasArchived) && (
            <div className="flex items-center gap-1 pt-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === 'all'
                    ? 'bg-[#e3e3e3] text-[#0d0d0d] dark:bg-[#1f1f1f] dark:text-white'
                    : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]'
                }`}
              >
                Chats
              </button>
              {hasPinned && (
                <button
                  type="button"
                  onClick={() => setFilterMode('pinned')}
                  className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === 'pinned'
                      ? 'bg-[#e3e3e3] text-[#0d0d0d] dark:bg-[#1f1f1f] dark:text-white'
                      : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]'
                  }`}
                >
                  Pinned
                </button>
              )}
              {hasArchived && (
                <button
                  type="button"
                  onClick={() => setFilterMode('archived')}
                  className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === 'archived'
                      ? 'bg-[#e3e3e3] text-[#0d0d0d] dark:bg-[#1f1f1f] dark:text-white'
                      : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]'
                  }`}
                >
                  Archived
                </button>
              )}
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-[#8f8f8f] dark:text-[#737373]">
              {normalizedQuery
                ? 'No matching conversations found.'
                : filterMode === 'pinned'
                  ? 'No pinned conversations yet.'
                  : filterMode === 'archived'
                    ? 'No archived conversations.'
                    : 'Your chats will appear here.'}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-2.5 pb-1 text-[11px] font-medium text-[#8f8f8f] dark:text-[#737373]">
                    {group.label}
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map((conv) => {
                      const isActive = conv.id === activeId;
                      const isEditing = editingId === conv.id;

                      return (
                        <li key={conv.id} className="group relative">
                          {isEditing ? (
                            <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 ring-1 ring-black/25 dark:bg-[#1a1a1a] dark:ring-white/25">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEditing();
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#0d0d0d] focus:outline-none dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={commitEditing}
                                className="rounded p-1 text-[#10a37f] hover:bg-[#f4f4f4] dark:hover:bg-[#262626]"
                                aria-label="Save title"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`flex items-center justify-between gap-1 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-[#ececec] text-[#0d0d0d] dark:bg-[#1c1c1c] dark:text-white'
                                  : 'text-[#3d3d3d] hover:bg-[#ececec]/70 hover:text-[#0d0d0d] dark:text-[#d4d4d4] dark:hover:bg-[#151515] dark:hover:text-white'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectChat(conv.id);
                                  onCloseMobile();
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[13px] font-normal focus-visible:outline-2 focus-visible:outline-[#10a37f]"
                              >
                                {conv.pinned && (
                                  <Pin className="h-3 w-3 shrink-0 text-[#10a37f]" />
                                )}
                                <span className="truncate">{conv.title}</span>
                              </button>

                              <div
                                className={`flex shrink-0 items-center pr-1 transition-opacity ${
                                  isActive
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(conv.id);
                                  }}
                                  className="rounded p-1 text-[#5d5d5d] hover:bg-black/5 hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-white/10 dark:hover:text-white"
                                  aria-label={conv.pinned ? `Unpin ${conv.title}` : `Pin ${conv.title}`}
                                  title={conv.pinned ? 'Unpin' : 'Pin'}
                                >
                                  {conv.pinned ? (
                                    <PinOff className="h-3 w-3" />
                                  ) : (
                                    <Pin className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(conv);
                                  }}
                                  className="rounded p-1 text-[#5d5d5d] hover:bg-black/5 hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-white/10 dark:hover:text-white"
                                  aria-label={`Rename ${conv.title}`}
                                  title="Rename"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleArchive(conv.id);
                                  }}
                                  className="rounded p-1 text-[#5d5d5d] hover:bg-black/5 hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-white/10 dark:hover:text-white"
                                  aria-label={conv.archived ? `Restore ${conv.title}` : `Archive ${conv.title}`}
                                  title={conv.archived ? 'Restore' : 'Archive'}
                                >
                                  {conv.archived ? (
                                    <ArchiveRestore className="h-3 w-3" />
                                  ) : (
                                    <Archive className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(conv.id);
                                  }}
                                  className="rounded p-1 text-[#5d5d5d] hover:bg-red-100 hover:text-red-700 dark:text-[#a3a3a3] dark:hover:bg-red-950/60 dark:hover:text-red-400"
                                  aria-label={`Delete ${conv.title}`}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="border-t border-black/[0.06] p-2.5 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-[#3d3d3d] transition-colors hover:bg-[#ececec] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:text-[#f5f5f5] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Black mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light mode</span>
                </>
              )}
            </button>

            {conversations.length > 0 && (
              <div>
                {confirmClear ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAll();
                        setConfirmClear(false);
                      }}
                      className="h-8 rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap shrink-0"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="h-8 rounded-md px-2 text-xs font-medium text-[#5d5d5d] hover:bg-[#ececec] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#ececec] hover:text-red-600 whitespace-nowrap shrink-0 dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
