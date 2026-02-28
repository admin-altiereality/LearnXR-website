/**
 * Reusable school code display: easy to copy, professional layout.
 * Use on dashboards and in sidebar (expanded or collapsed).
 */

import { useState, useCallback } from 'react';
import { FaCopy } from 'react-icons/fa';
import { Button } from './ui/button';
import { toast } from 'react-toastify';

interface SchoolCodeBlockProps {
  code: string;
  /** 'dashboard' = full label + input + Copy button; 'sidebar' = compact for sidebar when expanded */
  variant: 'dashboard' | 'sidebar';
  className?: string;
}

export function SchoolCodeBlock({ code, variant, className = '' }: SchoolCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('School code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  }, [code]);

  if (variant === 'dashboard') {
    return (
      <div className={`inline-flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          School code
        </span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={code}
            className="h-9 min-w-[7rem] max-w-[8rem] rounded-lg border border-border bg-muted/50 px-3 font-mono text-sm font-semibold tracking-wider text-foreground select-all"
            aria-label="School code"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 h-9 gap-1.5"
            onClick={copyCode}
          >
            <FaCopy className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    );
  }

  // Sidebar: compact single row
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2 py-1.5 ${className}`}>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">School code</p>
        <p className="font-mono text-xs font-semibold tracking-wider text-sidebar-foreground truncate">
          {code}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
        onClick={copyCode}
        aria-label="Copy school code"
      >
        <FaCopy className="h-3 w-3" />
      </Button>
    </div>
  );
}
