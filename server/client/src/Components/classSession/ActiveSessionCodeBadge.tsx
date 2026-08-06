import { FaCopy, FaUsers } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useClassSession } from '../../contexts/ClassSessionContext';

interface ActiveSessionCodeBadgeProps {
  role: 'partner' | 'student';
}

export const ActiveSessionCodeBadge = ({ role }: ActiveSessionCodeBadgeProps) => {
  const { activeSession, joinedSession } = useClassSession();
  const session = role === 'partner' ? activeSession : joinedSession;

  if (!session || session.status === 'ended') return null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.session_code);
      toast.success('Class code copied');
    } catch {
      toast.error('Could not copy class code');
    }
  };

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl border border-teal-400/35 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-xl sm:right-6 sm:top-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
        <FaUsers className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {role === 'partner' ? 'Live class code' : 'Joined class'}
        </p>
        <p className="font-mono text-sm font-bold tracking-[0.18em] text-foreground">{session.session_code}</p>
      </div>
      <button
        type="button"
        onClick={copyCode}
        className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        aria-label="Copy class session code"
      >
        <FaCopy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
