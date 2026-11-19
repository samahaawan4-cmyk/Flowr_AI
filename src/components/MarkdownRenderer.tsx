import {useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Check, Copy} from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-black/10 bg-[#0d0d0d] text-[#f5f5f5] dark:border-white/10 dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#161616] px-3.5 py-2 text-xs text-[#a3a3a3]">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#10a37f]"
          aria-label="Copy code block"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#10a37f]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono">
        <code className={className}>{codeText}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({content}: MarkdownRendererProps) {
  return (
    <div className="prose-chat text-[15px] leading-[1.65] text-[#0d0d0d] dark:text-[#f5f5f5]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({children}) => (
            <h1 className="mt-6 mb-3 text-xl font-semibold tracking-tight text-[#0d0d0d] first:mt-0 dark:text-white font-display">
              {children}
            </h1>
          ),
          h2: ({children}) => (
            <h2 className="mt-5 mb-2.5 text-lg font-semibold tracking-tight text-[#0d0d0d] first:mt-0 dark:text-white font-display">
              {children}
            </h2>
          ),
          h3: ({children}) => (
            <h3 className="mt-4 mb-2 text-base font-semibold text-[#0d0d0d] first:mt-0 dark:text-[#f5f5f5] font-display">
              {children}
            </h3>
          ),
          p: ({children}) => <p className="mb-3.5 last:mb-0">{children}</p>,
          ul: ({children}) => (
            <ul className="mb-3.5 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({children}) => (
            <ol className="mb-3.5 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({children}) => <li className="leading-[1.6]">{children}</li>,
          a: ({href, children}) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0285ff] underline decoration-[#0285ff]/35 underline-offset-2 transition-colors hover:text-[#0066cc] hover:decoration-[#0066cc] dark:text-[#60b5ff] dark:hover:text-[#90cbff]"
            >
              {children}
            </a>
          ),
          blockquote: ({children}) => (
            <blockquote className="my-4 rounded-lg border border-black/10 bg-[#f9f9f9] px-4 py-3 text-[#3d3d3d] dark:border-white/10 dark:bg-[#121212] dark:text-[#d4d4d4]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-black/10 dark:border-white/10" />,
          table: ({children}) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({children}) => (
            <thead className="border-b border-black/10 bg-[#f9f9f9] text-xs font-semibold text-[#3d3d3d] dark:border-white/10 dark:bg-[#121212] dark:text-[#d4d4d4]">
              {children}
            </thead>
          ),
          tbody: ({children}) => (
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">{children}</tbody>
          ),
          tr: ({children}) => (
            <tr className="transition-colors hover:bg-[#f9f9f9] dark:hover:bg-[#121212]">
              {children}
            </tr>
          ),
          th: ({children}) => <th className="px-3.5 py-2.5 font-semibold">{children}</th>,
          td: ({children}) => <td className="px-3.5 py-2.5 align-top">{children}</td>,
          code: ({className, children}) => {
            const isBlock = Boolean(className) || String(children).includes('\n');
            if (!isBlock) {
              return (
                <code className="rounded bg-[#ececec] px-1.5 py-0.5 text-[13px] font-medium text-[#0d0d0d] dark:bg-[#1e1e1e] dark:text-[#f5f5f5] font-mono">
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          pre: ({children}) => <>{children}</>,
          strong: ({children}) => (
            <strong className="font-semibold text-[#0d0d0d] dark:text-white">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
