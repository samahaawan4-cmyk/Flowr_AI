export type ThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'text';
  data: string; // base64 for image, UTF-8 string for text
  previewUrl?: string; // data URL for image rendering
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  attachments?: Attachment[];
  sources?: GroundingSource[];
  followUps?: string[];
  error?: string;
}

export interface PersonaPreset {
  id: string;
  label: string;
  description: string;
  systemInstruction: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  personaId: string;
  customInstruction: string;
  thinkingDepth: ThinkingDepth;
  webSearch?: boolean;
  pinned?: boolean;
  archived?: boolean;
  messages: ChatMessage[];
}

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'general',
    label: 'Assistant',
    description: 'Clear, balanced answers for everyday research, writing, and analysis.',
    systemInstruction:
      'You are Flowr, a sharp, thoughtful, and reliable AI assistant. Provide clear, well-structured answers using Markdown when helpful. Be direct, accurate, and concise without unnecessary filler.',
  },
  {
    id: 'engineer',
    label: 'Engineer',
    description: 'Pragmatic software architecture, debugging, and clean production code.',
    systemInstruction:
      'You are a senior software engineer. Prioritize correctness, edge cases, maintainability, and clear code examples. Explain trade-offs concisely and format code blocks with explicit language tags.',
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Crisp prose editing, tone refinement, and structural clarity.',
    systemInstruction:
      'You are a meticulous editorial writer and copy editor. Focus on clarity, rhythm, active voice, and tight structure. When revising text, explain key improvements briefly.',
  },
  {
    id: 'tutor',
    label: 'Tutor',
    description: 'Step-by-step explanations built from first principles.',
    systemInstruction:
      'You are a patient, rigorous technical tutor. Break complex ideas down into clear mental models, use concrete examples, and verify understanding step by step.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Define your own system instructions for this conversation.',
    systemInstruction: '',
  },
];

export interface StarterPrompt {
  title: string;
  subtitle: string;
  prompt: string;
  personaId: string;
  thinkingDepth: ThinkingDepth;
  webSearch?: boolean;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    title: 'Debug a TypeScript async race condition',
    subtitle: 'Walk through AbortController and state cleanup patterns',
    prompt:
      'Explain how race conditions happen in React useEffect data fetching and show a clean TypeScript pattern using AbortController to prevent stale state updates.',
    personaId: 'engineer',
    thinkingDepth: 'LOW',
  },
  {
    title: 'Critique and tighten an executive memo',
    subtitle: 'Structure key decisions, risks, and next steps clearly',
    prompt:
      'Give me a practical 4-part template for a 1-page engineering RFC or executive decision memo, along with common writing pitfalls to cut.',
    personaId: 'editor',
    thinkingDepth: 'LOW',
  },
  {
    title: 'Compare SQLite, Postgres, and Redis',
    subtitle: 'Choose the right storage layer for latency and concurrency',
    prompt:
      'Compare SQLite, PostgreSQL, and Redis in a concise decision table covering write concurrency, query flexibility, operational overhead, and when to pick each.',
    personaId: 'general',
    thinkingDepth: 'LOW',
  },
  {
    title: 'Research latest web platform features',
    subtitle: 'Search live web sources with citations included',
    prompt:
      'What are the most notable new CSS and Web Platform features that reached Baseline recently? Summarize with practical examples.',
    personaId: 'general',
    thinkingDepth: 'LOW',
    webSearch: true,
  },
];

export interface PromptTemplate {
  label: string;
  template: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: 'Summarize into key takeaways',
    template: 'Summarize the following into 5 concise, actionable takeaways:\n\n',
  },
  {
    label: 'Review & refactor code',
    template: 'Review this code for bugs, edge cases, and readability improvements:\n\n```\n\n```',
  },
  {
    label: 'Compare options in a table',
    template: 'Create a comparison table covering pros, cons, and best use cases for:\n\n',
  },
  {
    label: 'Explain simply from scratch',
    template: 'Explain this concept clearly from first principles with a concrete example:\n\n',
  },
  {
    label: 'Rewrite with clearer tone',
    template: 'Rewrite the following message to be clearer, warmer, and more concise:\n\n',
  },
];
