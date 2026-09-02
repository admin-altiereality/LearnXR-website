import { Html } from '@react-three/drei';
import { Box } from 'lucide-react';

export interface Asset3DLoadingCardProps {
  /** Bytes downloaded so far. Ignored when `countMode` is set. */
  loaded?: number;
  /** Total bytes expected (0/undefined if not yet known). Ignored when `countMode` is set. */
  total?: number;
  /** 'downloading' while bytes are streaming in, 'processing' once the transfer
   * is complete and the GLTFLoader is parsing/decoding geometry & textures. */
  phase?: 'downloading' | 'processing';
  /** Optional override for the asset's display name/label. */
  label?: string;
  /** Use when byte-level progress isn't available (e.g. krpano's native threejs plugin,
   * which only reports per-object load completion, not download bytes). Shows
   * "N of M 3D objects ready" instead of an MB counter. */
  countMode?: boolean;
  loadedCount?: number;
  totalCount?: number;
}

const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/**
 * Presentational loading card — usable outside an @react-three/fiber <Canvas>
 * (e.g. as a plain absolutely-positioned overlay next to krpano's own container).
 * For use inside a Canvas, use <Asset3DLoadingOverlay> instead, which wraps this
 * in drei's <Html>.
 */
export function Asset3DLoadingCard({
  loaded = 0,
  total,
  phase = 'downloading',
  label,
  countMode = false,
  loadedCount = 0,
  totalCount = 0,
}: Asset3DLoadingCardProps) {
  const hasTotal = countMode ? totalCount > 0 : Boolean(total && total > 0);
  const percent = hasTotal
    ? Math.min(100, Math.round(((countMode ? loadedCount : loaded) / (countMode ? totalCount : (total as number))) * 100))
    : 0;
  const isProcessing = phase === 'processing';

  const circumference = 2 * Math.PI * 42;
  const dashOffset = hasTotal ? circumference * (1 - percent / 100) : circumference * 0.75;

  return (
    <div className="flex flex-col items-center gap-4 px-8 py-7 min-w-[240px] bg-black/90 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="url(#asset3d-loading-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={hasTotal ? dashOffset : circumference * 0.75}
            className={!hasTotal || isProcessing ? 'animate-spin origin-center' : 'transition-[stroke-dashoffset] duration-300 ease-out'}
            style={{ transformOrigin: '48px 48px' }}
          />
          <defs>
            <linearGradient id="asset3d-loading-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isProcessing ? (
            <Box className="w-6 h-6 text-cyan-400 animate-pulse" />
          ) : hasTotal ? (
            <span className="text-emerald-400 text-lg font-bold tabular-nums">{percent}%</span>
          ) : (
            <Box className="w-6 h-6 text-emerald-400 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <div className="text-white text-sm font-medium tracking-wide">
          {isProcessing ? 'Preparing 3D model…' : label || (countMode ? 'Loading 3D environment…' : 'Loading 3D asset…')}
        </div>
        {countMode ? (
          <div className="text-white/50 text-xs tabular-nums">
            {totalCount > 0 ? `${loadedCount} of ${totalCount} 3D object${totalCount === 1 ? '' : 's'} ready` : 'Preparing 3D objects…'}
          </div>
        ) : isProcessing ? (
          <div className="text-white/50 text-xs">Decoding geometry &amp; textures</div>
        ) : hasTotal ? (
          <div className="text-white/50 text-xs tabular-nums">
            {formatMB(loaded)} MB / {formatMB(total as number)} MB
          </div>
        ) : (
          <div className="text-white/50 text-xs">{formatMB(loaded)} MB downloaded</div>
        )}
      </div>
    </div>
  );
}

export type Asset3DLoadingOverlayProps = Asset3DLoadingCardProps;

/**
 * Byte-accurate 3D asset loading indicator, shared across every lesson player
 * surface (VRLessonPlayer, VRLessonPlayerKrpano, AssetViewerWithSkybox) so the
 * loading experience is identical regardless of which dashboard launched it.
 *
 * Must be rendered inside an @react-three/fiber <Canvas> (uses drei's <Html>).
 * Outside a Canvas (e.g. next to krpano's own container div), use <Asset3DLoadingCard> directly.
 */
export function Asset3DLoadingOverlay(props: Asset3DLoadingOverlayProps) {
  return (
    <Html center zIndexRange={[100, 0]}>
      <Asset3DLoadingCard {...props} />
    </Html>
  );
}
