import type {BackgroundPrefs} from '../utils/storage';

interface BackgroundLayerProps {
  prefs: BackgroundPrefs;
  theme: 'light' | 'dark';
}

const STARS: ReadonlyArray<{
  cx: string;
  cy: string;
  r: number;
  delayClass: string;
}> = [
  {cx: '6%', cy: '11%', r: 1.2, delayClass: '[animation-delay:0s]'},
  {cx: '14%', cy: '24%', r: 1.6, delayClass: '[animation-delay:0.8s]'},
  {cx: '21%', cy: '9%', r: 1.0, delayClass: '[animation-delay:1.6s]'},
  {cx: '28%', cy: '31%', r: 1.4, delayClass: '[animation-delay:2.4s]'},
  {cx: '34%', cy: '15%', r: 1.1, delayClass: '[animation-delay:0.4s]'},
  {cx: '42%', cy: '8%', r: 1.7, delayClass: '[animation-delay:1.2s]'},
  {cx: '49%', cy: '22%', r: 1.2, delayClass: '[animation-delay:2.9s]'},
  {cx: '57%', cy: '12%', r: 1.5, delayClass: '[animation-delay:0.6s]'},
  {cx: '64%', cy: '27%', r: 1.1, delayClass: '[animation-delay:1.9s]'},
  {cx: '72%', cy: '10%', r: 1.8, delayClass: '[animation-delay:3.1s]'},
  {cx: '81%', cy: '19%', r: 1.3, delayClass: '[animation-delay:0.9s]'},
  {cx: '90%', cy: '13%', r: 1.5, delayClass: '[animation-delay:2.2s]'},
  {cx: '94%', cy: '34%', r: 1.1, delayClass: '[animation-delay:1.4s]'},
  {cx: '8%', cy: '46%', r: 1.4, delayClass: '[animation-delay:2.7s]'},
  {cx: '17%', cy: '58%', r: 1.1, delayClass: '[animation-delay:0.3s]'},
  {cx: '24%', cy: '72%', r: 1.6, delayClass: '[animation-delay:1.7s]'},
  {cx: '11%', cy: '84%', r: 1.3, delayClass: '[animation-delay:3.4s]'},
  {cx: '35%', cy: '63%', r: 1.0, delayClass: '[animation-delay:2.1s]'},
  {cx: '44%', cy: '79%', r: 1.5, delayClass: '[animation-delay:0.7s]'},
  {cx: '53%', cy: '51%', r: 1.2, delayClass: '[animation-delay:1.5s]'},
  {cx: '61%', cy: '68%', r: 1.6, delayClass: '[animation-delay:2.8s]'},
  {cx: '69%', cy: '86%', r: 1.2, delayClass: '[animation-delay:0.5s]'},
  {cx: '77%', cy: '54%', r: 1.4, delayClass: '[animation-delay:1.1s]'},
  {cx: '86%', cy: '74%', r: 1.7, delayClass: '[animation-delay:2.5s]'},
  {cx: '92%', cy: '61%', r: 1.1, delayClass: '[animation-delay:3.6s]'},
  {cx: '38%', cy: '41%', r: 1.2, delayClass: '[animation-delay:1.8s]'},
  {cx: '66%', cy: '43%', r: 1.3, delayClass: '[animation-delay:2.6s]'},
  {cx: '79%', cy: '37%', r: 1.1, delayClass: '[animation-delay:0.2s]'},
  {cx: '15%', cy: '39%', r: 1.0, delayClass: '[animation-delay:3.0s]'},
  {cx: '51%', cy: '91%', r: 1.4, delayClass: '[animation-delay:1.3s]'},
];

function getDimScrimClass(dimOpacity: number, theme: 'light' | 'dark'): string {
  if (theme === 'dark') {
    if (dimOpacity <= 0.4) return 'bg-black/35';
    if (dimOpacity <= 0.6) return 'bg-black/55';
    if (dimOpacity <= 0.78) return 'bg-black/75';
    return 'bg-black/85';
  }
  if (dimOpacity <= 0.4) return 'bg-white/55';
  if (dimOpacity <= 0.6) return 'bg-white/70';
  if (dimOpacity <= 0.78) return 'bg-white/80';
  return 'bg-white/90';
}

export function BackgroundLayer({prefs, theme}: BackgroundLayerProps) {
  if (prefs.preset === 'obsidian') {
    return null;
  }

  if (prefs.preset === 'custom' && prefs.customImageUrl) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      >
        <img
          src={prefs.customImageUrl}
          alt=""
          className={`h-full w-full object-cover transition-transform duration-500 ${
            prefs.blur ? 'scale-105 blur-md' : 'scale-100'
          }`}
        />
        <div
          className={`absolute inset-0 transition-colors duration-300 ${getDimScrimClass(
            prefs.dimOpacity,
            theme,
          )}`}
        />
      </div>
    );
  }

  if (prefs.preset === 'silk') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      >
        <div className="animate-aurora-one absolute -top-36 -left-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.22)_0%,transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(96,165,250,0.26)_0%,transparent_70%)]" />
        <div className="animate-aurora-two absolute -right-24 -bottom-32 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.2)_0%,transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(217,70,239,0.24)_0%,transparent_70%)]" />
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          className="animate-wave-drift absolute -inset-6 h-[108%] w-[108%] opacity-40 dark:opacity-55"
        >
          <defs>
            <linearGradient id="flowr-silk-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#e879f9" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="flowr-silk-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="55%" stopColor="#818cf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.32" />
            </linearGradient>
          </defs>
          <path
            d="M-80,620 C240,460 480,760 820,560 C1120,380 1320,540 1520,400"
            fill="none"
            stroke="url(#flowr-silk-1)"
            strokeWidth="2.2"
          />
          <path
            d="M-80,670 C260,510 510,810 850,610 C1150,430 1340,590 1520,450"
            fill="none"
            stroke="url(#flowr-silk-2)"
            strokeWidth="1.6"
          />
          <path
            d="M-60,260 C280,140 540,380 900,200 C1180,60 1360,220 1520,120"
            fill="none"
            stroke="url(#flowr-silk-2)"
            strokeWidth="1.6"
          />
          <path
            d="M-60,300 C300,180 560,420 920,240 C1200,100 1380,260 1520,160"
            fill="none"
            stroke="url(#flowr-silk-1)"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    );
  }

  if (prefs.preset === 'starlight') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      >
        <div className="animate-aurora-two absolute -bottom-48 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,rgba(217,70,239,0.08)_45%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(99,102,241,0.24)_0%,rgba(217,70,239,0.12)_45%,transparent_72%)]" />
        <svg className="h-full w-full" preserveAspectRatio="none">
          {STARS.map((star, index) => (
            <circle
              key={index}
              cx={star.cx}
              cy={star.cy}
              r={star.r}
              className={`animate-star-twinkle fill-indigo-400/50 dark:fill-white/80 ${star.delayClass}`}
            />
          ))}
        </svg>
      </div>
    );
  }

  // Default: 'aurora'
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      <div className="animate-aurora-one absolute -top-40 -left-32 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.22)_0%,rgba(99,102,241,0.1)_45%,transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(96,165,250,0.24)_0%,rgba(99,102,241,0.14)_45%,transparent_72%)]" />
      <div className="animate-aurora-two absolute -right-32 -bottom-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.18)_0%,rgba(129,140,248,0.08)_48%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(217,70,239,0.22)_0%,rgba(99,102,241,0.12)_48%,transparent_72%)]" />
      <div className="absolute top-1/3 left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.07)_0%,transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(99,102,241,0.1)_0%,transparent_70%)]" />
    </div>
  );
}
