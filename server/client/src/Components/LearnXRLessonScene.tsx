import React, { useState, useRef } from 'react';
import { TeacherAvatar } from './TeacherAvatar';

interface LearnXRLessonSceneProps {
  lessonContent?: {
    title?: string;
    chapter?: string;
    subtopic?: string;
    content?: string;
  };
  avatarModelUrl?: string;
  onLessonComplete?: () => void;
}

export const LearnXRLessonScene: React.FC<LearnXRLessonSceneProps> = ({
  lessonContent,
  avatarModelUrl = '/models/avatar3.glb',
  onLessonComplete
}) => {
  const [studentQuestion, setStudentQuestion] = useState('');
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'student' | 'teacher';
    message: string;
    timestamp: Date;
  }>>([]);
  const teacherAvatarRef = useRef<{ sendMessage: (message: string) => Promise<void> }>(null);

  // Handle avatar ready callback
  const handleAvatarReady = () => {
    setIsAvatarReady(true);
  };

  const handleTeacherMessage = (message: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'student',
      message,
      timestamp: new Date()
    }]);
  };

  const handleTeacherResponse = (response: string) => {
    setConversationHistory(prev => [...prev, {
      type: 'teacher',
      message: response,
      timestamp: new Date()
    }]);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentQuestion.trim()) return;

    const question = studentQuestion.trim();
    setStudentQuestion('');
    
    // Add student question to history
    setConversationHistory(prev => [...prev, {
      type: 'student',
      message: question,
      timestamp: new Date()
    }]);

    // Send to teacher avatar
    if (teacherAvatarRef.current) {
      try {
        await teacherAvatarRef.current.sendMessage(question);
      } catch (error) {
        console.error('Error sending message to teacher:', error);
      }
    }
  };

  // Initialize lesson with greeting
  React.useEffect(() => {
    if (lessonContent && teacherAvatarRef.current) {
      const greeting = `Hello! Today we're learning about ${lessonContent.title || lessonContent.subtopic || 'this topic'}. ${lessonContent.content ? `Let's start with: ${lessonContent.content.substring(0, 100)}...` : 'Are you ready to begin?'}`;
      
      setTimeout(() => {
        teacherAvatarRef.current?.sendMessage(greeting).catch(console.error);
      }, 1000);
    }
  }, [lessonContent]);

  return (
    <div className="learnxr-lesson-scene w-full h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-md p-4 z-10">
        <h1 className="text-2xl font-bold text-gray-800">
          {lessonContent?.title || 'LearnXR Lesson'}
        </h1>
        {lessonContent?.chapter && (
          <p className="text-sm text-gray-600 mt-1">
            Chapter: {lessonContent.chapter}
          </p>
        )}
        {lessonContent?.subtopic && (
          <p className="text-sm text-gray-600">
            Topic: {lessonContent.subtopic}
          </p>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
        {/* 3D Avatar Section */}
        <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
          <TeacherAvatar
            ref={teacherAvatarRef}
            avatarModelUrl={avatarModelUrl}
            onMessage={handleTeacherMessage}
            onResponse={handleTeacherResponse}
            onReady={handleAvatarReady}
            position={[0, 0, 0]}
            className="w-full h-full"
          />
        </div>

        {/* Conversation Panel */}
        <div className="w-full md:w-96 bg-white rounded-lg shadow-lg flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Conversation</h2>
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversationHistory.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>Start a conversation with your teacher!</p>
                <p className="text-sm mt-2">Ask questions about the lesson topic.</p>
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
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmitQuestion} className="flex gap-2">
              <input
                type="text"
                value={studentQuestion}
                onChange={(e) => setStudentQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!isAvatarReady}
              />
              <button
                type="submit"
                disabled={!studentQuestion.trim() || !isAvatarReady}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isAvatarReady ? 'Ask' : '...'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

