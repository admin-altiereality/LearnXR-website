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
    has3DAsset?: boolean;
    assetDownloadUrl?: string;
    assetPreviewUrl?: string;
    assetFormat?: string;
    assetStatus?: string;
    meshResult?: any;
  };
}

interface MobileBottomBarProps {
  isOpen: boolean;
  onToggle: () => void;
  setBackgroundSkybox?: (skybox: any) => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({ isOpen, onToggle, setBackgroundSkybox }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load generation history from Firebase
  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔍 MobileBottomBar: Loading generation history for user:', user.uid);

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
      const allThreads: Thread[] = [];

      // Process skyboxes
      // Note: skyboxData is already an array of plain objects (not Firestore docs)
      skyboxData.forEach((item) => {
        // item is already a plain object, not a Firestore document
        const data = item;
        allThreads.push({
          id: item.id || data.id,
          title: data.title || data.prompt || 'Untitled Generation',
          preview: data.prompt || '',
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          messages: [],
          generationData: {
            prompt: data.prompt || data.originalPrompt,
            styleId: data.style_id,
            styleName: data.style_name,
            imageUrl: data.imageUrl,
            jobId: item.id || data.id,
            status: data.status,
            metadata: data.metadata,
            source: 'skybox'
          }
        });
      });

      // Process unified jobs
      // Note: jobsData is already an array of plain objects (not Firestore docs)
      jobsData.forEach((item) => {
        // item is already a plain object, not a Firestore document
        const data = item;
        allThreads.push({
          id: item.id || data.id,
          title: data.prompt || 'Untitled Generation',
          preview: data.prompt || '',
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          messages: [],
          generationData: {
            prompt: data.prompt,
            styleId: data.style_id,
            styleName: data.style_name,
            imageUrl: data.skyboxUrl || data.skyboxResult?.fileUrl,
            jobId: item.id || data.id,
            status: data.status,
            metadata: data.metadata,
            source: 'unified_job',
            has3DAsset: !!data.meshResult || !!data.meshUrl,
            assetDownloadUrl: data.meshResult?.downloadUrl || data.meshUrl,
            assetPreviewUrl: data.meshResult?.previewUrl,
            assetFormat: data.meshResult?.format || 'glb',
            assetStatus: data.meshResult?.status,
            meshResult: data.meshResult
          }
        });
      });

      // Sort by timestamp (newest first)
      allThreads.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setThreads(allThreads);
      setLoading(false);
    };

    skyboxUnsubscribe = onSnapshot(skyboxQuery, (snapshot) => {
      skyboxData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      processAndTransformData();
    }, (error) => {
      console.error('Error loading skyboxes:', error);
      setLoading(false);
    });

    jobsUnsubscribe = onSnapshot(jobsQuery, (snapshot) => {
      jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      processAndTransformData();
    }, (error) => {
      console.error('Error loading jobs:', error);
      setLoading(false);
    });

    return () => {
      if (skyboxUnsubscribe) skyboxUnsubscribe();
      if (jobsUnsubscribe) jobsUnsubscribe();
    };
  }, [user]);

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId === activeThreadId ? null : threadId);
  };

  const handleDeleteThread = (threadId: string) => {
    setThreads(threads.filter(t => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
  };

  const handleRenameThread = (threadId: string, newTitle: string) => {
    setThreads(threads.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    navigate('/main');
  };

  const handleSendMessage = (message: string) => {
    // Handle message sending logic
    console.log('Sending message:', message);
  };

  const handleApplyAsBackground = (skybox: any) => {
    if (setBackgroundSkybox) {
      setBackgroundSkybox(skybox);
      setTimeout(() => {
        onToggle();
      }, 2000);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] md:hidden transition-opacity duration-500"
        onClick={onToggle}
        aria-hidden="true"
      />
      
      {/* Mobile Bottom Bar - Horizontal scrolling like paywall */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-[999] md:hidden
          backdrop-blur-xl
          bg-gradient-to-t from-[#0a0a0a]/98 via-[#0a0a0a]/95 to-[#0a0a0a]/98
          border-t border-[#ffffff]/10
          transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          shadow-[0_-4px_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]
          ${isOpen ? 'h-[70vh]' : 'h-0'}
          overflow-hidden
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
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-transparent via-transparent to-black/10" />
        
        {/* Subtle shadow separating bottom bar from page */}
        <div 
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)'
          }}
        />

        {/* Drag handle */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />

        {/* Content - Horizontal scrolling container */}
        <div className="relative flex-1 flex flex-col overflow-hidden w-full pt-4">
          {/* Horizontal scrollable thread list */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex flex-row h-full">
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
        </div>
      </div>
    </>
  );
};

