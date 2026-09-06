/**
 * PlayerTopBar
 * ------------
 * One bar for everyone. Previously the host's header floated at z-50 directly on
 * top of the player's own top-right control row, which meant a teacher could not
 * reach Play/Pause narration, Mute or Chat at all. Both now live here, once.
 *
 * The top-RIGHT corner of the stage is deliberately left empty by this layout —
 * that is where react-toastify drops its toasts.
 */

import { LogOut, Volume2, VolumeX, MessageCircle, Copy, Users, Bell, X, Square, Glasses, ChevronLeft, ChevronRight } from 'lucide-react';

interface PlayerTopBarProps {
  onExit: () => void;
  title?: string;
  subtitle?: string;
  isMuted: boolean;
  onToggleMute: () => void;
  showChat: boolean;
  onToggleChat: () => void;
  chatAvailable?: boolean;

  // Host-only
  isHost?: boolean;
  sessionCode?: string | null;
  /** Students currently inside the lesson. */
  liveCount?: number;
  /** Students who have joined the session, wherever they are. */
  joinedCount?: number;
  /** Students enrolled in the class. */
  classCount?: number | null;
  pendingCount?: number;
  onCopyCode?: () => void;
  onOpenApprovals?: () => void;
  onEndSession?: () => void;
  /** True once the first End click has armed it; the label becomes a confirmation. */
  endSessionConfirming?: boolean;

  /** Stop the lesson and return to the entry gate. */
  onStopLesson?: () => void;
  /** Enter the headset view (Quest only). */
  onEnterVR?: () => void;
  /** 360 tour stop navigation, when the lesson is a multi-stop tour. */
  tour?: { index: number; total: number; onPrev?: () => void; onNext?: () => void } | null;
  /** 0-100 progress through the lesson phases. */
  progress?: number | null;

  compact?: boolean;
}

export const PlayerTopBar = ({
  onExit,
  title,
  subtitle,
  isMuted,
  onToggleMute,
  showChat,
  onToggleChat,
  chatAvailable = true,
  isHost = false,
  sessionCode,
  liveCount = 0,
  joinedCount = 0,
  classCount,
  pendingCount = 0,
  onCopyCode,
  onOpenApprovals,
  onEndSession,
  endSessionConfirming = false,
  onStopLesson,
  onEnterVR,
  tour = null,
  progress = null,
  compact = false,
}: PlayerTopBarProps) => {
  return (
    <div className="pointer-events-auto flex h-full w-full items-center gap-1.5 border-b border-white/10 bg-zinc-950/80 px-2 backdrop-blur-2xl sm:gap-2 sm:px-3">
      <button
        type="button"
        onClick={onExit}
        title="Leave the lesson"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
      >
        <LogOut className="h-3.5 w-3.5" />
        {!compact && <span>Exit</span>}
      </button>

      <div className="min-w-0 flex-1">
        {title && (
          <p className="truncate text-xs font-semibold text-white sm:text-sm">{title}</p>
        )}
        {subtitle && !compact && (
          <p className="truncate text-[10px] capitalize text-white/45">{subtitle}</p>
        )}
        {progress !== null && (
          <div className="mt-1 h-1 w-full max-w-[12rem] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>

      {isHost && sessionCode && (
        <button
          type="button"
          onClick={onCopyCode}
          title="Copy the class code"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 font-mono text-sm font-bold tracking-[0.16em] text-teal-100 transition hover:bg-white/10 min-[420px]:inline-flex"
        >
          {sessionCode}
          <Copy className="h-3 w-3 text-white/45" />
        </button>
      )}

      {isHost && (
        <span
          title={`${liveCount} in the lesson · ${joinedCount} joined${classCount != null ? ` · ${classCount} enrolled` : ''}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-teal-400/30 bg-teal-400/10 px-2 py-1.5 text-xs font-semibold text-teal-100"
        >
          <Users className="h-3.5 w-3.5" />
          {/* One ratio with a stated meaning, rather than three bare numbers
              ("0/0/15") that a teacher had to decode mid-lesson. The joined but
              not-yet-arrived figure lives in the tooltip and the roster drawer,
              which is where it can actually be acted on. */}
          <span className="tabular-nums">
            {liveCount}
            {classCount != null && <span className="text-teal-100/60"> of {classCount}</span>}
          </span>
          {!compact && <span className="font-medium text-teal-100/70">in lesson</span>}
        </span>
      )}

      {isHost && onOpenApprovals && (
        <button
          type="button"
          onClick={onOpenApprovals}
          title="Join requests"
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/75 transition hover:bg-white/10"
        >
          <Bell className="h-3.5 w-3.5" />
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
              {pendingCount}
            </span>
          )}
        </button>
      )}

      {tour && tour.total > 1 && (
        <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5 sm:flex">
          {tour.onPrev && (
            <button
              type="button"
              onClick={tour.onPrev}
              title="Previous stop"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="px-1 text-[11px] font-semibold tabular-nums text-white/70">
            {tour.index + 1}/{tour.total}
          </span>
          {tour.onNext && (
            <button
              type="button"
              onClick={tour.onNext}
              title="Next stop"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {onEnterVR && (
        <button
          type="button"
          onClick={onEnterVR}
          title="Enter VR"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-purple-400/40 bg-purple-500/20 px-2.5 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/30"
        >
          <Glasses className="h-3.5 w-3.5" />
          {!compact && <span>Enter VR</span>}
        </button>
      )}

      {onStopLesson && (
        <button
          type="button"
          onClick={onStopLesson}
          title="Stop the lesson"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/75 transition hover:bg-white/10"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
          isMuted
            ? 'border-rose-400/40 bg-rose-500/20 text-rose-200'
            : 'border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10'
        }`}
      >
        {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>

      {chatAvailable && (
        <button
          type="button"
          onClick={onToggleChat}
          title="Ask a question"
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
            showChat
              ? 'border-primary/50 bg-primary/20 text-primary'
              : 'border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10'
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      )}

      {isHost && onEndSession && (
        <button
          type="button"
          onClick={onEndSession}
          title={endSessionConfirming ? 'Click again to end for everyone' : 'End the class session for everyone'}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
            endSessionConfirming
              ? 'border-rose-300 bg-rose-500/35 text-white'
              : 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
          }`}
        >
          <X className="h-3.5 w-3.5" />
          {!compact && <span>{endSessionConfirming ? 'Confirm end?' : 'End'}</span>}
        </button>
      )}
    </div>
  );
};
