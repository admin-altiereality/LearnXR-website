import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChatThread } from './ChatThread';
import { ChatInput } from './ChatInput';
import { useAuth } from '../../contexts/AuthContext';

interface Thread {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  isActive?: boolean;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface GenerationData {
  prompt?: string;
  styleId?: number | string;
  styleName?: string;
  imageUrl?: string;
  jobId?: string;
  status?: string;
  metadata?: any;
  source?: string;
  // 3D Asset fields
  has3DAsset?: boolean;
  assetDownloadUrl?: string;
  assetPreviewUrl?: string;
  assetFormat?: string;
  assetStatus?: string;
  meshResult?: any;
}

interface ChatHistoryProps {
  threads: Thread[];
  activeThreadId: string | null;
  activeThreadMessages?: Message[];
  activeThreadGenerationData?: GenerationData;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  onSendMessage?: (message: string, threadId: string) => void;
  onApplyAsBackground?: (skyboxData: any) => void;
  onClose?: () => void;
  onToggle?: () => void;
  isOpen?: boolean;
  loading?: boolean;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  threads,
  activeThreadId,
  activeThreadMessages = [],
  activeThreadGenerationData,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onNewChat,
  onSendMessage,
  onApplyAsBackground,
  onClose,
  onToggle,
  isOpen = true,
  loading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'threads' | 'messages'>('threads');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (viewMode === 'messages' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThreadMessages, viewMode]);
  
  // Switch to messages view when thread is selected
  useEffect(() => {
    if (activeThreadId) {
      setViewMode('messages');
    } else {
      setViewMode('threads');
    }
  }, [activeThreadId]);
  
  const handleSendMessage = async (message: string) => {
    if (!activeThreadId || !onSendMessage || !message.trim()) return;
    
    setIsSending(true);
    try {
      await onSendMessage(message.trim(), activeThreadId);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Get user initials
  const getUserInitials = () => {
    if (user?.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Group threads by date
  const groupedThreads = useMemo(() => {
    const filtered = threads.filter(thread =>
      thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: { [key: string]: Thread[] } = {
      today: [],
      yesterday: [],
      week: [],
      month: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    filtered.forEach(thread => {
      const threadDate = new Date(thread.timestamp);
      if (threadDate >= today) {
        groups.today.push(thread);
      } else if (threadDate >= yesterday) {
        groups.yesterday.push(thread);
      } else if (threadDate >= weekAgo) {
        groups.week.push(thread);
      } else if (threadDate >= monthAgo) {
        groups.month.push(thread);
      } else {
        groups.older.push(thread);
      }
    });

    return groups;
  }, [threads, searchQuery]);

  const renderGroup = (title: string, groupThreads: Thread[]) => {
    if (groupThreads.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        <h3 className="text-[10px] font-body font-light text-gray-500/60 uppercase tracking-[0.15em] mb-3 px-2 sm:px-3 md:px-4">
          {title}
        </h3>
        <div className="space-y-0.5">
          {groupThreads.map(thread => (
            <ChatThread
              key={thread.id}
              thread={{
                ...thread,
                isActive: thread.id === activeThreadId
              }}
              onClick={() => onSelectThread(thread.id)}
              onDelete={onDeleteThread}
              onRename={onRenameThread}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative min-h-0">
      {/* Header - Editorial, not UI-like */}
      <div className={`px-2 sm:px-3 md:px-4 py-3 sm:py-3.5 border-b border-[#1a1a1a]/30 relative flex-shrink-0 ${!isOpen ? 'px-0 py-4 flex items-center justify-center' : ''}`}>
        {/* Close button - visible when sidebar is open on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="
              absolute top-4 right-4
              w-7 h-7
              rounded
              hover:bg-white/[0.03]
              flex items-center justify-center
              text-gray-500 hover:text-gray-400
              transition-colors duration-300
              md:hidden
            "
            aria-label="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Toggle/New Thread - Editorial approach */}
        {!isOpen ? (
          /* Collapsed state - Minimal, thoughtful */
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded border border-[#1a1a1a]/40 hover:border-[#2a2a2a]/60 bg-transparent hover:bg-white/[0.02] flex items-center justify-center transition-all duration-400 cursor-pointer group"
            aria-label="Expand sidebar"
            style={{ transitionDelay: '0ms' }}
          >
            <svg className="w-4 h-4 text-gray-500/70 group-hover:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.26 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </button>
        ) : (
          <div className="space-y-3">
            {/* Toggle and New Thread - Side by side */}
            <div className="flex items-center gap-2">
              {/* Toggle button */}
              <button
                onClick={onToggle}
                className="w-9 h-9 rounded border border-[#1a1a1a]/40 hover:border-[#2a2a2a]/60 bg-transparent hover:bg-white/[0.02] flex items-center justify-center transition-all duration-400 cursor-pointer group flex-shrink-0"
                aria-label="Collapse sidebar"
              >
                <svg className="w-4 h-4 text-gray-500/70 group-hover:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.26 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
              
              {/* New Thread button - Next to toggle */}
              <button
                onClick={onNewChat}
                className="
                  flex-1 px-3 py-2
                  rounded border border-[#1a1a1a]/40
                  bg-transparent hover:bg-white/[0.02] hover:border-[#2a2a2a]/60
                  flex items-center gap-2
                  text-sm text-gray-400 font-body font-normal
                  transition-all duration-400
                  group
                "
              >
                <span className="text-gray-500/60 group-hover:text-gray-400 transition-colors duration-300 text-base leading-none">+</span>
                <span className="group-hover:text-gray-300 transition-colors duration-300">New thread</span>
              </button>
            </div>
          </div>
        )}

        {/* Search - Editorial input, not chat-like */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="relative mt-2.5"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads"
                className="
                  w-full px-3 py-2 pl-8 pr-3
                  rounded border border-[#1a1a1a]/40
                  bg-transparent
                  focus:border-[#2a2a2a]/60 focus:bg-white/[0.02]
                  text-sm text-gray-300 font-body
                  placeholder:text-gray-500/50
                  transition-all duration-300
                  focus:outline-none
                  h-9
                "
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content area - Threads or Messages */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {viewMode === 'threads' ? (
              /* Thread list view */
              <div className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 py-4 sm:py-5 md:py-6">
                <AnimatePresence>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 -mt-16">
                      <div className="mb-6">
                        <p className="text-sm font-body text-gray-400/60 leading-relaxed">
                          Loading history...
                        </p>
                      </div>
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 -mt-16">
                      {/* Empty state - Editorial, not icon-heavy */}
                      <div className="mb-6">
                        <p className="text-sm font-body text-gray-400/60 leading-relaxed">
                          No generations yet
                        </p>
                        <p className="text-xs font-body text-gray-500/50 mt-2 leading-relaxed">
                          Your generation history will appear here
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {renderGroup('Today', groupedThreads.today)}
                      {renderGroup('Yesterday', groupedThreads.yesterday)}
                      {renderGroup('Previous 7 days', groupedThreads.week)}
                      {renderGroup('Previous 30 days', groupedThreads.month)}
                      {renderGroup('Older', groupedThreads.older)}
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Messages view - Editorial style */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 py-4 sm:py-5 md:py-6">
                {/* Back button */}
                <button
                  onClick={() => setViewMode('threads')}
                  className="mb-4 px-2 py-1.5 rounded border border-[#1a1a1a]/40 hover:border-[#2a2a2a]/60 bg-transparent hover:bg-white/[0.02] flex items-center gap-2 text-xs text-gray-400 font-body transition-all duration-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  <span>Back to threads</span>
                </button>

                {/* Skybox Thumbnail */}
                {activeThreadGenerationData?.imageUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-4"
                  >
                    <div className="relative rounded-lg overflow-hidden border border-[#1a1a1a]/40 bg-[#0a0a0a] group">
                      <img
                        src={activeThreadGenerationData.imageUrl}
                        alt="Generated skybox"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {activeThreadGenerationData.jobId && activeThreadGenerationData.status === 'completed' && (
                        <a
                          href={`/preview/${activeThreadGenerationData.jobId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        >
                          <div className="px-3 py-1.5 rounded border border-white/20 bg-black/60 backdrop-blur-sm text-xs text-white font-body">
                            View in 3D
                          </div>
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Generation Details - Prompt, Style, and Status */}
                {activeThreadGenerationData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6 p-3 sm:p-4 rounded border border-[#1a1a1a]/40 bg-white/[0.02] space-y-3"
                  >
                    {/* Prompt */}
                    {activeThreadGenerationData.prompt && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-body font-light text-gray-500/60 uppercase tracking-wider">
                          Prompt
                        </span>
                        <p className="text-sm font-body text-gray-200 leading-relaxed">
                          {activeThreadGenerationData.prompt}
                        </p>
                      </div>
                    )}

                    {/* Style */}
                    {activeThreadGenerationData.styleName && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-body font-light text-gray-500/60 uppercase tracking-wider">
                          Style
                        </span>
                        <p className="text-sm font-body text-gray-300 leading-relaxed">
                          {activeThreadGenerationData.styleName}
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    {activeThreadGenerationData.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-body font-light text-gray-500/60 uppercase tracking-wider">
                          Status
                        </span>
                        <span className={`text-xs font-body px-2 py-0.5 rounded border ${
                          activeThreadGenerationData.status === 'completed' 
                            ? 'text-emerald-400/80 border-emerald-500/30 bg-emerald-500/10'
                            : activeThreadGenerationData.status === 'pending' || activeThreadGenerationData.status === 'generating'
                            ? 'text-amber-400/80 border-amber-500/30 bg-amber-500/10'
                            : 'text-gray-400/80 border-gray-500/30 bg-gray-500/10'
                        }`}>
                          {activeThreadGenerationData.status}
                        </span>
                      </div>
                    )}

                    {/* Apply as Background Button */}
                    {activeThreadGenerationData.imageUrl && (
                      <div className="pt-2 border-t border-[#1a1a1a]/20">
                        <button
                          onClick={() => {
                            if (onApplyAsBackground && activeThreadGenerationData.imageUrl) {
                              const skyboxData = {
                                image: activeThreadGenerationData.imageUrl,
                                image_jpg: activeThreadGenerationData.imageUrl,
                                title: activeThreadGenerationData.prompt || 'Generated Skybox',
                                prompt: activeThreadGenerationData.prompt || '',
                                metadata: activeThreadGenerationData.metadata || {}
                              };
                              onApplyAsBackground(skyboxData);
                            }
                          }}
                          className="
                            w-full px-3 py-2
                            rounded border border-[#1a1a1a]/40
                            bg-transparent hover:bg-white/[0.02] hover:border-[#2a2a2a]/60
                            flex items-center justify-center gap-2
                            text-sm text-gray-300 font-body font-normal
                            transition-all duration-300
                            group
                          "
                        >
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <span>Apply as Background</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Messages - Editorial layout */}
                <div className="space-y-6">
                  {activeThreadMessages.map((message, index) => {
                    const isUser = message.role === 'user';
                    const formatTime = (date: Date) => {
                      return new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }).format(date);
                    };

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="space-y-2"
                      >
                        {/* Role label - Typographic */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-body font-light text-gray-500/60 uppercase tracking-wider">
                            {isUser ? 'You' : 'Assistant'}
                          </span>
                          <span className="text-[10px] text-gray-500/40">·</span>
                          <span className="text-[10px] font-body text-gray-500/50">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>

                        {/* Message content - Editorial paragraph style */}
                        <div className={`
                          text-sm font-body leading-relaxed
                          ${isUser ? 'text-gray-200' : 'text-gray-300'}
                        `}>
                          <p className="whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>

                        {/* Divider - Subtle */}
                        {index < activeThreadMessages.length - 1 && (
                          <div className="pt-4 border-t border-[#1a1a1a]/20" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Empty messages state */}
                {activeThreadMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center px-6 py-8">
                    <div className="mb-6">
                      <p className="text-sm font-body text-gray-400/60 leading-relaxed">
                        No messages yet
                      </p>
                      <p className="text-xs font-body text-gray-500/50 mt-2 leading-relaxed">
                        Start the conversation
                      </p>
                    </div>
                  </div>
                )}
                
                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Chat Input */}
                {activeThreadId && (
                  <div className="border-t border-[#1a1a1a]/30 flex-shrink-0">
                    <ChatInput
                      onSend={handleSendMessage}
                      isStreaming={isSending}
                      placeholder="Continue the conversation or create a new generation..."
                      disabled={isSending}
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Section - Bottom - Always visible, editorial */}
      <div className="border-t border-[#1a1a1a]/30 p-4 mt-auto flex-shrink-0">
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 px-2 py-2 rounded border border-transparent hover:border-[#1a1a1a]/40 hover:bg-white/[0.02] transition-all duration-400 cursor-pointer group"
            >
              {/* User Avatar - Subtle, not gradient-heavy */}
              <div className="w-8 h-8 rounded border border-[#1a1a1a]/40 bg-[#1a1a1a]/20 flex items-center justify-center flex-shrink-0">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="w-full h-full rounded object-cover"
                  />
                ) : (
                  <span className="text-xs font-body font-medium text-gray-400">
                    {getUserInitials()}
                  </span>
                )}
              </div>
              
              {/* User Name - Typographic */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-normal text-gray-300 truncate group-hover:text-gray-200 transition-colors duration-300">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs font-body text-gray-500/60 truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center justify-center"
            >
              <div 
                onClick={() => navigate('/profile')}
                className="w-9 h-9 rounded border border-[#1a1a1a]/40 bg-[#1a1a1a]/20 flex items-center justify-center cursor-pointer hover:border-[#2a2a2a]/60 transition-all duration-400"
              >
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="w-full h-full rounded object-cover"
                  />
                ) : (
                  <span className="text-xs font-body font-medium text-gray-400">
                    {getUserInitials()}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
