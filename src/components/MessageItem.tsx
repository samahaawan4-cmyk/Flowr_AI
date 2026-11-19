import {useEffect, useState} from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  CornerDownRight,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Pencil,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react';
import type {ChatMessage} from '../types/chat';
import {MarkdownRenderer} from './MarkdownRenderer';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLastAssistant: boolean;
  onRegenerate: () => void;
  onBranchFromMessage: (messageId: string) => void;
  onEditUserMessage: (messageId: string, newText: string) => void;
  onSelectFollowUp: (prompt: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getHostname(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

export function MessageItem({
  message,
  isStreaming,
  isLastAssistant,
  onRegenerate,
  onBranchFromMessage,
  onEditUserMessage,
  onSelectFollowUp,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.text);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isWaitingForFirstToken =
    message.role === 'model' && isStreaming && !message.text && !message.error;

  useEffect(() => {
    if (!isWaitingForFirstToken) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isWaitingForFirstToken]);

  useEffect(() => {
    return () => {
      if (isSpeaking && ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking, ttsSupported]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleToggleSpeak = () => {
    if (!ttsSupported) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const plainText = message.text.replace(/[#`*>\[\]_~]/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSaveEdit = () => {
    if (!draftText.trim()) return;
    setIsEditing(false);
    onEditUserMessage(message.id, draftText.trim());
  };

  if (message.role === 'user') {
    return (
      <div className="animate-message-in group flex flex-col items-end gap-1.5">
        {isEditing ? (
          <div className="w-full max-w-2xl rounded-3xl border border-black/15 bg-[#f4f4f4] p-4 dark:border-white/15 dark:bg-[#161616]">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-[#0d0d0d] focus:outline-none dark:text-[#f5f5f5]"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setDraftText(message.text);
                }}
                className="h-8 rounded-full px-3.5 text-xs font-medium text-[#5d5d5d] hover:bg-black/5 dark:text-[#a3a3a3] dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="h-8 rounded-full bg-[#0d0d0d] px-4 text-xs font-medium text-white hover:bg-[#2f2f2f] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[78%] rounded-3xl bg-[#f4f4f4]/95 px-5 py-3 text-[15px] leading-[1.6] text-[#0d0d0d] backdrop-blur-sm dark:bg-[#1a1a1a]/90 dark:text-[#f5f5f5]">
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {message.attachments.map((att) =>
                  att.kind === 'image' && att.previewUrl ? (
                    <div
                      key={att.id}
                      className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#0a0a0a]"
                    >
                      <img
                        src={att.previewUrl}
                        alt={att.name}
                        className="max-h-48 max-w-[240px] object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      key={att.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs text-[#3d3d3d] dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#d4d4d4]"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[#10a37f]" />
                      <span className="max-w-[160px] truncate font-medium">{att.name}</span>
                      <span className="text-[#8f8f8f] tabular-nums dark:text-[#737373]">
                        {formatBytes(att.size)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}

            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 pr-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#8f8f8f] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#737373] dark:hover:bg-[#1a1a1a] dark:hover:text-[#f5f5f5]"
              aria-label="Copy prompt"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#10a37f]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {!isStreaming && (
              <button
                type="button"
                onClick={() => {
                  setDraftText(message.text);
                  setIsEditing(true);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#8f8f8f] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#737373] dark:hover:bg-[#1a1a1a] dark:hover:text-[#f5f5f5]"
                aria-label="Edit prompt"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-message-in group flex items-start gap-3.5 sm:gap-4">
      {/* ChatGPT-style Assistant Avatar */}
      <div className="mt-0.5 shrink-0">
        <img
          src="/assets/aistudio/a88fd0eb-38f8-44c1-9e03-66d496fdc0ca_624e8b59.png"
          alt="Flowr"
          referrerPolicy="no-referrer"
          className="h-7 w-7 rounded-full bg-black object-cover ring-1 ring-black/10 dark:ring-white/15"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {message.error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1 space-y-2">
              <p>{message.error}</p>
              {isLastAssistant && !isStreaming && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-[#141414] dark:text-red-300 dark:hover:bg-red-950"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            {message.text ? (
              <MarkdownRenderer content={message.text} />
            ) : isStreaming ? (
              <div className="flex items-center gap-2.5 py-1.5 text-sm text-[#5d5d5d] dark:text-[#a3a3a3]">
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#93c5fd] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#818cf8] [animation-delay:140ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f472b6] [animation-delay:280ms]" />
                </span>
                <span>
                  Flowr is thinking
                  {elapsedSec > 0 ? (
                    <span className="ml-1 tabular-nums opacity-75">({elapsedSec}s)</span>
                  ) : (
                    '...'
                  )}
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Grounded Web Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="pt-2">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#5d5d5d] dark:text-[#a3a3a3]">
              <Globe className="h-3.5 w-3.5" />
              <span>Sources</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {message.sources.map((src) => (
                <a
                  key={src.uri}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#f9f9f9] px-3 py-2 text-xs transition-colors hover:bg-[#f4f4f4] dark:border-white/10 dark:bg-[#121212] dark:hover:bg-[#1c1c1c]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#0d0d0d] dark:text-[#f5f5f5]">
                      {src.title}
                    </div>
                    <div className="truncate text-[11px] text-[#5d5d5d] dark:text-[#a3a3a3]">
                      {getHostname(src.uri)}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#8f8f8f] dark:text-[#737373]" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Compact ChatGPT-style Icon Action Bar */}
        {!isStreaming && !message.error && message.text && (
          <div className="flex flex-wrap items-center gap-0.5 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              aria-label="Copy response"
              title="Copy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#10a37f]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {ttsSupported && (
              <button
                type="button"
                onClick={handleToggleSpeak}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                aria-label={isSpeaking ? 'Stop reading aloud' : 'Read response aloud'}
                title={isSpeaking ? 'Stop' : 'Read aloud'}
              >
                {isSpeaking ? (
                  <Square className="h-3 w-3 fill-current text-[#10a37f]" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onBranchFromMessage(message.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              aria-label="Branch into new chat"
              title="Branch into new chat"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>

            {isLastAssistant && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#5d5d5d] transition-colors hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                aria-label="Regenerate response"
                title="Regenerate"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Contextual Follow-up Prompts */}
        {isLastAssistant &&
          !isStreaming &&
          !message.error &&
          message.followUps &&
          message.followUps.length > 0 && (
            <div className="flex flex-col items-start gap-1.5 pt-2">
              {message.followUps.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSelectFollowUp(prompt)}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-left text-xs font-medium text-[#3d3d3d] backdrop-blur-sm transition-all duration-150 hover:bg-[#f4f4f4] hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-[#10a37f] dark:border-white/10 dark:bg-[#121212]/85 dark:text-[#d4d4d4] dark:hover:bg-[#1c1c1c] dark:hover:text-white"
                >
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-[#8f8f8f] dark:text-[#737373]" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
