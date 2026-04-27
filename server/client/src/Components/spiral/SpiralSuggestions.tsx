import type { SpiralSuggestion } from '../../services/spiralContentSearch';

interface SpiralClassOption {
  id: string;
  label: string;
}

interface SpiralSuggestionsProps {
  suggestions: SpiralSuggestion[];
  isTeacher: boolean;
  classOptions: SpiralClassOption[];
  selectedClassId: string;
  hasActiveSession: boolean;
  busy?: boolean;
  onSelectClass: (classId: string) => void;
  onPlay: (suggestion: SpiralSuggestion) => void;
  onLaunchToClass: (suggestion: SpiralSuggestion) => void;
  onContinueGenerating: () => void;
}

function suggestionBadge(type: SpiralSuggestion['type']): string {
  return type === 'vr360' ? '360 Tour' : 'Lesson';
}

export const SpiralSuggestions = ({
  suggestions,
  isTeacher,
  classOptions,
  selectedClassId,
  hasActiveSession,
  busy = false,
  onSelectClass,
  onPlay,
  onLaunchToClass,
  onContinueGenerating,
}: SpiralSuggestionsProps) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-4 top-6 z-30 mx-auto max-w-5xl rounded-[2rem] border border-white/15 bg-slate-950/75 p-4 text-white shadow-2xl backdrop-blur-2xl md:top-8 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/75">I found these</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Pick one, or keep creating</h2>
          <p className="mt-1 text-sm text-white/65">You can tap a card or say “play first one”.</p>
        </div>
        <button
          type="button"
          onClick={onContinueGenerating}
          disabled={busy}
          className="rounded-full border border-cyan-200/25 bg-cyan-400/15 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue generating
        </button>
      </div>

      {isTeacher && !hasActiveSession && classOptions.length > 0 && (
        <label className="mb-4 block rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-sm text-white/80">
          Launch to class
          <select
            value={selectedClassId}
            onChange={(event) => onSelectClass(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-cyan-200"
          >
            {classOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <article
            key={suggestion.id}
            className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur-xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                  {index + 1} • {suggestionBadge(suggestion.type)}
                </span>
                <h3 className="mt-3 text-xl font-semibold leading-tight text-white">{suggestion.title}</h3>
              </div>
            </div>
            <p className="text-sm font-medium text-cyan-100/85">{suggestion.subtitle}</p>
            {suggestion.description && (
              <p className="mt-2 line-clamp-2 text-sm text-white/62">{suggestion.description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onPlay(suggestion)}
                disabled={busy}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play
              </button>
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => onLaunchToClass(suggestion)}
                  disabled={busy || (!hasActiveSession && classOptions.length === 0)}
                  className="rounded-full border border-emerald-200/30 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Launch to class
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export type { SpiralClassOption };
