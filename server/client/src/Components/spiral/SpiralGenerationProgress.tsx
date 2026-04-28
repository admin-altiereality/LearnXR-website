interface GenerationProgressItem {
  id: string;
  label: string;
  detail?: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'stopped';
  tone: 'skybox' | 'asset' | 'system';
}

interface SpiralGenerationProgressProps {
  items: GenerationProgressItem[];
  skyboxProgress: number | null;
  assetProgress: number | null;
  isGenerating: boolean;
}

const TONE_COLORS: Record<GenerationProgressItem['tone'], string> = {
  skybox: 'text-sky-100 border-sky-300/30 bg-sky-400/12',
  asset: 'text-violet-100 border-violet-300/30 bg-violet-400/12',
  system: 'text-emerald-100 border-emerald-300/30 bg-emerald-400/12',
};

const STATUS_COPY: Record<GenerationProgressItem['status'], string> = {
  pending: 'Waiting',
  active: 'Working',
  completed: 'Done',
  failed: 'Failed',
  stopped: 'Stopped',
};

function clampProgress(progress: number | null): number {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

const ProgressDial = ({
  label,
  progress,
  color,
  radius,
}: {
  label: string;
  progress: number | null;
  color: string;
  radius: number;
}) => {
  const value = clampProgress(progress);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const size = radius * 2 + 18;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</p>
        <p className="text-lg font-bold leading-none text-white">{value}%</p>
      </div>
    </div>
  );
};

export const SpiralGenerationProgress = ({
  items,
  skyboxProgress,
  assetProgress,
  isGenerating,
}: SpiralGenerationProgressProps) => {
  if (!isGenerating) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-6 z-20 w-[min(24rem,calc(100vw-2rem))] rounded-[1.75rem] border border-white/12 bg-slate-950/72 p-4 text-white shadow-2xl backdrop-blur-2xl md:right-8 md:top-8">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Generation</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Creating your scene</h2>
        </div>
        {isGenerating && (
          <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
            Live
          </span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <ProgressDial label="360 world" progress={skyboxProgress} color="rgba(56,189,248,0.95)" radius={24} />
        <ProgressDial label="3D asset" progress={assetProgress} color="rgba(167,139,250,0.95)" radius={19} />
      </div>

      <div className="space-y-2">
        {items.slice(-4).map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border px-3 py-2 ${TONE_COLORS[item.tone]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
                {STATUS_COPY[item.status]}
              </span>
            </div>
            {item.detail && <p className="mt-1 line-clamp-2 text-xs opacity-75">{item.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export type { GenerationProgressItem };
