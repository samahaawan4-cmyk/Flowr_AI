import {useState} from 'react';
import {X} from 'lucide-react';
import {PERSONA_PRESETS, type ThinkingDepth} from '../types/chat';

interface PersonaModalProps {
  isOpen: boolean;
  personaId: string;
  customInstruction: string;
  thinkingDepth: ThinkingDepth;
  onClose: () => void;
  onSave: (personaId: string, customInstruction: string, thinkingDepth: ThinkingDepth) => void;
}

export function PersonaModal({
  isOpen,
  personaId,
  customInstruction,
  thinkingDepth,
  onClose,
  onSave,
}: PersonaModalProps) {
  const [draftPersonaId, setDraftPersonaId] = useState(personaId);
  const [draftInstruction, setDraftInstruction] = useState(customInstruction);
  const [draftDepth, setDraftDepth] = useState<ThinkingDepth>(thinkingDepth);

  if (!isOpen) return null;

  const selectedPreset = PERSONA_PRESETS.find((p) => p.id === draftPersonaId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-settings-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-[#121212]">
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] pb-4 dark:border-white/10">
          <div>
            <h2
              id="assistant-settings-title"
              className="font-display text-base font-semibold text-[#0d0d0d] dark:text-[#f5f5f5]"
            >
              Assistant Instructions
            </h2>
            <p className="mt-0.5 text-xs text-[#5d5d5d] dark:text-[#a3a3a3]">
              Configure how Flowr responds in this conversation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#3d3d3d] dark:text-[#d4d4d4]">
              Preset Mode
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PERSONA_PRESETS.map((preset) => {
                const active = draftPersonaId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDraftPersonaId(preset.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#10a37f] bg-[#10a37f]/10 text-[#0d0d0d] dark:border-[#10a37f] dark:bg-[#10a37f]/15 dark:text-white'
                        : 'border-black/10 bg-white text-[#3d3d3d] hover:bg-[#f4f4f4] dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#d4d4d4] dark:hover:bg-[#1e1e1e]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {selectedPreset && (
              <p className="mt-2 text-xs text-[#5d5d5d] dark:text-[#a3a3a3]">
                {selectedPreset.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3d3d3d] dark:text-[#d4d4d4]">
              Reasoning Depth
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'LOW', label: 'Fast', desc: 'Lowest latency'},
                  {id: 'MEDIUM', label: 'Balanced', desc: 'Everyday tasks'},
                  {id: 'HIGH', label: 'Deep', desc: 'Complex reasoning'},
                ] as const
              ).map((opt) => {
                const active = draftDepth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraftDepth(opt.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-[#10a37f] bg-[#10a37f]/10 text-[#0d0d0d] dark:border-[#10a37f] dark:bg-[#10a37f]/15 dark:text-white'
                        : 'border-black/10 bg-white text-[#3d3d3d] hover:bg-[#f4f4f4] dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#d4d4d4] dark:hover:bg-[#1e1e1e]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] opacity-75">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-system-instruction"
              className="block text-xs font-semibold text-[#3d3d3d] dark:text-[#d4d4d4]"
            >
              {draftPersonaId === 'custom'
                ? 'Custom System Instruction'
                : 'Additional System Instruction (Optional)'}
            </label>
            <textarea
              id="custom-system-instruction"
              value={draftInstruction}
              onChange={(e) => setDraftInstruction(e.target.value)}
              rows={4}
              placeholder="Example: Respond in concise bullet points, always include time complexity for algorithms, and prefer TypeScript."
              className="mt-2 w-full rounded-xl border border-black/10 bg-[#f9f9f9] p-3 text-sm text-[#0d0d0d] placeholder:text-[#8f8f8f] focus:border-black/25 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:focus:border-white/25"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-black/[0.06] pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-4 text-xs font-medium text-[#5d5d5d] hover:bg-[#f4f4f4] dark:text-[#a3a3a3] dark:hover:bg-[#222222]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draftPersonaId, draftInstruction.trim(), draftDepth);
              onClose();
            }}
            className="h-9 rounded-full bg-[#0d0d0d] px-4 text-xs font-medium text-white hover:bg-[#2f2f2f] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}
