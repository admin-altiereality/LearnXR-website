import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ChatHistory } from './ChatHistory';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface Thread {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messages: Message[];
  generationData?: {
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
  };
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  setBackgroundSkybox?: (skybox: any) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onToggle, setBackgroundSkybox }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatSidebarOpen', isOpen.toString());
  }, [isOpen]);

  // Load generation history from Firebase
  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔍 ChatSidebar: Loading generation history for user:', user.uid);

    // Query skyboxes collection
    const skyboxesRef = collection(db, 'skyboxes');
    const skyboxQuery = query(
      skyboxesRef,
      where('userId', '==', user.uid)
    );

    // Query unified_jobs collection
    const jobsRef = collection(db, 'unified_jobs');
    const jobsQuery = query(
      jobsRef,
      where('userId', '==', user.uid)
    );

    let skyboxUnsubscribe: (() => void) | null = null;
    let jobsUnsubscribe: (() => void) | null = null;
    let skyboxData: any[] = [];
    let jobsData: any[] = [];

    const processAndTransformData = () => {
      try {
        // Combine all data
        const allGenerations = [...skyboxData, ...jobsData];

        // Sort by createdAt (newest first)
        allGenerations.sort((a, b) => {
          const getTimestamp = (item: any): number => {
            const createdAt = item.createdAt || item.created_at;
            if (createdAt?.toDate) {
              return createdAt.toDate().getTime();
            }
            if (createdAt?.seconds) {
              return createdAt.seconds * 1000;
            }
            if (typeof createdAt === 'string') {
              return new Date(createdAt).getTime();
            }
            if (createdAt instanceof Date) {
              return createdAt.getTime();
            }
            return 0;
          };

          const aTime = getTimestamp(a);
          const bTime = getTimestamp(b);
          return bTime - aTime; // Descending order (newest first)
        });

        // Transform generations into threads
        const transformedThreads: Thread[] = allGenerations.map((gen) => {
          const createdAt = gen.createdAt || gen.created_at;
          let timestamp: Date;
          
          if (createdAt?.toDate) {
            timestamp = createdAt.toDate();
          } else if (createdAt?.seconds) {
            timestamp = new Date(createdAt.seconds * 1000);
          } else if (typeof createdAt === 'string') {
            timestamp = new Date(createdAt);
          } else if (createdAt instanceof Date) {
            timestamp = createdAt;
          } else {
            timestamp = new Date();
          }

          // Get the original user prompt (what user actually typed)
          // In Firebase, the real prompt is stored as 'title' and 'promptUsed'
          // Priority: title > promptUsed > originalPrompt > prompt > uiState.prompt
          const originalPrompt = gen.title || gen.promptUsed || gen.originalPrompt || gen.userPrompt || gen.original_prompt || gen.user_prompt || '';
          const processedPrompt = gen.prompt || gen.uiState?.prompt || '';
          // Always prefer title/promptUsed (user's actual input from Firebase)
          // Otherwise use processed prompt as fallback
          const prompt = originalPrompt || processedPrompt;
          const title = gen.title || prompt || 'Untitled Generation';
          const preview = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;

          // Create messages from generation data - use original prompt for user message
          const messages: Message[] = [
            {
              id: `${gen.id}_user`,
              content: prompt || 'Generated content',
              role: 'user',
              timestamp
            }
          ];

          // Add assistant response if available
          if (gen.status === 'completed' && (gen.imageUrl || gen.file_url || gen.result)) {
            const resultText = gen.status === 'completed' 
              ? `Generation completed successfully.${gen.metadata?.artStyle ? ` Style: ${gen.metadata.artStyle}` : ''}`
              : `Generation ${gen.status}.`;
            
            messages.push({
              id: `${gen.id}_assistant`,
              content: resultText,
              role: 'assistant',
              timestamp: new Date(timestamp.getTime() + 1000) // 1 second after user message
            });
          }

          // Determine jobId - for unified_jobs, use id; for skyboxes, use id or generationId
          const jobId = gen.source === 'unified_jobs' 
            ? (gen.jobId || gen.id)
            : (gen.id || gen.generationId || gen.jobId);

          // Extract 3D asset data if available (from unified_jobs)
          const meshResult = gen.meshResult || gen.mesh_result;
          const has3DAsset = !!(meshResult || gen.meshUrl || gen.mesh_url);
          const assetDownloadUrl = meshResult?.downloadUrl || meshResult?.download_url || gen.meshUrl || gen.mesh_url;
          const assetPreviewUrl = meshResult?.previewUrl || meshResult?.preview_url;
          const assetFormat = meshResult?.format || gen.format || 'glb';
          const assetStatus = meshResult?.status || gen.status;

          return {
            id: gen.id || gen.jobId || `gen_${Date.now()}`,
            title,
            preview,
            timestamp,
            messages,
            generationData: {
              prompt: prompt,
              styleId: gen.style_id || gen.metadata?.style_id,
              styleName: gen.style_name || gen.styleName || gen.metadata?.style_name,
              imageUrl: gen.imageUrl || gen.image || gen.file_url,
              jobId: jobId,
              status: gen.status,
              metadata: gen.metadata,
              source: gen.source,
              // 3D Asset data
              has3DAsset: has3DAsset,
              assetDownloadUrl: assetDownloadUrl,
              assetPreviewUrl: assetPreviewUrl,
              assetFormat: assetFormat,
              assetStatus: assetStatus,
              meshResult: meshResult
            }
          };
        });

        console.log(`✅ ChatSidebar: Loaded ${transformedThreads.length} threads from Firebase`);
        setThreads(transformedThreads);
        setLoading(false);
        
        // Set first thread as active if available and no active thread is set
        setActiveThreadId(prev => {
          if (prev) return prev; // Keep existing active thread
          return transformedThreads.length > 0 ? transformedThreads[0].id : null;
        });
      } catch (err) {
        console.error('❌ ChatSidebar: Error processing generation data:', err);
        setLoading(false);
      }
    };

    // Listen to skyboxes
    skyboxUnsubscribe = onSnapshot(
      skyboxQuery,
      (snapshot) => {
        console.log(`📦 ChatSidebar: Received ${snapshot.docs.length} skybox documents`);
        skyboxData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'skyboxes'
        }));
        processAndTransformData();
      },
      (error) => {
        console.error('❌ ChatSidebar: Error fetching skyboxes:', error);
        setLoading(false);
      }
    );

    // Listen to unified_jobs
    jobsUnsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        console.log(`📦 ChatSidebar: Received ${snapshot.docs.length} job documents`);
        jobsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'unified_jobs'
        }));
        processAndTransformData();
      },
      (error) => {
        console.error('❌ ChatSidebar: Error fetching jobs:', error);
        setLoading(false);
      }
    );

    // Cleanup subscriptions
    return () => {
      if (skyboxUnsubscribe) skyboxUnsubscribe();
      if (jobsUnsubscribe) jobsUnsubscribe();
    };
  }, [user?.uid]);

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    
    // Get the thread data
    const selectedThread = threads.find(t => t.id === id);
    if (selectedThread) {
      const genData = selectedThread.generationData;
      
      // In Firebase, the real prompt is stored as 'title' and 'promptUsed'
      // Use title first (as it contains the original user input), then promptUsed, then fallback to prompt
      const originalPrompt = selectedThread.title || genData?.prompt || '';
      
      // Navigate to main page with prompt and style pre-filled
      navigate('/main', {
        state: {
          prompt: originalPrompt,
          styleId: genData?.styleId,
          styleName: genData?.styleName,
          jobId: genData?.jobId,
          imageUrl: genData?.imageUrl, // Include imageUrl for variations
          has3DAsset: genData?.has3DAsset || (genData?.status === 'completed' && genData?.jobId),
          assetDownloadUrl: genData?.assetDownloadUrl,
          assetPreviewUrl: genData?.assetPreviewUrl,
          assetFormat: genData?.assetFormat,
          assetStatus: genData?.assetStatus,
          meshResult: genData?.meshResult,
          fromSidebar: true,
          threadId: id
        }
      });
    }
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    // Navigate to main page with empty state to start a new generation
    navigate('/main', {
      state: {
        fromSidebar: true,
        newChat: true
      }
    });
  };

  const handleDeleteThread = (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id) {
      const remaining = threads.filter(t => t.id !== id);
      setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleRenameThread = (id: string, newTitle: string) => {
    setThreads(prev =>
      prev.map(thread =>
        thread.id === id ? { ...thread, title: newTitle } : thread
      )
    );
  };

  const handleSendMessage = async (message: string, threadId: string) => {
    // Get the current thread to preserve style information
    const currentThread = threads.find(t => t.id === threadId);
    const genData = currentThread?.generationData;

    // Add user message to the thread immediately
    const newUserMessage: Message = {
      id: `msg_${Date.now()}_user`,
      content: message,
      role: 'user',
      timestamp: new Date()
    };

    // Update thread with new message
    setThreads(prev =>
      prev.map(thread =>
        thread.id === threadId
          ? {
              ...thread,
              messages: [...thread.messages, newUserMessage],
              preview: message.length > 50 ? message.substring(0, 50) + '...' : message
            }
          : thread
      )
    );

    // Navigate to main page with the prompt and style pre-filled
    navigate('/main', { 
      state: { 
        prompt: message,
        styleId: genData?.styleId,
        styleName: genData?.styleName,
        fromSidebar: true,
        threadId: threadId
      } 
    });
  };

  const handleApplyAsBackground = (skyboxData: any) => {
    if (setBackgroundSkybox) {
      setBackgroundSkybox(skyboxData);
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-[10001] flex items-center space-x-2';
      successMessage.innerHTML = `
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span>Skybox applied as background!</span>
      `;
      document.body.appendChild(successMessage);
      
      // Remove the message after 2 seconds
      setTimeout(() => {
        if (successMessage.parentNode) {
          successMessage.parentNode.removeChild(successMessage);
        }
      }, 2000);
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] sm:hidden transition-opacity duration-500"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar - Editorial thinking space, not a chat widget */}
      <div
        className={`
          fixed top-0 left-0 h-full z-[1000]
          flex flex-col
          backdrop-blur-xl
          bg-gradient-to-b from-[#0a0a0a]/98 via-[#0a0a0a]/95 to-[#0a0a0a]/98
          border-r border-[#ffffff]/10
          overflow-hidden
          transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          shadow-[4px_0_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]
          ${isOpen 
            ? 'w-full sm:w-[240px] md:w-[260px] lg:w-[280px] xl:w-[300px] 2xl:w-[320px]' 
            : 'w-[48px] sm:w-[56px] md:w-[64px]'
          }
        `}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.1) rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Layered background with grain texture */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at top left, rgba(14, 165, 233, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at bottom right, rgba(139, 92, 246, 0.02) 0%, transparent 50%),
              repeating-linear-gradient(
                0deg,
                rgba(255, 255, 255, 0.02) 0px,
                transparent 1px,
                transparent 2px,
                rgba(255, 255, 255, 0.02) 3px
              )
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 4px',
            opacity: 0.4
          }}
        />
        
        {/* Soft vignette at edges */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/5 via-transparent to-transparent" />
        
        {/* Subtle shadow separating sidebar from page */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-px pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)'
          }}
        />

        {/* Content - History panel with messages */}
        <div className="relative flex-1 flex flex-col overflow-hidden w-full">
          <ChatHistory
            threads={threads.map(t => ({
              id: t.id,
              title: t.title,
              preview: t.preview,
              timestamp: t.timestamp,
              isActive: t.id === activeThreadId
            }))}
            activeThreadId={activeThreadId}
            activeThreadMessages={activeThreadId ? threads.find(t => t.id === activeThreadId)?.messages || [] : []}
            activeThreadGenerationData={activeThreadId ? threads.find(t => t.id === activeThreadId)?.generationData : undefined}
            onSelectThread={handleSelectThread}
            onDeleteThread={handleDeleteThread}
            onRenameThread={handleRenameThread}
            onNewChat={handleNewChat}
            onSendMessage={handleSendMessage}
            onApplyAsBackground={handleApplyAsBackground}
            onToggle={onToggle}
            isOpen={isOpen}
            loading={loading}
          />
        </div>
      </div>
    </>
  );
};
