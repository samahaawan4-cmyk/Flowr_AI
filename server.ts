import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import {GoogleGenAI, ThinkingLevel, Type, type Content, type Part} from '@google/genai';

dotenv.config(
  process.env.FLOWR_ENV_PATH ? {path: process.env.FLOWR_ENV_PATH} : undefined,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_ID = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 for binary/images, or utf-8 text for text files
  kind: 'image' | 'text';
}

interface IncomingMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: IncomingAttachment[];
}

function buildContents(messages: IncomingMessage[]): Content[] {
  return messages.map((msg) => {
    const parts: Part[] = [];

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (att.kind === 'image') {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        } else {
          parts.push({
            text: `Attached file (${att.name}):\n\`\`\`\n${att.data}\n\`\`\``,
          });
        }
      }
    }

    if (msg.text && msg.text.trim().length > 0) {
      parts.push({text: msg.text});
    } else if (parts.length === 0) {
      parts.push({text: ' '});
    }

    return {
      role: msg.role,
      parts,
    };
  });
}

function mapThinkingLevel(level?: string): ThinkingLevel {
  switch (level) {
    case 'HIGH':
      return ThinkingLevel.HIGH;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'LOW':
    default:
      return ThinkingLevel.LOW;
  }
}

function formatApiError(err: unknown): {status: number; message: string} {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('gemini_api_key') || lower.includes('api_key_invalid') || lower.includes('400')) {
    if (lower.includes('api key')) {
      return {
        status: 401,
        message: 'Your Gemini API key appears invalid or missing. Please verify it in Settings > Secrets.',
      };
    }
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Permission denied by the Gemini API. Please check your API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit or quota exceeded. Please wait a moment and try again.',
    };
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message: 'The Gemini model is experiencing temporary high demand. Please try again in a moment.',
    };
  }
  if (lower.includes('timed out') || lower.includes('deadline')) {
    return {
      status: 504,
      message: 'The model took too long to respond. Please try sending your message again.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'The requested Gemini model was not found or is currently unavailable.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'An unexpected error occurred while generating a response.',
  };
}

const PRIMARY_MODEL_ID = 'gemini-4-hydrogen';
const FALLBACK_MODEL_ID = 'gemini-3.1-flash-lite';

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('timed out') ||
    msg.includes('deadline')
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '25mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({ok: true, model: PRIMARY_MODEL_ID, fallbackModel: FALLBACK_MODEL_ID});
  });

  app.post('/api/chat', async (req, res) => {
    const {messages, systemInstruction, thinkingLevel, webSearch} = req.body as {
      messages?: IncomingMessage[];
      systemInstruction?: string;
      thinkingLevel?: string;
      webSearch?: boolean;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({error: 'Messages array is required and cannot be empty.'});
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const abortController = new AbortController();
    let clientClosed = false;

    const keepaliveTimer = setInterval(() => {
      if (!clientClosed && !res.writableEnded) {
        res.write(': keepalive\n\n');
      }
    }, 3000);

    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        clearInterval(keepaliveTimer);
        abortController.abort();
      }
    });

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!clientClosed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const ai = getAiClient();
      const contents = buildContents(messages);
      const resolvedSystem =
        systemInstruction?.trim() ||
        'You are Flowr, a sharp, thoughtful, and reliable AI assistant. Provide clear, well-structured answers using Markdown when helpful.';

      const attempts: Array<{model: string; level: ThinkingLevel; timeoutMs: number}> =
        thinkingLevel === 'HIGH'
          ? [
              {model: PRIMARY_MODEL_ID, level: ThinkingLevel.HIGH, timeoutMs: 25000},
              {model: FALLBACK_MODEL_ID, level: ThinkingLevel.MINIMAL, timeoutMs: 15000},
            ]
          : thinkingLevel === 'MEDIUM'
            ? [
                {model: PRIMARY_MODEL_ID, level: ThinkingLevel.MEDIUM, timeoutMs: 12000},
                {model: FALLBACK_MODEL_ID, level: ThinkingLevel.MINIMAL, timeoutMs: 15000},
              ]
            : [
                {model: FALLBACK_MODEL_ID, level: ThinkingLevel.MINIMAL, timeoutMs: 12000},
                {model: PRIMARY_MODEL_ID, level: ThinkingLevel.LOW, timeoutMs: 15000},
              ];

      let streamedAnyChunk = false;
      const sourceMap = new Map<string, {title: string; uri: string}>();

      for (let i = 0; i < attempts.length; i++) {
        const {model, level, timeoutMs} = attempts[i];
        const attemptAbort = new AbortController();
        const onParentAbort = () => attemptAbort.abort();
        abortController.signal.addEventListener('abort', onParentAbort, {once: true});

        let timedOut = false;
        const firstChunkTimer = setTimeout(() => {
          if (!streamedAnyChunk) {
            timedOut = true;
            attemptAbort.abort();
          }
        }, timeoutMs);

        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: resolvedSystem,
              thinkingConfig: {
                thinkingLevel: level,
              },
              ...(webSearch ? {tools: [{googleSearch: {}}]} : {}),
              abortSignal: attemptAbort.signal,
            },
          });

          for await (const chunk of stream) {
            if (clientClosed) break;

            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(groundingChunks)) {
              for (const gChunk of groundingChunks) {
                const uri = gChunk.web?.uri;
                if (uri && !sourceMap.has(uri)) {
                  sourceMap.set(uri, {
                    title: gChunk.web?.title || uri,
                    uri,
                  });
                }
              }
            }

            const textChunk = chunk.text;
            if (textChunk) {
              if (!streamedAnyChunk) {
                clearTimeout(firstChunkTimer);
              }
              streamedAnyChunk = true;
              writeEvent({type: 'delta', text: textChunk});
            }
          }
          clearTimeout(firstChunkTimer);
          abortController.signal.removeEventListener('abort', onParentAbort);
          break;
        } catch (attemptErr) {
          clearTimeout(firstChunkTimer);
          abortController.signal.removeEventListener('abort', onParentAbort);

          const finalErr = timedOut
            ? new Error(`Model ${model} timed out after ${timeoutMs}ms`)
            : attemptErr;

          console.error(`[chat] attempt ${i + 1} (${model}) failed:`, finalErr);

          if (
            clientClosed ||
            streamedAnyChunk ||
            !isTransientError(finalErr) ||
            i === attempts.length - 1
          ) {
            throw finalErr;
          }
        }
      }

      if (!clientClosed) {
        if (sourceMap.size > 0) {
          writeEvent({type: 'sources', sources: Array.from(sourceMap.values()).slice(0, 8)});
        }
        writeEvent({type: 'done'});
      }
    } catch (err) {
      if (
        clientClosed ||
        (err instanceof Error && (err.name === 'AbortError' || err.message === 'AbortError'))
      ) {
        return;
      }
      const formatted = formatApiError(err);
      writeEvent({type: 'error', status: formatted.status, message: formatted.message});
    } finally {
      clearInterval(keepaliveTimer);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  app.post('/api/title', async (req, res) => {
    const {prompt} = req.body as {prompt?: string};
    if (!prompt || !prompt.trim()) {
      res.status(400).json({error: 'Prompt is required.'});
      return;
    }

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: FALLBACK_MODEL_ID,
        contents: `Generate a concise 3 to 5 word title (no quotes, no punctuation at the end) summarizing this chat prompt:\n\n${prompt.slice(0, 600)}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });

      const title = (response.text ?? '').replace(/^["']|["']$/g, '').trim();
      res.json({title: title || 'New Conversation'});
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({error: formatted.message});
    }
  });

  app.post('/api/suggestions', async (req, res) => {
    const {lastUserText, lastModelText} = req.body as {
      lastUserText?: string;
      lastModelText?: string;
    };
    if (!lastModelText || !lastModelText.trim()) {
      res.json({suggestions: []});
      return;
    }

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: FALLBACK_MODEL_ID,
        contents: `Given this conversation turn, suggest 3 short, practical follow-up questions or next-step prompts the user might want to ask next (each under 9 words, natural language).\n\nUser: ${(lastUserText ?? '').slice(0, 400)}\nAssistant: ${lastModelText.slice(0, 900)}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      const suggestions = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
        : [];
      res.json({suggestions});
    } catch {
      res.json({suggestions: []});
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.FLOWR_DIST_DIR || path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
