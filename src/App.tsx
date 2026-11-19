import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowDown,
  Check,
  ChevronDown,
  Download,
  History,
  MessageSquare,
  Palette,
  PanelLeft,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
} from 'lucide-react';
import {BackgroundLayer} from './components/BackgroundLayer';
import {BackgroundModal} from './components/BackgroundModal';
import {Composer} from './components/Composer';
import {HistoryModal} from './components/HistoryModal';
import {MessageItem} from './components/MessageItem';
import {PersonaModal} from './components/PersonaModal';
import {Sidebar} from './components/Sidebar';
import {
  PERSONA_PRESETS,
  STARTER_PROMPTS,
  type Attachment,
  type ChatMessage,
  type Conversation,
  type GroundingSource,
  type StarterPrompt,
  type ThinkingDepth,
} from './types/chat';
import {
  loadBackgroundPrefs,
  loadBackgroundPrefsSync,
  loadConversationsFromHistory,
  loadLegacyConversationsSync,
  persistBackgroundPrefs,
  persistConversationsToHistory,
  type BackgroundPrefs,
} from './utils/storage';

const THEME_KEY = 'flowr_theme_v2';

const HERO_THOUGHTS: ReadonlyArray<{
  prefix: string;
  accent: string;
  subtitle: string;
}> = [
  {
    prefix: 'Where quiet ideas ',
    accent: 'bloom into clarity.',
    subtitle:
      'Think out loud, explore live web sources, write code, or drop in images and notes.',
  },
  {
    prefix: 'Bring a spark. ',
    accent: 'Flowr shapes the rest.',
    subtitle:
      'From instant answers to deep reasoning — a calm workspace crafted for clear thinking.',
  },
  {
    prefix: 'What shall we ',
    accent: 'create together today?',
    subtitle:
      'Draft, debug, research, or brainstorm in a space tuned for focus and momentum.',
  },
  {
    prefix: 'Every great answer starts ',
    accent: 'with a curious question.',
    subtitle:
      'Fast responses, grounded sources, and thoughtful explanations — ready whenever you are.',
  },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Quiet hours';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late night focus';
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolveSystemInstruction(personaId: string, customInstruction: string): string {
  const preset = PERSONA_PRESETS.find((p) => p.id === personaId);
  const base = preset?.systemInstruction || '';
  const extra = customInstruction.trim();
  if (personaId === 'custom') {
    return extra || PERSONA_PRESETS[0].systemInstruction;
  }
  if (base && extra) {
    return `${base}\n\nAdditional user instructions:\n${extra}`;
  }
  return base || extra || PERSONA_PRESETS[0].systemInstruction;
}

function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));

    if (isImage) {
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
        resolve({
          id: createId(),
          name: file.name,
          mimeType: file.type || 'image/png',
          size: file.size,
          kind: 'image',
          data: base64,
          previewUrl: result,
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const textContent = String(reader.result || '');
        resolve({
          id: createId(),
          name: file.name,
          mimeType: file.type || 'text/plain',
          size: file.size,
          kind: 'text',
          data: textContent.slice(0, 80_000),
        });
      };
      reader.readAsText(file);
    }
  });
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadLegacyConversationsSync(),
  );
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const loaded = loadLegacyConversationsSync();
    const firstActive = loaded.find((c) => !c.archived) ?? loaded[0];
    return firstActive ? firstActive.id : null;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore
    }
    return 'dark';
  });

  // Draft composer state (for new unsaved chats or current chat)
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draftPersonaId, setDraftPersonaId] = useState('general');
  const [draftCustomInstruction, setDraftCustomInstruction] = useState('');
  const [draftThinkingDepth, setDraftThinkingDepth] = useState<ThinkingDepth>('LOW');
  const [draftWebSearch, setDraftWebSearch] = useState(false);

  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [bgPrefs, setBgPrefs] = useState<BackgroundPrefs>(() => loadBackgroundPrefsSync());
  const [heroIndex, setHeroIndex] = useState<number>(() =>
    Math.floor(Math.random() * HERO_THOUGHTS.length),
  );
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const currentPersonaId = activeConversation ? activeConversation.personaId : draftPersonaId;
  const currentCustomInstruction = activeConversation
    ? activeConversation.customInstruction
    : draftCustomInstruction;
  const currentThinkingDepth = activeConversation
    ? activeConversation.thinkingDepth
    : draftThinkingDepth;
  const currentWebSearch = activeConversation
    ? Boolean(activeConversation.webSearch)
    : draftWebSearch;

  const isStreaming = streamingConvId !== null && streamingConvId === activeId;

  useEffect(() => {
    let cancelled = false;
    void loadConversationsFromHistory().then((loaded) => {
      if (cancelled) return;
      if (loaded.length > 0) {
        setConversations((prev) => {
          const merged = new Map<string, Conversation>();
          for (const c of loaded) merged.set(c.id, c);
          for (const c of prev) {
            const existing = merged.get(c.id);
            if (!existing || c.updatedAt >= existing.updatedAt) {
              merged.set(c.id, c);
            }
          }
          return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });
        setActiveId((prevId) => {
          if (prevId) return prevId;
          const firstActive = loaded.find((c) => !c.archived) ?? loaded[0];
          return firstActive ? firstActive.id : null;
        });
      }
      setHistoryHydrated(true);
    });
    void loadBackgroundPrefs().then((savedBg) => {
      if (!cancelled) {
        setBgPrefs(savedBg);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  useEffect(() => {
    if (!historyHydrated) return;
    void persistConversationsToHistory(conversations);
  }, [conversations, historyHydrated]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({top: el.scrollHeight, behavior});
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom('auto');
    }
  }, [activeConversation?.messages, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 100;
    shouldAutoScrollRef.current = nearBottom;
    setShowScrollDown(!nearBottom && el.scrollHeight > el.clientHeight + 120);
  };

  const handleBackgroundPrefsChange = useCallback((next: BackgroundPrefs) => {
    setBgPrefs(next);
    void persistBackgroundPrefs(next);
  }, []);

  const handleNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingConvId(null);
    }
    setActiveId(null);
    setInput('');
    setAttachments([]);
    setAttachmentNotice(null);
    setHeroIndex((idx) => (idx + 1) % HERO_THOUGHTS.length);
    shouldAutoScrollRef.current = true;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 40);
      } else if (
        (e.altKey && e.key.toLowerCase() === 'n') ||
        (mod && e.shiftKey && e.key.toLowerCase() === 'o')
      ) {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewChat]);

  useEffect(() => {
    if (!personaMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setPersonaMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPersonaMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [personaMenuOpen]);

  const handleSelectChat = (id: string) => {
    if (streamingConvId && streamingConvId !== id && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingConvId(null);
    }
    setActiveId(id);
    setAttachmentNotice(null);
    shouldAutoScrollRef.current = true;
  };

  const handleRenameChat = (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? {...c, title, updatedAt: Date.now()} : c)),
    );
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? {...c, pinned: !c.pinned} : c)),
    );
  };

  const handleToggleArchive = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? {...c, archived: !c.archived} : c)),
    );
  };

  const handleImportHistory = (imported: Conversation[]) => {
    setConversations((prev) => {
      const merged = new Map<string, Conversation>();
      for (const c of prev) merged.set(c.id, c);
      for (const c of imported) {
        const existing = merged.get(c.id);
        if (!existing || (c.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
          merged.set(c.id, c);
        }
      }
      return Array.from(merged.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    });
  };

  const handleDeleteChat = (id: string) => {
    if (streamingConvId === id && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingConvId(null);
    }
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingConvId(null);
    }
    setConversations([]);
    setActiveId(null);
  };

  const handleAddAttachments = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setAttachmentNotice(null);

    const added: Attachment[] = [];
    for (const file of list) {
      if (file.size > 10 * 1024 * 1024) {
        setAttachmentNotice(`${file.name} exceeds the 10 MB file limit.`);
        continue;
      }
      try {
        const att = await readFileAsAttachment(file);
        added.push(att);
      } catch {
        setAttachmentNotice(`Could not read ${file.name}.`);
      }
    }

    if (added.length > 0) {
      setAttachments((prev) => [...prev, ...added].slice(0, 6));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const updateActiveSettings = (
    personaId: string,
    customInstruction: string,
    thinkingDepth: ThinkingDepth,
  ) => {
    if (activeConversation) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                personaId,
                customInstruction,
                thinkingDepth,
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    } else {
      setDraftPersonaId(personaId);
      setDraftCustomInstruction(customInstruction);
      setDraftThinkingDepth(thinkingDepth);
    }
  };

  const handleToggleWebSearch = () => {
    if (activeConversation) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {...c, webSearch: !c.webSearch, updatedAt: Date.now()}
            : c,
        ),
      );
    } else {
      setDraftWebSearch((prev) => !prev);
    }
  };

  const generateAutoTitle = async (convId: string, firstPrompt: string) => {
    try {
      const res = await fetch('/api/title', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: firstPrompt}),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {title?: string};
      if (data.title) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? {...c, title: data.title!} : c)),
        );
      }
    } catch {
      // Non-critical enhancement
    }
  };

  const fetchFollowUps = async (
    convId: string,
    assistantMsgId: string,
    lastUserText: string,
    lastModelText: string,
  ) => {
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({lastUserText, lastModelText}),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {suggestions?: string[]};
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMsgId ? {...m, followUps: data.suggestions} : m,
              ),
            };
          }),
        );
      }
    } catch {
      // Non-critical enhancement
    }
  };

  const streamAssistantReply = async (
    convId: string,
    historyMessages: ChatMessage[],
    assistantMsgId: string,
    personaId: string,
    customInstruction: string,
    thinkingDepth: ThinkingDepth,
    webSearch: boolean,
    isFirstTurn: boolean,
    firstPromptText: string,
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStreamingConvId(convId);
    shouldAutoScrollRef.current = true;

    const payloadMessages = historyMessages.map((m) => ({
      role: m.role,
      text: m.text,
      attachments: m.attachments
        ?.filter((a) => a.data.length > 0)
        .map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          data: a.data,
          kind: a.kind,
        })),
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: payloadMessages,
          systemInstruction: resolveSystemInstruction(personaId, customInstruction),
          thinkingLevel: thinkingDepth,
          webSearch,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let errMessage = `Request failed (${response.status}).`;
        try {
          const errJson = (await response.json()) as {error?: string};
          if (errJson.error) errMessage = errJson.error;
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const {done, value} = await reader.read();
        if (done) {
          buffer += decoder.decode();
        } else {
          buffer += decoder.decode(value, {stream: true});
        }

        const events = buffer.split('\n\n');
        buffer = done ? '' : (events.pop() ?? '');

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr) as {
                type: 'delta' | 'sources' | 'done' | 'error';
                text?: string;
                sources?: GroundingSource[];
                message?: string;
              };

              if (parsed.type === 'delta' && parsed.text) {
                accumulatedText += parsed.text;
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c;
                    return {
                      ...c,
                      updatedAt: Date.now(),
                      messages: c.messages.map((m) =>
                        m.id === assistantMsgId ? {...m, text: accumulatedText} : m,
                      ),
                    };
                  }),
                );
              } else if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c;
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMsgId ? {...m, sources: parsed.sources} : m,
                      ),
                    };
                  }),
                );
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message || 'Model returned an error.');
              }
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                parseErr.message !== 'Unexpected end of JSON input'
              ) {
                throw parseErr;
              }
            }
          }
        }

        if (done) break;
      }

      if (!accumulatedText.trim()) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      error:
                        'The assistant returned an empty response. Please try rephrasing or resending.',
                    }
                  : m,
              ),
            };
          }),
        );
      } else {
        const lastUserText =
          [...historyMessages].reverse().find((m) => m.role === 'user')?.text ?? '';
        void fetchFollowUps(convId, assistantMsgId, lastUserText, accumulatedText);
      }

      if (isFirstTurn && firstPromptText.trim()) {
        void generateAutoTitle(convId, firstPromptText);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unable to reach the assistant right now.';
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          return {
            ...c,
            updatedAt: Date.now(),
            messages: c.messages.map((m) =>
              m.id === assistantMsgId ? {...m, error: message} : m,
            ),
          };
        }),
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setStreamingConvId((prev) => (prev === convId ? null : prev));
    }
  };

  const sendMessage = async (
    overridePrompt?: string,
    overrideStarter?: StarterPrompt,
  ) => {
    const text = (overridePrompt ?? input).trim();
    const pendingAttachments = overridePrompt ? [] : attachments;

    if (!text && pendingAttachments.length === 0) return;
    if (streamingConvId !== null) return;

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      text,
      createdAt: now,
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'model',
      text: '',
      createdAt: now + 1,
    };

    if (!overridePrompt) {
      setInput('');
      setAttachments([]);
      setAttachmentNotice(null);
    }

    if (activeConversation) {
      const convId = activeConversation.id;
      const updatedHistory = [...activeConversation.messages, userMessage];
      const isFirstTurn = activeConversation.messages.length === 0;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updatedAt: now,
                messages: [...updatedHistory, assistantMessage],
              }
            : c,
        ),
      );

      await streamAssistantReply(
        convId,
        updatedHistory,
        assistantMessage.id,
        activeConversation.personaId,
        activeConversation.customInstruction,
        activeConversation.thinkingDepth,
        Boolean(activeConversation.webSearch),
        isFirstTurn,
        text,
      );
    } else {
      const convId = createId();
      const personaId = overrideStarter?.personaId ?? draftPersonaId;
      const thinkingDepth = overrideStarter?.thinkingDepth ?? draftThinkingDepth;
      const webSearch = overrideStarter?.webSearch ?? draftWebSearch;
      const fallbackTitle = text
        ? text.slice(0, 42) + (text.length > 42 ? '…' : '')
        : pendingAttachments[0]?.name || 'New Conversation';

      const newConv: Conversation = {
        id: convId,
        title: fallbackTitle,
        createdAt: now,
        updatedAt: now,
        personaId,
        customInstruction: draftCustomInstruction,
        thinkingDepth,
        webSearch,
        messages: [userMessage, assistantMessage],
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveId(convId);

      await streamAssistantReply(
        convId,
        [userMessage],
        assistantMessage.id,
        personaId,
        draftCustomInstruction,
        thinkingDepth,
        webSearch,
        true,
        text,
      );
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingConvId(null);
  };

  const handleRegenerate = async () => {
    if (!activeConversation || isStreaming) return;
    const msgs = activeConversation.messages;
    if (msgs.length === 0) return;

    let sliceEnd = msgs.length;
    if (msgs[msgs.length - 1].role === 'model') {
      sliceEnd = msgs.length - 1;
    }
    const baseHistory = msgs.slice(0, sliceEnd);
    if (baseHistory.length === 0) return;

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'model',
      text: '',
      createdAt: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [...baseHistory, assistantMessage],
            }
          : c,
      ),
    );

    await streamAssistantReply(
      activeConversation.id,
      baseHistory,
      assistantMessage.id,
      activeConversation.personaId,
      activeConversation.customInstruction,
      activeConversation.thinkingDepth,
      Boolean(activeConversation.webSearch),
      false,
      '',
    );
  };

  const handleBranchFromMessage = (messageId: string) => {
    if (!activeConversation || isStreaming) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const now = Date.now();
    const branchedMessages = activeConversation.messages.slice(0, idx + 1).map((m) => ({
      ...m,
      id: createId(),
      followUps: undefined,
    }));

    const branchConv: Conversation = {
      id: createId(),
      title: `${activeConversation.title} (Branch)`,
      createdAt: now,
      updatedAt: now,
      personaId: activeConversation.personaId,
      customInstruction: activeConversation.customInstruction,
      thinkingDepth: activeConversation.thinkingDepth,
      webSearch: activeConversation.webSearch,
      messages: branchedMessages,
    };

    setConversations((prev) => [branchConv, ...prev]);
    setActiveId(branchConv.id);
    shouldAutoScrollRef.current = true;
  };

  const handleEditUserMessage = async (messageId: string, newText: string) => {
    if (!activeConversation || isStreaming) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const target = activeConversation.messages[idx];
    const updatedMsg: ChatMessage = {
      ...target,
      text: newText,
      createdAt: Date.now(),
    };

    const baseHistory = [...activeConversation.messages.slice(0, idx), updatedMsg];
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'model',
      text: '',
      createdAt: Date.now() + 1,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [...baseHistory, assistantMessage],
            }
          : c,
      ),
    );

    await streamAssistantReply(
      activeConversation.id,
      baseHistory,
      assistantMessage.id,
      activeConversation.personaId,
      activeConversation.customInstruction,
      activeConversation.thinkingDepth,
      Boolean(activeConversation.webSearch),
      idx === 0,
      newText,
    );
  };

  const handleExportMarkdown = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;

    const lines = [`# ${activeConversation.title}`, ''];
    for (const msg of activeConversation.messages) {
      const speaker = msg.role === 'user' ? 'User' : 'Flowr';
      lines.push(`## ${speaker}`);
      if (msg.attachments?.length) {
        lines.push(
          `Attachments: ${msg.attachments.map((a) => a.name).join(', ')}`,
        );
        lines.push('');
      }
      lines.push(msg.text || msg.error || '');
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeConversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chat'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentPersonaLabel =
    PERSONA_PRESETS.find((p) => p.id === currentPersonaId)?.label ?? 'Assistant';
  const currentDepthLabel =
    currentThinkingDepth === 'LOW'
      ? 'Fast'
      : currentThinkingDepth === 'HIGH'
        ? 'Deep'
        : 'Balanced';

  const lastAssistantId = useMemo(() => {
    if (!activeConversation) return null;
    for (let i = activeConversation.messages.length - 1; i >= 0; i--) {
      if (activeConversation.messages[i].role === 'model') {
        return activeConversation.messages[i].id;
      }
    }
    return null;
  }, [activeConversation]);

  const isEmptyState = !activeConversation || activeConversation.messages.length === 0;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-[#0d0d0d] dark:bg-black dark:text-[#f5f5f5]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        theme={theme}
        searchInputRef={searchInputRef}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onCloseMobile={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onDeleteChat={handleDeleteChat}
        onClearAll={handleClearAll}
        onOpenHistory={() => setHistoryModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-black">
        <BackgroundLayer prefs={bgPrefs} theme={theme} />

        {/* ChatGPT-style Minimal Top Bar */}
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 bg-white/75 px-3 backdrop-blur-md dark:bg-black/55 sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            {!sidebarOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                  aria-label="Open sidebar"
                  title="Open sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                  aria-label="New chat"
                  title="New chat (Alt+N)"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Mobile sidebar trigger when desktop state is open */}
            {sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] lg:hidden dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                aria-label="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}

            {/* Top-left Model / Persona Switcher */}
            <div ref={personaMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setPersonaMenuOpen((o) => !o)}
                aria-expanded={personaMenuOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-display text-sm font-semibold text-[#0d0d0d] transition-colors hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:text-[#f5f5f5] dark:hover:bg-[#1a1a1a]"
              >
                <span>Flowr</span>
                <span className="font-normal text-[#5d5d5d] dark:text-[#a3a3a3]">
                  {currentPersonaLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#8f8f8f] dark:text-[#737373]" />
              </button>

              {personaMenuOpen && (
                <div className="animate-pop-in absolute top-11 left-0 z-30 w-64 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#141414]/95">
                  <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#8f8f8f] dark:text-[#737373]">
                    Assistant Mode · {currentDepthLabel}
                  </div>
                  {PERSONA_PRESETS.map((preset) => {
                    const selected = preset.id === currentPersonaId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          updateActiveSettings(
                            preset.id,
                            currentCustomInstruction,
                            currentThinkingDepth,
                          );
                          setPersonaMenuOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                          selected
                            ? 'bg-[#f4f4f4] text-[#0d0d0d] dark:bg-[#242424] dark:text-white'
                            : 'text-[#3d3d3d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#d4d4d4] dark:hover:bg-[#1e1e1e] dark:hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{preset.label}</div>
                          <div className="truncate text-[11px] text-[#5d5d5d] dark:text-[#a3a3a3]">
                            {preset.description}
                          </div>
                        </div>
                        {selected && (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0d0d0d] dark:text-white" />
                        )}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
                  <button
                    type="button"
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      setPersonaModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[#3d3d3d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#d4d4d4] dark:hover:bg-[#1e1e1e] dark:hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#5d5d5d] dark:text-[#a3a3a3]" />
                    <span>Custom instructions...</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBackgroundModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              title="Customize workspace background"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Background</span>
            </button>

            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              title="Browse old chat history and backups"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </button>

            <button
              type="button"
              onClick={() => setPersonaModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              title="Custom instructions and reasoning depth"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Instructions</span>
            </button>

            {activeConversation && activeConversation.messages.length > 0 && (
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white/90 px-3 text-xs font-medium text-[#0d0d0d] transition-colors hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 dark:border-white/15 dark:bg-[#141414]/90 dark:text-[#f5f5f5] dark:hover:bg-[#1f1f1f]"
                title="Export conversation as Markdown"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Message Area */}
        <main className="relative z-10 flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto scroll-smooth"
          >
            {isEmptyState ? (
              <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-8 sm:px-6">
                <div className="mb-7 flex flex-col items-center text-center">
                  <div className="animate-fade-up relative mb-4 inline-flex items-center justify-center">
                    <div className="animate-logo-breathe pointer-events-none absolute -inset-3 rounded-3xl bg-[radial-gradient(circle,rgba(99,102,241,0.45)_0%,rgba(232,121,249,0.28)_50%,transparent_75%)] blur-xl" />
                    <div className="relative overflow-hidden rounded-2xl bg-black p-0.5 shadow-md ring-1 ring-black/10 dark:ring-white/20">
                      <img
                        src="/assets/aistudio/a88fd0eb-38f8-44c1-9e03-66d496fdc0ca_624e8b59.png"
                        alt="Flowr logo"
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHeroIndex((idx) => (idx + 1) % HERO_THOUGHTS.length)}
                    className="animate-fade-up-1 mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-medium text-[#5d5d5d] backdrop-blur-sm transition-colors hover:border-black/20 hover:text-[#0d0d0d] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#b4b4b4] dark:hover:border-white/20 dark:hover:text-white"
                    title="Click for a fresh reflection"
                  >
                    <Sparkles className="h-3 w-3 text-[#818cf8]" />
                    <span>{getTimeGreeting()} · Flowr Studio</span>
                  </button>

                  <h1 className="animate-fade-up-2 font-display text-2xl font-semibold tracking-tight text-[#0d0d0d] sm:text-4xl dark:text-white">
                    {HERO_THOUGHTS[heroIndex].prefix}
                    <span className="flowr-gradient-text">
                      {HERO_THOUGHTS[heroIndex].accent}
                    </span>
                  </h1>

                  <p className="animate-fade-up-2 mt-2.5 max-w-xl text-sm leading-relaxed text-[#5d5d5d] dark:text-[#a3a3a3]">
                    {HERO_THOUGHTS[heroIndex].subtitle}
                  </p>
                </div>

                {attachmentNotice && (
                  <div className="mb-3 w-full">
                    <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
                      <span>{attachmentNotice}</span>
                      <button
                        type="button"
                        onClick={() => setAttachmentNotice(null)}
                        className="font-medium underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                <div className="animate-fade-up-3 w-full">
                  <Composer
                    centered
                    input={input}
                    attachments={attachments}
                    thinkingDepth={currentThinkingDepth}
                    webSearch={currentWebSearch}
                    isStreaming={isStreaming}
                    onInputChange={setInput}
                    onAddAttachments={(files) => void handleAddAttachments(files)}
                    onRemoveAttachment={handleRemoveAttachment}
                    onThinkingDepthChange={(depth) =>
                      updateActiveSettings(currentPersonaId, currentCustomInstruction, depth)
                    }
                    onToggleWebSearch={handleToggleWebSearch}
                    onSend={() => void sendMessage()}
                    onStop={handleStopStreaming}
                  />
                </div>

                {/* Starter Prompts */}
                <div className="animate-fade-up-4 mt-5 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((starter) => (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => void sendMessage(starter.prompt, starter)}
                      className="flex flex-col items-start rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-left backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-white focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:border-white/10 dark:bg-[#121212]/80 dark:hover:border-white/20 dark:hover:bg-[#1a1a1a]"
                    >
                      <span className="text-[13px] font-medium text-[#0d0d0d] dark:text-[#f5f5f5]">
                        {starter.title}
                      </span>
                      <span className="mt-0.5 text-xs text-[#5d5d5d] dark:text-[#a3a3a3]">
                        {starter.subtitle}
                      </span>
                    </button>
                  ))}
                </div>

                {conversations.length > 0 && (
                  <div className="animate-fade-up-4 mt-7 w-full max-w-2xl border-t border-black/[0.06] pt-5 dark:border-white/[0.08]">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-[#5d5d5d] dark:text-[#a3a3a3]">
                        Continue a previous chat
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryModalOpen(true)}
                        className="text-xs font-medium text-[#0d0d0d] hover:underline dark:text-[#f5f5f5]"
                      >
                        View all history
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {conversations.slice(0, 3).map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => handleSelectChat(conv.id)}
                          className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-left backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-[#121212]/80 dark:hover:bg-[#1a1a1a]"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#8f8f8f] dark:text-[#737373]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-[#0d0d0d] dark:text-[#f5f5f5]">
                              {conv.title}
                            </div>
                            <div className="text-[11px] text-[#8f8f8f] tabular-nums dark:text-[#737373]">
                              {conv.messages.length} msg{conv.messages.length === 1 ? '' : 's'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-6 text-center text-[11px] text-[#8f8f8f] dark:text-[#737373]">
                  Flowr can make mistakes. Check important info.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
                {activeConversation.messages.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isStreaming={
                      isStreaming &&
                      message.role === 'model' &&
                      message.id === lastAssistantId
                    }
                    isLastAssistant={message.id === lastAssistantId}
                    onRegenerate={() => void handleRegenerate()}
                    onBranchFromMessage={handleBranchFromMessage}
                    onEditUserMessage={(msgId, newText) =>
                      void handleEditUserMessage(msgId, newText)
                    }
                    onSelectFollowUp={(prompt) => void sendMessage(prompt)}
                  />
                ))}
              </div>
            )}
          </div>

          {!isEmptyState && showScrollDown && (
            <button
              type="button"
              onClick={() => {
                shouldAutoScrollRef.current = true;
                scrollToBottom('smooth');
              }}
              className="absolute bottom-3 left-1/2 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-[#0d0d0d] shadow-md transition-colors hover:bg-[#f4f4f4] dark:border-white/15 dark:bg-[#181818] dark:text-[#f5f5f5] dark:hover:bg-[#242424]"
              aria-label="Scroll to latest message"
              title="Scroll to latest message"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </main>

        {/* Bottom Composer in Active Chats */}
        {!isEmptyState && (
          <div className="relative z-10">
            {attachmentNotice && (
              <div className="mx-auto mb-2 w-full max-w-3xl px-4 sm:px-6">
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
                  <span>{attachmentNotice}</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentNotice(null)}
                    className="font-medium underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <Composer
              input={input}
              attachments={attachments}
              thinkingDepth={currentThinkingDepth}
              webSearch={currentWebSearch}
              isStreaming={isStreaming}
              onInputChange={setInput}
              onAddAttachments={(files) => void handleAddAttachments(files)}
              onRemoveAttachment={handleRemoveAttachment}
              onThinkingDepthChange={(depth) =>
                updateActiveSettings(currentPersonaId, currentCustomInstruction, depth)
              }
              onToggleWebSearch={handleToggleWebSearch}
              onSend={() => void sendMessage()}
              onStop={handleStopStreaming}
            />
          </div>
        )}
      </div>

      <PersonaModal
        key={`${activeId ?? 'draft'}-${personaModalOpen ? 'open' : 'closed'}`}
        isOpen={personaModalOpen}
        personaId={currentPersonaId}
        customInstruction={currentCustomInstruction}
        thinkingDepth={currentThinkingDepth}
        onClose={() => setPersonaModalOpen(false)}
        onSave={updateActiveSettings}
      />

      <HistoryModal
        isOpen={historyModalOpen}
        conversations={conversations}
        activeId={activeId}
        onClose={() => setHistoryModalOpen(false)}
        onSelectChat={handleSelectChat}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onDeleteChat={handleDeleteChat}
        onImportHistory={handleImportHistory}
      />

      <BackgroundModal
        isOpen={backgroundModalOpen}
        prefs={bgPrefs}
        onClose={() => setBackgroundModalOpen(false)}
        onChange={handleBackgroundPrefsChange}
      />
    </div>
  );
}
