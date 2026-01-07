import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherAvatar } from './TeacherAvatar';
import { getApiBaseUrl } from '../utils/apiConfig';

interface AvatarSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AssistantConfig {
  curriculum: string;
  class: string;
  subject: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string; // Unique ID to prevent duplicates
}

const CURRICULUMS = ['NCERT', 'CBSE', 'ICSE', 'State Board'];
const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Social Studies',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Computer Science'
];

export const AvatarSidePanel: React.FC<AvatarSidePanelProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AssistantConfig>({
    curriculum: '',
    class: '',
    subject: ''
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const avatarRef = useRef<{ sendMessage: (message: string) => Promise<void> } | null>(null);
  const greetingSentRef = useRef<boolean>(false);

  // Initialize thread when panel opens
  useEffect(() => {
    if (isOpen && !threadId) {
      initializeThread();
    }
  }, [isOpen]);

  // Re-initialize thread when config changes (but only if all three are selected)
  useEffect(() => {
    if (isOpen && config.curriculum && config.class && config.subject) {
      // Reset greeting flag when config changes
      greetingSentRef.current = false;
      
      if (threadId) {
        // Config changed, create new thread
        setThreadId(null);
        setMessages([]);
        setIsAvatarReady(false);
      }
      initializeThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.curriculum, config.class, config.subject]);

  // Send greeting message when all three are selected and thread is ready (don't wait for avatar)
  useEffect(() => {
    if (
      isOpen &&
      config.curriculum &&
      config.class &&
      config.subject &&
      threadId &&
      !greetingSentRef.current &&
      !isLoading
    ) {
      // Wait a moment for the thread to be fully ready, but don't wait for avatar
      const timer = setTimeout(() => {
        // Check if avatar ref is available, if not, we'll send directly via API
        if (avatarRef.current) {
          // Send via avatar component if available
          greetingSentRef.current = true;
          setIsLoading(true);
          
          // Add "Hello" as user message
          const helloMessageId = `hello-${Date.now()}`;
          setMessages(prev => [...prev, { 
            role: 'user', 
            content: 'Hello', 
            id: helloMessageId 
          }]);
          
          // Send "Hello" to trigger the assistant's greeting response
          avatarRef.current.sendMessage('Hello')
            .catch((error) => {
              console.error('❌ Error sending greeting trigger:', error);
              setIsLoading(false);
              greetingSentRef.current = false; // Reset so we can try again
              // Remove the hello message if it failed
              setMessages(prev => prev.filter(msg => msg.id !== helloMessageId));
            });
        } else {
          // Avatar not ready yet, send directly via API
          greetingSentRef.current = true;
          setIsLoading(true);
          
          // Add "Hello" as user message
          const helloMessageId = `hello-${Date.now()}`;
          setMessages(prev => [...prev, { 
            role: 'user', 
            content: 'Hello', 
            id: helloMessageId 
          }]);
          
          // Send directly to API
          const apiUrl = getApiBaseUrl();
          fetch(`${apiUrl}/assistant/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              threadId,
              message: 'Hello',
              curriculum: config.curriculum,
              class: config.class,
              subject: config.subject,
              useAvatarKey: true
            })
          })
            .then(async (res) => {
              if (!res.ok) {
                throw new Error(`Failed to send greeting: ${res.status}`);
              }
              const data = await res.json();
              const greetingResponse = data.response;
              
              // Add assistant's greeting response
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === greetingResponse) {
                  return prev; // Already added
                }
                return [...prev, { 
                  role: 'assistant', 
                  content: greetingResponse, 
                  id: `greeting-${Date.now()}` 
                }];
              });
              setIsLoading(false);
            })
            .catch((error) => {
              console.error('❌ Error sending greeting via API:', error);
              setIsLoading(false);
              greetingSentRef.current = false; // Reset so we can try again
              // Remove the hello message if it failed
              setMessages(prev => prev.filter(msg => msg.id !== helloMessageId));
            });
        }
      }, 1000); // Wait 1 second for thread to be ready

      return () => clearTimeout(timer);
    }
  }, [isOpen, config.curriculum, config.class, config.subject, threadId, isLoading]);

  const initializeThread = async () => {
    // Only initialize if all three options are selected
    if (!config.curriculum || !config.class || !config.subject) {
      console.log('⏳ Waiting for all options to be selected...');
      return;
    }

    try {
      setIsAvatarReady(false);
      const apiUrl = getApiBaseUrl();
      console.log('🔗 Creating thread with config:', config);
      
      const response = await fetch(`${apiUrl}/assistant/create-thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculum: config.curriculum,
          class: config.class,
          subject: config.subject,
          useAvatarKey: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to create thread:', response.status, errorText);
        throw new Error(`Failed to create thread: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Thread created:', data.threadId);
      setThreadId(data.threadId);
      setMessages([]); // Clear messages when switching
    } catch (error) {
      console.error('❌ Error initializing thread:', error);
      setMessages([{
        role: 'assistant',
        content: 'Failed to connect to the teacher. Please check your connection and try again.',
        id: `error-${Date.now()}`
      }]);
    }
  };

  const handleConfigChange = (field: keyof AssistantConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Thread will be recreated by useEffect when config changes
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isAvatarReady || !threadId || !avatarRef.current) {
      console.warn('Cannot send message:', { 
        hasInput: !!input.trim(), 
        isLoading, 
        isAvatarReady, 
        threadId, 
        hasRef: !!avatarRef.current 
      });
      return;
    }

    const message = input.trim();
    setInput('');
    setIsLoading(true);
    
    // Add user message to chat (only once, with unique ID)
    const messageId = `user-${Date.now()}-${Math.random()}`;
    setMessages(prev => {
      // Check if this exact message was just added to avoid duplicates
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'user' && lastMessage.content === message) {
        console.log('⚠️ Duplicate user message detected, skipping');
        return prev; // Already added, don't duplicate
      }
      return [...prev, { role: 'user', content: message, id: messageId }];
    });

    try {
      console.log('📤 Sending message to avatar:', message);
      await avatarRef.current.sendMessage(message);
      // Note: onResponse callback will handle adding the assistant message and setting isLoading to false
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.includes('Sorry, I encountered an error')) {
          return prev; // Already added error message
        }
        return [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          id: `error-${Date.now()}`
        }];
      });
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full lg:w-[420px] bg-gray-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-semibold text-white">Teacher Avatar</h2>
                <p className="text-xs text-gray-400 mt-0.5">Interactive Learning Assistant</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Configuration Selectors */}
            <div className="p-4 space-y-3 border-b border-white/10 bg-gray-800/50">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Curriculum</label>
                <select
                  value={config.curriculum}
                  onChange={(e) => handleConfigChange('curriculum', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="" disabled>Select option</option>
                  {CURRICULUMS.map(cur => (
                    <option key={cur} value={cur}>{cur}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Class</label>
                  <select
                    value={config.class}
                    onChange={(e) => handleConfigChange('class', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="" disabled>Select option</option>
                    {CLASSES.map(cls => (
                      <option key={cls} value={cls}>Class {cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Subject</label>
                  <select
                    value={config.subject}
                    onChange={(e) => handleConfigChange('subject', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="" disabled>Select option</option>
                    {SUBJECTS.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {threadId && config.curriculum && config.class && config.subject && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span>Connected to {config.curriculum} Class {config.class} {config.subject}</span>
                </div>
              )}
              {(!config.curriculum || !config.class || !config.subject) && (
                <div className="flex items-center gap-2 text-xs text-yellow-400">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span>Please select all options to start</span>
                </div>
              )}
            </div>

            {/* Avatar Display */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 p-4 flex items-center justify-center bg-transparent">
                <div className="w-full max-w-sm h-[300px] rounded-lg overflow-hidden border border-white/10 bg-transparent">
                  <TeacherAvatar
                    ref={avatarRef}
                    className="w-full h-full"
                    avatarModelUrl="/models/avatar3.glb"
                    curriculum={config.curriculum}
                    class={config.class}
                    subject={config.subject}
                    useAvatarKey={true}
                    externalThreadId={threadId}
                    onReady={() => {
                      setIsAvatarReady(true);
                    }}
                    onMessage={(message) => {
                      // Don't add user message here - it's already added in handleSend
                      // This callback is just for notification
                      console.log('📨 Message sent:', message);
                    }}
                    onResponse={(response) => {
                      console.log('📬 Response received:', response);
                      const responseId = `assistant-${Date.now()}-${Math.random()}`;
                      setMessages(prev => {
                        // Check if this response is already in the messages to avoid duplicates
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === response) {
                          console.log('⚠️ Duplicate assistant response detected, skipping');
                          return prev; // Already added, don't duplicate
                        }
                        return [...prev, { role: 'assistant', content: response, id: responseId }];
                      });
                      setIsLoading(false);
                    }}
                  />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 border-t border-white/10">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    {config.curriculum && config.class && config.subject ? (
                      <>
                        <p>Waiting for teacher to greet you...</p>
                        <p className="text-xs mt-2 text-gray-500">
                          Selected: {config.curriculum} Class {config.class} {config.subject}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>Please select Curriculum, Class, and Subject</p>
                        <p className="text-xs mt-2 text-gray-500">
                          Once all options are selected, the teacher will greet you automatically
                        </p>
                      </>
                    )}
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id || `msg-${messages.indexOf(msg)}`}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-100 border border-white/10'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1 opacity-70">
                        {msg.role === 'user' ? 'You' : 'Teacher'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-100 border border-white/10 rounded-lg px-3 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/10 bg-gray-900/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && input.trim() && !isLoading && isAvatarReady) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={isLoading || !isAvatarReady || !threadId}
                    className="flex-1 px-4 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || !isAvatarReady || !threadId}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

