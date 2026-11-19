import {useRef, useState} from 'react';
import {Check, Image as ImageIcon, RotateCcw, Sparkles, Trash2, Upload, X} from 'lucide-react';
import {
  DEFAULT_BG_PREFS,
  type BackgroundPrefs,
  type BackgroundPresetId,
} from '../utils/storage';

interface BackgroundModalProps {
  isOpen: boolean;
  prefs: BackgroundPrefs;
  onClose: () => void;
  onChange: (next: BackgroundPrefs) => void;
}

const PRESET_CARDS: ReadonlyArray<{
  id: Exclude<BackgroundPresetId, 'custom'>;
  name: string;
  description: string;
  swatchClass: string;
}> = [
  {
    id: 'aurora',
    name: 'Flowr Aurora',
    description: 'Drifting ice-blue & magenta glow',
    swatchClass:
      'bg-[radial-gradient(circle_at_25%_25%,rgba(96,165,250,0.65),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(232,121,249,0.55),transparent_55%)] bg-[#08080f]',
  },
  {
    id: 'silk',
    name: 'Silk Waves',
    description: 'Iridescent flowing ribbons',
    swatchClass:
      'bg-[linear-gradient(135deg,#070913_0%,#1e1b4b_45%,#4c1d95_75%,#09090b_100%)]',
  },
  {
    id: 'starlight',
    name: 'Starlight',
    description: 'Twinkling midnight cosmos',
    swatchClass:
      'bg-[radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.45),transparent_60%)] bg-[#030308]',
  },
  {
    id: 'obsidian',
    name: 'Pure Black',
    description: 'Minimal OLED distraction-free',
    swatchClass: 'bg-black',
  },
];

const DIM_LEVELS: ReadonlyArray<{value: number; label: string}> = [
  {value: 0.35, label: 'Light'},
  {value: 0.55, label: 'Balanced'},
  {value: 0.75, label: 'Deep'},
  {value: 0.85, label: 'Dark'},
];

export function BackgroundModal({
  isOpen,
  prefs,
  onClose,
  onChange,
}: BackgroundModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelected = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, WebP, or GIF image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image must be 8 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) {
        setUploadError('Could not read the selected image.');
        return;
      }
      onChange({
        ...prefs,
        preset: 'custom',
        customImageUrl: dataUrl,
      });
    };
    reader.onerror = () => {
      setUploadError('Could not read the selected image.');
    };
    reader.readAsDataURL(file);
  };

  const hasCustomImage = Boolean(prefs.customImageUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="background-modal-title"
    >
      <div className="animate-pop-in flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/15 dark:bg-[#121212]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f4] text-[#0d0d0d] dark:bg-[#1e1e1e] dark:text-[#f5f5f5]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="background-modal-title"
                className="font-display text-sm font-semibold text-[#0d0d0d] dark:text-[#f5f5f5]"
              >
                Workspace Background
              </h2>
              <p className="text-[11px] text-[#5d5d5d] dark:text-[#a3a3a3]">
                Pick an animated backdrop or upload a wallpaper.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <span className="block text-xs font-semibold text-[#3d3d3d] dark:text-[#d4d4d4]">
              Ambient Backdrops
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESET_CARDS.map((card) => {
                const selected = prefs.preset === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onChange({...prefs, preset: card.id})}
                    className={`group flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${
                      selected
                        ? 'border-[#10a37f] bg-[#10a37f]/10 dark:border-[#10a37f] dark:bg-[#10a37f]/15'
                        : 'border-black/10 bg-white hover:bg-[#f4f4f4] dark:border-white/10 dark:bg-[#0a0a0a] dark:hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div
                      className={`relative h-8 w-8 shrink-0 rounded-lg border border-black/15 dark:border-white/15 ${card.swatchClass}`}
                    >
                      {selected && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#10a37f] text-white shadow-xs">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#0d0d0d] dark:text-[#f5f5f5]">
                        {card.name}
                      </div>
                      <div className="truncate text-[11px] text-[#5d5d5d] dark:text-[#a3a3a3]">
                        {card.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-black/[0.06] pt-3.5 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#3d3d3d] dark:text-[#d4d4d4]">
                Custom Wallpaper
              </span>
              {hasCustomImage && prefs.preset === 'custom' && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...prefs,
                      preset: 'aurora',
                      customImageUrl: undefined,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelected(file);
                }
                e.target.value = '';
              }}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-black/10 bg-[#f9f9f9] px-3 text-xs font-medium text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] dark:border-white/15 dark:bg-[#0a0a0a] dark:text-[#f5f5f5] dark:hover:bg-[#1c1c1c]"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{hasCustomImage ? 'Replace Image' : 'Upload Image'}</span>
              </button>

              {hasCustomImage && (
                <button
                  type="button"
                  onClick={() => onChange({...prefs, preset: 'custom'})}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    prefs.preset === 'custom'
                      ? 'border-[#10a37f] bg-[#10a37f]/10 text-[#0d0d0d] dark:bg-[#10a37f]/15 dark:text-white'
                      : 'border-black/10 bg-white text-[#5d5d5d] hover:bg-[#f4f4f4] dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#a3a3a3] dark:hover:bg-[#1a1a1a]'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Use Uploaded</span>
                </button>
              )}
            </div>

            {uploadError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{uploadError}</p>
            )}

            {prefs.preset === 'custom' && hasCustomImage && (
              <div className="mt-3 space-y-2.5 rounded-xl border border-black/10 bg-[#f9f9f9] p-3 dark:border-white/10 dark:bg-[#0a0a0a]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#3d3d3d] dark:text-[#d4d4d4]">
                    Dimness
                  </span>
                  <div className="inline-flex items-center rounded-lg bg-black/[0.05] p-0.5 dark:bg-white/[0.06]">
                    {DIM_LEVELS.map((level) => {
                      const active = Math.abs(prefs.dimOpacity - level.value) < 0.05;
                      return (
                        <button
                          key={level.label}
                          type="button"
                          onClick={() => onChange({...prefs, dimOpacity: level.value})}
                          className={`h-6 rounded-md px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-white text-[#0d0d0d] shadow-xs dark:bg-[#242424] dark:text-white'
                              : 'text-[#5d5d5d] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:text-white'
                          }`}
                        >
                          {level.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#3d3d3d] dark:text-[#d4d4d4]">
                    Soft Backdrop Blur
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.blur}
                    onClick={() => onChange({...prefs, blur: !prefs.blur})}
                    className={`inline-flex h-6 items-center rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${
                      prefs.blur
                        ? 'border-[#10a37f] bg-[#10a37f]/15 text-[#0d0d0d] dark:text-white'
                        : 'border-black/10 bg-white text-[#5d5d5d] dark:border-white/10 dark:bg-[#141414] dark:text-[#a3a3a3]'
                    }`}
                  >
                    {prefs.blur ? 'Blur On' : 'Blur Off'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-black/[0.06] px-5 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_BG_PREFS)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-full bg-[#0d0d0d] px-4 text-xs font-medium text-white hover:bg-[#2f2f2f] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
