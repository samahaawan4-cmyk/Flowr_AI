import {useRef, useState} from 'react';
import {
  Archive,
  ArchiveRestore,
  Download,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {Conversation} from '../types/chat';

interface HistoryModalProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  onSelectChat: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onImportHistory: (imported: Conversation[]) => void;
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPreviewSnippet(conv: Conversation): string {
  const last = [...conv.messages].reverse().find((m) => m.text.trim().length > 0);
  if (!last) return 'Empty conversation';
  const cleaned = last.text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
}

export function HistoryModal({
  isOpen,
  conversations,
  activeId,
  onClose,
  onSelectChat,
  onTogglePin,
  onToggleArchive,
  onDeleteChat,
  onImportHistory,
}: HistoryModalProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'pinned' | 'archived'>('all');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = conversations
    .filter((conv) => {
      if (tab === 'pinned' && !conv.pinned) return false;
      if (tab === 'archived' && !conv.archived) return false;
      if (!normalizedQuery) return true;
      if (conv.title.toLowerCase().includes(normalizedQuery)) return true;
      return conv.messages.some((m) => m.text.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleExportAll = () => {
    const payload = {
      app: 'Flowr',
      exportedAt: new Date().toISOString(),
      conversations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowr-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.conversations)
          ? parsed.conversations
          : [];
      const valid = list.filter(
        (item): item is Conversation =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof (item as Conversation).id === 'string' &&
              typeof (item as Conversation).title === 'string' &&
              Array.isArray((item as Conversation).messages),
          ),
      );
      if (valid.length === 0) {
        setImportStatus('No valid conversations found in that JSON file.');
        return;
      }
      onImportHistory(valid);
      setImportStatus(`Imported ${valid.length} conversation${valid.length === 1 ? '' : 's'}.`);
    } catch {
      setImportStatus('Could not parse backup file. Please choose a valid Flowr JSON export.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-history-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/15 dark:bg-[#121212]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-4 dark:border-white/10">
          <div>
            <h2
              id="chat-history-title"
              className="font-display text-base font-semibold text-[#0d0d0d] dark:text-[#f5f5f5]"
            >
              Chat History
            </h2>
            <p className="mt-0.5 text-xs text-[#5d5d5d] tabular-nums dark:text-[#a3a3a3]">
              {conversations.length} saved conversation{conversations.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium text-[#0d0d0d] transition-colors hover:bg-[#f4f4f4] whitespace-nowrap shrink-0 dark:border-white/15 dark:bg-[#1a1a1a] dark:text-[#f5f5f5] dark:hover:bg-[#242424]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
            </button>
            {conversations.length > 0 && (
              <button
                type="button"
                onClick={handleExportAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium text-[#0d0d0d] transition-colors hover:bg-[#f4f4f4] whitespace-nowrap shrink-0 dark:border-white/15 dark:bg-[#1a1a1a] dark:text-[#f5f5f5] dark:hover:bg-[#242424]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Backup JSON</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#242424] dark:hover:text-white"
              aria-label="Close chat history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="space-y-3 border-b border-black/[0.06] px-6 py-3 dark:border-white/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8f8f8f] dark:text-[#737373]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across titles and past messages"
                aria-label="Search past conversations"
                className="h-9 w-full rounded-lg border border-black/10 bg-[#f9f9f9] pr-3 pl-8 text-xs text-[#0d0d0d] placeholder:text-[#8f8f8f] focus:border-black/25 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:focus:border-white/25"
              />
            </div>

            <div className="inline-flex items-center rounded-lg bg-[#f4f4f4] p-0.5 dark:bg-[#0a0a0a]">
              {(
                [
                  {id: 'all', label: 'All'},
                  {id: 'pinned', label: 'Pinned'},
                  {id: 'archived', label: 'Archived'},
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`h-8 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    tab === item.id
                      ? 'bg-white text-[#0d0d0d] shadow-xs dark:bg-[#242424] dark:text-white'
                      : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {importStatus && (
            <div className="flex items-center justify-between rounded-lg border border-black/10 bg-[#f9f9f9] px-3 py-2 text-xs text-[#3d3d3d] dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#d4d4d4]">
              <span>{importStatus}</span>
              <button
                type="button"
                onClick={() => setImportStatus(null)}
                className="font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-[#d1d1d1] dark:text-[#2a2a2a]" />
              <p className="mt-3 text-sm font-medium text-[#3d3d3d] dark:text-[#d4d4d4]">
                No conversations found
              </p>
              <p className="mt-1 text-xs text-[#5d5d5d] dark:text-[#a3a3a3]">
                {query
                  ? 'Try a different keyword or switch filters.'
                  : 'Your past conversations will appear here automatically.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {filtered.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <li
                    key={conv.id}
                    className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(conv.id);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-[#10a37f]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate font-display text-sm font-semibold ${
                            isActive
                              ? 'text-[#10a37f]'
                              : 'text-[#0d0d0d] hover:text-[#10a37f] dark:text-[#f5f5f5] dark:hover:text-[#10a37f]'
                          }`}
                        >
                          {conv.title}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5d5d5d] dark:text-[#a3a3a3]">
                        {getPreviewSnippet(conv)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8f8f8f] tabular-nums dark:text-[#737373]">
                        <span>{formatFullDate(conv.updatedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {conv.messages.length} message{conv.messages.length === 1 ? '' : 's'}
                        </span>
                        {conv.pinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Pinned</span>
                          </>
                        )}
                        {conv.archived && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Archived</span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onTogglePin(conv.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
                        aria-label={conv.pinned ? `Unpin ${conv.title}` : `Pin ${conv.title}`}
                        title={conv.pinned ? 'Unpin' : 'Pin'}
                      >
                        {conv.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleArchive(conv.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
                        aria-label={conv.archived ? `Restore ${conv.title}` : `Archive ${conv.title}`}
                        title={conv.archived ? 'Restore from archive' : 'Archive chat'}
                      >
                        {conv.archived ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteChat(conv.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-red-50 hover:text-red-600 dark:text-[#a3a3a3] dark:hover:bg-red-950/60 dark:hover:text-red-400"
                        aria-label={`Delete ${conv.title}`}
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
