import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Floating MCQ Panel Component
 * Displays MCQs from lesson topics in a floating panel in the right corner
 */
const LessonMCQPanel = ({ chapter, isVisible, onClose }) => {
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentMCQIndex, setCurrentMCQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});
  const [isMinimized, setIsMinimized] = useState(true); // Minimized by default

  // Extract all MCQs from all topics
  const allMCQs = React.useMemo(() => {
    if (!chapter?.topics) return [];
    
    const mcqs = [];
    chapter.topics.forEach((topic, topicIdx) => {
      // Extract MCQs 1-5 from each topic
      for (let i = 1; i <= 5; i++) {
        const questionKey = `mcq${i}_question`;
        const questionIdKey = `mcq${i}_question_id`;
        
        if (topic[questionKey]) {
          mcqs.push({
            id: topic[questionIdKey] || `${topic.topic_id}_mcq${i}`,
            topicIndex: topicIdx,
            topicId: topic.topic_id,
            topicName: topic.topic_name,
            question: topic[questionKey],
            options: [
              topic[`mcq${i}_option1`],
              topic[`mcq${i}_option2`],
              topic[`mcq${i}_option3`],
              topic[`mcq${i}_option4`]
            ].filter(Boolean),
            correctIndex: topic[`mcq${i}_correct_option_index`] - 1, // Convert to 0-based
            correctText: topic[`mcq${i}_correct_option_text`],
            explanation: topic[`mcq${i}_explanation`],
            mcqNumber: i
          });
        }
      }
    });
    
    return mcqs;
  }, [chapter]);

  // Reset state when chapter changes
  useEffect(() => {
    if (chapter) {
      setCurrentTopicIndex(0);
      setCurrentMCQIndex(0);
      setSelectedAnswers({});
      setShowResults({});
    }
  }, [chapter?.id]);

  if (!isVisible || !chapter || allMCQs.length === 0) {
    return null;
  }

  const currentMCQ = allMCQs[currentMCQIndex];
  const currentTopic = chapter.topics[currentTopicIndex];
  const selectedAnswer = selectedAnswers[currentMCQ?.id];
  const hasResult = showResults[currentMCQ?.id] !== undefined;
  const isCorrect = hasResult && selectedAnswer === currentMCQ?.correctIndex;

  const handleAnswerSelect = (optionIndex) => {
    if (hasResult) return; // Don't allow changing answer after submission
    
    setSelectedAnswers(prev => ({
      ...prev,
      [currentMCQ.id]: optionIndex
    }));
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === undefined) return;
    
    setShowResults(prev => ({
      ...prev,
      [currentMCQ.id]: selectedAnswer === currentMCQ.correctIndex
    }));
  };

  const handleNext = () => {
    if (currentMCQIndex < allMCQs.length - 1) {
      setCurrentMCQIndex(prev => prev + 1);
      setSelectedAnswers(prev => {
        const nextMCQ = allMCQs[currentMCQIndex + 1];
        return prev[nextMCQ.id] !== undefined ? prev : prev;
      });
    }
  };

  const handlePrevious = () => {
    if (currentMCQIndex > 0) {
      setCurrentMCQIndex(prev => prev - 1);
    }
  };

  const correctCount = Object.values(showResults).filter(r => r === true).length;
  const answeredCount = Object.keys(showResults).length;
  const totalMCQs = allMCQs.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          x: 0
        }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`fixed z-[40] transition-all duration-500 ease-out ${
          isMinimized 
            ? 'bottom-4 right-4 sm:bottom-6 sm:right-6' 
            : 'right-4 top-4 sm:right-6 sm:top-6 md:right-8 md:top-8'
        }`}
        style={{ 
          maxHeight: isMinimized ? 'auto' : 'calc(100vh - 2rem)',
          maxWidth: isMinimized 
            ? 'min(320px, calc(100vw - 2rem))' 
            : 'min(420px, calc(100vw - 4rem - 350px))', // Account for avatar space
          width: isMinimized 
            ? 'min(320px, calc(100vw - 2rem))' 
            : 'min(420px, calc(100vw - 4rem - 350px))'
        }}
      >
        <div 
          className="bg-black/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#ffffff]/10 overflow-hidden transition-all duration-500 w-full"
          style={{
            maxHeight: isMinimized ? 'none' : 'calc(100vh - 2rem)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between ${isMinimized ? 'p-3' : 'p-4'} bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-b border-[#ffffff]/10 transition-all duration-300 flex-shrink-0`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-white text-sm truncate">
                  {isMinimized ? 'MCQ Quiz' : chapter.chapter_name}
                </h3>
                {!isMinimized && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {currentTopic?.topic_name || 'Practice Questions'}
                  </p>
                )}
                {isMinimized && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-cyan-400 font-semibold">
                      {answeredCount}/{totalMCQs}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      {correctCount} correct
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all duration-200 hover:scale-110"
                title="Close"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Minimized View */}
          {isMinimized && (
            <div className="p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs text-gray-400 font-medium">
                    {totalMCQs} Questions Available
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/50">
                  <div className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Progress</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${totalMCQs > 0 ? (answeredCount / totalMCQs) * 100 : 0}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-xs text-cyan-400 font-bold">
                      {totalMCQs > 0 ? Math.round((answeredCount / totalMCQs) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
                  <div className="text-[10px] text-emerald-400/80 mb-1 uppercase tracking-wider">Correct</div>
                  <div className="text-lg font-bold text-emerald-400">{correctCount}</div>
                </div>
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2.5">
                  <div className="text-[10px] text-cyan-400/80 mb-1 uppercase tracking-wider">Answered</div>
                  <div className="text-lg font-bold text-cyan-400">{answeredCount}</div>
                </div>
              </div>
              <motion.button
                onClick={() => setIsMinimized(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 hover:from-cyan-500/30 hover:via-purple-500/30 hover:to-pink-500/30 border border-cyan-500/30 rounded-lg text-xs font-semibold text-cyan-300 transition-all duration-200 shadow-lg shadow-cyan-500/10"
              >
                Start Quiz →
              </motion.button>
            </div>
          )}

          {/* Expanded View */}
          {!isMinimized && (
            <>
              <div className="overflow-y-auto flex-1" style={{ 
                maxHeight: 'calc(100vh - 220px)', 
                minHeight: 0,
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch'
              }}>
                {/* Progress Bar */}
                <div className="px-4 pt-4 pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-gray-400 font-medium">Question {currentMCQIndex + 1} of {allMCQs.length}</span>
                    <span className="text-cyan-400 font-semibold">{Math.round(((currentMCQIndex + 1) / allMCQs.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/30">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentMCQIndex + 1) / allMCQs.length) * 100}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Question */}
                <div className="px-4 pb-4 space-y-4 flex-shrink-0">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 via-purple-500/30 to-pink-500/30 flex items-center justify-center text-xs font-bold text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10">
                        {currentMCQ.mcqNumber}
                      </span>
                      <p className="font-body text-white text-sm leading-relaxed flex-1 pt-0.5">
                        {currentMCQ.question}
                      </p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {currentMCQ.options.map((option, index) => {
                      const isSelected = selectedAnswer === index;
                      const isCorrectOption = index === currentMCQ.correctIndex;
                      const showCorrect = hasResult && isCorrectOption;
                      const showIncorrect = hasResult && isSelected && !isCorrectOption;

                      return (
                        <motion.button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          disabled={hasResult}
                          whileHover={!hasResult ? { scale: 1.02 } : {}}
                          whileTap={!hasResult ? { scale: 0.98 } : {}}
                          className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 ${
                            showCorrect
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                              : showIncorrect
                              ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-lg shadow-red-500/10'
                              : isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                              : 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:border-cyan-500/30 hover:text-cyan-200'
                          } ${hasResult ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                              showCorrect || (isSelected && !showIncorrect)
                                ? 'bg-emerald-500/40 text-emerald-200 border border-emerald-400/50'
                                : showIncorrect
                                ? 'bg-red-500/40 text-red-200 border border-red-400/50'
                                : isSelected
                                ? 'bg-cyan-500/40 text-cyan-200 border border-cyan-400/50'
                                : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'
                            }`}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            <span className="flex-1 text-sm leading-relaxed">{option}</span>
                            {showCorrect && (
                              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {showIncorrect && (
                              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {hasResult && currentMCQ.explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3.5 rounded-xl backdrop-blur-sm ${
                        isCorrect
                          ? 'bg-emerald-500/15 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                          : 'bg-amber-500/15 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <div className="flex-1">
                          <p className={`text-xs font-bold mb-1.5 ${
                            isCorrect ? 'text-emerald-300' : 'text-amber-300'
                          }`}>
                            {isCorrect ? '✓ Correct Answer!' : '✗ Incorrect'}
                          </p>
                          <p className="text-xs text-gray-200 leading-relaxed">
                            {currentMCQ.explanation}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-3 flex-shrink-0">
                    <motion.button
                      onClick={handlePrevious}
                      disabled={currentMCQIndex === 0}
                      whileHover={currentMCQIndex > 0 ? { scale: 1.02 } : {}}
                      whileTap={currentMCQIndex > 0 ? { scale: 0.98 } : {}}
                      className="flex-1 px-4 py-2.5 bg-gray-800/60 hover:bg-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700/50 rounded-xl text-sm font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </motion.button>
                    
                    {!hasResult ? (
                      <motion.button
                        onClick={handleSubmitAnswer}
                        disabled={selectedAnswer === undefined}
                        whileHover={selectedAnswer !== undefined ? { scale: 1.02 } : {}}
                        whileTap={selectedAnswer !== undefined ? { scale: 0.98 } : {}}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg shadow-cyan-500/20"
                      >
                        Submit Answer
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={handleNext}
                        disabled={currentMCQIndex === allMCQs.length - 1}
                        whileHover={currentMCQIndex < allMCQs.length - 1 ? { scale: 1.02 } : {}}
                        whileTap={currentMCQIndex < allMCQs.length - 1 ? { scale: 0.98 } : {}}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                      >
                        Next
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Stats */}
              <div className="px-4 pb-4 pt-3 border-t border-[#ffffff]/10 bg-gradient-to-r from-gray-900/30 to-transparent flex-shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">
                      Correct: <span className="text-emerald-400 font-bold">
                        {correctCount}
                      </span>
                    </span>
                    <span className="text-gray-400">
                      Answered: <span className="text-cyan-400 font-bold">
                        {answeredCount}
                      </span>
                    </span>
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {chapter.curriculum} • {chapter.class} • {chapter.subject}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LessonMCQPanel;
