import {useEffect, useRef, useState} from 'react';
import {
  ArrowUp,
  FileText,
  Globe,
  LayoutTemplate,
  Mic,
  MicOff,
  Plus,
  Square,
  X,
} from 'lucide-react';
import {
  PROMPT_TEMPLATES,
  type Attachment,
  type ThinkingDepth,
} from '../types/chat';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface ComposerProps {
  input: string;
  attachments: Attachment[];
  thinkingDepth: ThinkingDepth;
  webSearch: boolean;
  isStreaming: boolean;
  centered?: boolean;
  onInputChange: (val: string) => void;
  onAddAttachments: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onThinkingDepthChange: (depth: ThinkingDepth) => void;
  onToggleWebSearch: () => void;
  onSend: () => void;
  onStop: () => void;
}

const DEPTH_OPTIONS: Array<{id: ThinkingDepth; label: string}> = [
  {id: 'LOW', label: 'Fast'},
  {id: 'MEDIUM', label: 'Balanced'},
  {id: 'HIGH', label: 'Deep'},
];

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({
  input,
  attachments,
  thinkingDepth,
  webSearch,
  isStreaming,
  centered = false,
  onInputChange,
  onAddAttachments,
  onRemoveAttachment,
  onThinkingDepthChange,
  onToggleWebSearch,
  onSend,
  onStop,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const [isDragging, setIsDragging] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    if (!templatesOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setTemplatesOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTemplatesOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [templatesOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      onAddAttachments(files);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        const base = inputRef.current.trim();
        onInputChange(base ? `${base} ${transcript.trim()}` : transcript.trim());
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const applyTemplate = (template: string) => {
    const trimmed = input.trim();
    onInputChange(trimmed ? `${template}${trimmed}` : template);
    setTemplatesOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className={centered ? 'w-full' : 'mx-auto w-full max-w-3xl px-4 pb-3 sm:px-6 sm:pb-4'}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            onAddAttachments(e.dataTransfer.files);
          }
        }}
        className={`relative rounded-[26px] border bg-white/90 shadow-sm backdrop-blur-md transition-colors dark:bg-[#141414]/90 ${
          isDragging
            ? 'border-[#10a37f] ring-2 ring-[#10a37f]/25'
            : 'border-black/10 focus-within:border-black/20 dark:border-white/[0.12] dark:focus-within:border-white/25'
        }`}
      >
        {/* Pending Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-black/[0.06] px-4 pt-3.5 pb-2.5 dark:border-white/10">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-xl border border-black/10 bg-[#f4f4f4] pr-2 text-xs dark:border-white/10 dark:bg-[#0a0a0a]"
              >
                {att.kind === 'image' && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="h-10 w-10 rounded-l-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-9 items-center justify-center rounded-l-xl bg-[#ececec] dark:bg-[#1a1a1a]">
                    <FileText className="h-4 w-4 text-[#10a37f]" />
                  </div>
                )}
                <span className="max-w-[140px] truncate font-medium text-[#0d0d0d] dark:text-[#f5f5f5]">
                  {att.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="rounded p-1 text-[#8f8f8f] hover:bg-black/5 hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="px-5 pt-3.5 pb-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            placeholder="Message Flowr"
            aria-label="Message input"
            className="max-h-[200px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#0d0d0d] placeholder:text-[#8f8f8f] focus:outline-none dark:text-[#f5f5f5] dark:placeholder:text-[#737373]"
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.css,.html,.csv,.sql,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  onAddAttachments(e.target.files);
                }
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] shrink-0 dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
              title="Attach files or images"
              aria-label="Attach files or images"
            >
              <Plus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onToggleWebSearch}
              aria-pressed={webSearch}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 ${
                webSearch
                  ? 'border-[#0285ff]/30 bg-[#0285ff]/10 text-[#0285ff] dark:border-[#48aaff]/35 dark:bg-[#0285ff]/20 dark:text-[#60b5ff]'
                  : 'border-transparent text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white'
              }`}
              title="Search the web for current answers"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Search</span>
            </button>

            {/* Prompt Templates Popover */}
            <div ref={templatesRef} className="relative">
              <button
                type="button"
                onClick={() => setTemplatesOpen((o) => !o)}
                aria-expanded={templatesOpen}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#10a37f] whitespace-nowrap shrink-0 ${
                  templatesOpen
                    ? 'bg-[#f4f4f4] text-[#0d0d0d] dark:bg-[#222222] dark:text-white'
                    : 'text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white'
                }`}
                title="Insert a prompt template"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prompts</span>
              </button>

              {templatesOpen && (
                <div className="animate-pop-in absolute bottom-11 left-0 z-30 w-64 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#141414]/95">
                  <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#8f8f8f] dark:text-[#737373]">
                    Prompt Templates
                  </div>
                  {PROMPT_TEMPLATES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => applyTemplate(item.template)}
                      className="block w-full rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[#3d3d3d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#d4d4d4] dark:hover:bg-[#222222] dark:hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reasoning Depth Selector */}
            <div
              className="inline-flex items-center rounded-full bg-[#f4f4f4] p-0.5 dark:bg-[#0a0a0a]"
              role="group"
              aria-label="Reasoning speed"
            >
              {DEPTH_OPTIONS.map((opt) => {
                const active = thinkingDepth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onThinkingDepthChange(opt.id)}
                    className={`h-7 rounded-full px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-[#0d0d0d] shadow-xs dark:bg-[#242424] dark:text-white'
                        : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-pressed={isListening}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[#10a37f] shrink-0 ${
                  isListening
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                    : 'text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white'
                }`}
                title={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                aria-label={isListening ? 'Stop voice dictation' : 'Voice dictation'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0d0d0d] text-white transition-colors hover:bg-[#2f2f2f] focus-visible:outline-2 focus-visible:outline-[#10a37f] shrink-0 dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[#10a37f] shrink-0 ${
                  canSend
                    ? 'bg-[#0d0d0d] text-white hover:bg-[#2f2f2f] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]'
                    : 'cursor-not-allowed bg-[#e5e5e5] text-[#a3a3a3] dark:bg-[#262626] dark:text-[#525252]'
                }`}
                aria-label="Send message"
                title="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!centered && (
        <p className="mt-2 text-center text-[11px] text-[#8f8f8f] dark:text-[#737373]">
          Flowr can make mistakes. Check important info.
        </p>
      )}
    </div>
  );
}
