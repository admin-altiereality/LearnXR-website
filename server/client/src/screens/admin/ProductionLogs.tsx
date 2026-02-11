/**
 * Production Logs Viewer
 * 
 * Admin interface for viewing production logs stored in Firestore
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp, where, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminOnly, isSuperadmin } from '../../utils/rbac';
import { AlertCircle, Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { LogLevel } from '../../services/productionLogger';

/** Firestore may return Timestamp, { seconds, nanoseconds }, or ISO string */
type TimestampLike = Timestamp | { seconds: number; nanoseconds: number } | string | number;

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  context?: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  url?: string;
  userAgent?: string;
  timestamp: TimestampLike;
  sessionId?: string;
}

export default function ProductionLogs() {
  const { user, profile, profileLoading } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState<string>('');

  // Wait for profile to load before deciding access
  if (profileLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-border border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check permissions (admin and superadmin can view)
  const canViewLogs = profile && (isAdminOnly(profile) || isSuperadmin(profile));
  if (!profile || !canViewLogs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-24">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can view production logs.</p>
        </div>
      </div>
    );
  }

  const fetchLogs = async (loadMore = false) => {
    try {
      setLoading(true);
      setError(null);

      let q = query(
        collection(db, 'production_logs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      // Apply level filter
      if (levelFilter !== 'all') {
        q = query(q, where('level', '==', levelFilter));
      }

      // Apply context filter
      if (contextFilter) {
        q = query(q, where('context', '==', contextFilter));
      }

      // Pagination
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const newLogs: LogEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as LogEntry[];

      if (loadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 50);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, contextFilter]);

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'critical':
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warn':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'info':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'debug':
        return 'text-muted-foreground bg-slate-500/10 border-slate-500/20';
      default:
        return 'text-muted-foreground bg-slate-500/10 border-slate-500/20';
    }
  };

  const formatTimestamp = (timestamp: TimestampLike): string => {
    if (!timestamp) return '—';
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
    }
    if (typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate().toLocaleString();
    }
    const t = timestamp as { seconds: number; nanoseconds?: number };
    if (typeof t.seconds === 'number') {
      const date = new Date(t.seconds * 1000 + (t.nanoseconds ?? 0) / 1e6);
      return date.toLocaleString();
    }
    return '—';
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.context?.toLowerCase().includes(query) ||
      log.userEmail?.toLowerCase().includes(query) ||
      log.error?.message?.toLowerCase().includes(query)
    );
  });

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `production-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Production Logs</h1>
          <p className="text-muted-foreground">View and debug production errors and events</p>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}
              className="px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            {/* Context Filter */}
            <input
              type="text"
              placeholder="Filter by context..."
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
              className="px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs()}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={exportLogs}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Logs List */}
        {loading && logs.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No logs found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`bg-card rounded-lg border ${getLevelColor(log.level)} p-4`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                    {log.context && (
                      <span className="text-xs text-muted-foreground">[{log.context}]</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  {log.userEmail && (
                    <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                  )}
                </div>

                <p className="text-foreground mb-2">{log.message}</p>

                {log.error && (
                  <div className="mt-3 p-3 bg-slate-800/50 rounded border border-slate-700/50">
                    <p className="text-sm text-red-400 font-semibold mb-1">
                      {log.error.name}: {log.error.message}
                    </p>
                    {log.error.code && (
                      <p className="text-xs text-muted-foreground mb-2">Code: {log.error.code}</p>
                    )}
                    {log.error.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/80">
                          Stack Trace
                        </summary>
                        <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-48">
                          {log.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/80">
                      Metadata
                    </summary>
                    <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-32">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {log.url && (
                    <span>URL: {log.url}</span>
                  )}
                  {log.sessionId && (
                    <span>Session: {log.sessionId}</span>
                  )}
                  {log.userId && (
                    <span>User ID: {log.userId}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchLogs(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      Load More
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
