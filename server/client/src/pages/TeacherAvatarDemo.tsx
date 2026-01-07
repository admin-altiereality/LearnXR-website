import React, { useRef, useState } from 'react';
import { TeacherAvatar } from '../Components/TeacherAvatar';

/**
 * Demo page for Teacher Avatar with OpenAI Assistant
 * Access at: /teacher-avatar-demo
 */
export const TeacherAvatarDemo: React.FC = () => {
  const avatarRef = useRef<{ sendMessage: (message: string) => Promise<void>; testLipSync: () => void; testBodyMovement: () => void; testLipMovement: () => void }>(null);
  const [question, setQuestion] = useState('');
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'student' | 'teacher';
    message: string;
    timestamp: Date;
  }>>([]);

  // Handle student message (what the student sends)
  const handleStudentMessage = (message: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'student',
      message,
      timestamp: new Date()
    }]);
  };

  // Handle teacher response (what the teacher says back)
  const handleTeacherResponse = (response: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'teacher',
      message: response,
      timestamp: new Date()
    }]);
  };

  // Handle avatar ready callback - send initial greeting
  const handleAvatarReady = () => {
    setIsAvatarReady(true);
    
    // Send initial greeting after a short delay
    if (!hasGreeted && avatarRef.current) {
      setTimeout(() => {
        const greeting = "Hello! I'm your AI teacher. Ask me anything about science, math, history, or any K12 topic. How can I help you learn today?";
        avatarRef.current?.sendMessage(greeting).catch(console.error);
        setHasGreeted(true);
      }, 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !avatarRef.current || !isAvatarReady) return;

    const q = question.trim();
    
    // Add student question to conversation history
    handleStudentMessage(q);
    setQuestion('');
    
    // Send to teacher avatar (which will generate response with speech)
    try {
      await avatarRef.current.sendMessage(q);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Handle sample question clicks
  const handleSampleQuestion = (q: string) => {
    if (!isAvatarReady || !avatarRef.current) return;
    
    // Add to conversation history
    handleStudentMessage(q);
    
    // Send to avatar
    setTimeout(() => {
      avatarRef.current?.sendMessage(q).catch(console.error);
    }, 100);
  };

  const sampleQuestions = [
    "What is photosynthesis?",
    "Explain the water cycle",
    "How does gravity work?",
    "What is the difference between plant and animal cells?",
    "Tell me about the solar system"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Teacher Avatar Demo - LearnXR
          </h1>
          <p className="text-gray-600">
            Interactive AI-powered teacher avatar with lip sync. Ask questions about K12 curriculum topics.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Avatar Section */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">3D Teacher Avatar</h2>
            <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <TeacherAvatar
                ref={avatarRef}
                avatarModelUrl="/models/avatar3.glb"
                onMessage={handleStudentMessage}
                onResponse={handleTeacherResponse}
                onReady={handleAvatarReady}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Conversation Section */}
          <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Conversation</h2>
            
            {/* Conversation History */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-[300px] max-h-[300px]">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>Start a conversation with your teacher!</p>
                  <p className="text-sm mt-2">Try asking about science, math, or any K12 topic.</p>
                </div>
              ) : (
                conversationHistory.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex ${entry.type === 'student' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        entry.type === 'student'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{entry.message}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {entry.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Question Input */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about any topic..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!isAvatarReady}
              />
              <button
                type="submit"
                disabled={!question.trim() || !isAvatarReady}
                className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isAvatarReady ? 'Ask Question' : 'Initializing...'}
              </button>
            </form>

            {/* Test Buttons */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  if (avatarRef.current) {
                    avatarRef.current.testLipSync();
                  }
                }}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!isAvatarReady}
              >
                🧪 Test Lip Sync (No OpenAI Required)
              </button>
              <p className="text-xs text-gray-500 text-center">
                Test if the model can do lip movement
              </p>
              
              <button
                onClick={() => {
                  if (avatarRef.current) {
                    avatarRef.current.testBodyMovement();
                  }
                }}
                className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!isAvatarReady}
              >
                🧪 Test Body Movement (Hands Up/Down)
              </button>
              <p className="text-xs text-gray-500 text-center">
                Test if the model can move hands up and down
              </p>
              
              <button
                onClick={() => {
                  if (avatarRef.current) {
                    avatarRef.current.testLipMovement();
                  }
                }}
                className="w-full px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!isAvatarReady}
              >
                🧪 Test Lip Movement (Mouth Open/Close)
              </button>
              <p className="text-xs text-gray-500 text-center">
                Test if the model can move lips/mouth up and down
              </p>
            </div>
            
            {/* Debug: Test All Blend Shapes */}
            <div className="mt-2">
              <button
                onClick={() => {
                  // This will be handled by AvatarModel
                  console.log('💡 Check console for blend shape test instructions');
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                disabled={!isAvatarReady}
              >
                🔍 Debug: Show All Blend Shapes
              </button>
              <p className="text-xs text-gray-500 text-center">
                Check console to see all available blend shapes
              </p>
            </div>

            {/* Sample Questions */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Try these sample questions:</p>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSampleQuestion(q)}
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isAvatarReady}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to Use</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Type a question in the input field and click "Ask Question"</li>
            <li>The teacher avatar will respond with voice and lip sync</li>
            <li>Click sample questions to quickly test the system</li>
            <li>Make sure your avatar model is placed at <code className="bg-blue-100 px-1 rounded">/models/avatar3.glb</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeacherAvatarDemo;

