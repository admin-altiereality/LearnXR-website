/**
 * McqTab - MCQ Management for Chapter
 * 
 * Data Source: chapter_mcqs collection (NEW Firestore schema)
 * This component now fetches MCQs from the chapter_mcqs collection
 * instead of legacy inline storage or subcollections.
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { MCQ, MCQFormState, ChapterMCQ, LanguageCode } from '../../../types/curriculum';
import { getChapterMCQs, getChapterMCQsByLanguage } from '../../../lib/firestore/queries';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { LanguageToggle } from '../../../Components/LanguageSelector';
import {
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface McqTabProps {
  mcqs: MCQ[];
  mcqFormState: MCQFormState[];
  onMcqsChange: (mcqs: MCQFormState[]) => void;
  isReadOnly: boolean;
  flattenedMcqInfo: { hasFlattened: boolean; count: number };
  onNormalizeMCQs: () => void;
  // New props for direct fetching from chapter_mcqs collection
  chapterId?: string;
  topicId?: string;
  language?: LanguageCode;
  onLanguageChange?: (language: LanguageCode) => void;
}

const difficultyOptions = [
  { value: 'easy', label: 'Easy', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 'hard', label: 'Hard', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
];

export const McqTab = ({
  mcqs,
  mcqFormState,
  onMcqsChange,
  isReadOnly,
  flattenedMcqInfo,
  onNormalizeMCQs,
  chapterId,
  topicId,
  language = 'en',
  onLanguageChange,
}: McqTabProps) => {
  const [expandedMcq, setExpandedMcq] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localMcqs, setLocalMcqs] = useState<ChapterMCQ[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  
  // Sync with parent language prop
  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);
  
  const handleLanguageChange = (lang: LanguageCode) => {
    setSelectedLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };
  
  // Fetch MCQs from chapter_mcqs collection if chapterId and topicId are provided
  useEffect(() => {
    const loadMcqsFromCollection = async () => {
      if (!chapterId || !topicId) return;
      
      setLoading(true);
      try {
        const mcqsData = await getChapterMCQsByLanguage(chapterId, topicId, selectedLanguage);
        setLocalMcqs(mcqsData);
        
        // Convert ChapterMCQ to MCQFormState for backwards compatibility
        if (mcqsData.length > 0 && onMcqsChange) {
          const formState: MCQFormState[] = mcqsData.map((mcq) => ({
            id: mcq.id,
            question: mcq.question,
            options: mcq.options,
            correct_option_index: mcq.correct_option_index,
            explanation: mcq.explanation || '',
            difficulty: mcq.difficulty,
            order: mcq.order,
          }));
          onMcqsChange(formState);
        }
      } catch (error) {
        console.error(`Error loading ${selectedLanguage} MCQs from chapter_mcqs collection:`, error);
        toast.error(`Failed to load ${selectedLanguage === 'en' ? 'English' : 'Hindi'} MCQs`);
      } finally {
        setLoading(false);
      }
    };
    
    // Only fetch if props indicate direct loading is needed
    if (chapterId && topicId && mcqs.length === 0) {
      loadMcqsFromCollection();
    }
  }, [chapterId, topicId, selectedLanguage]);
  
  const handleRefresh = async () => {
    if (!chapterId || !topicId) return;
    
    setLoading(true);
    try {
      const mcqsData = await getChapterMCQsByLanguage(chapterId, topicId, selectedLanguage);
      setLocalMcqs(mcqsData);
      toast.success(`${selectedLanguage === 'en' ? 'English' : 'Hindi'} MCQs refreshed`);
    } catch (error) {
      console.error(`Error refreshing ${selectedLanguage} MCQs:`, error);
      toast.error(`Failed to refresh ${selectedLanguage === 'en' ? 'English' : 'Hindi'} MCQs`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddMcq = () => {
    const newMcq: MCQFormState = {
      question: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
      difficulty: 'medium',
      _isNew: true,
    };
    onMcqsChange([...mcqFormState, newMcq]);
    setExpandedMcq(`new-${mcqFormState.length}`);
  };
  
  const handleUpdateMcq = (index: number, field: keyof MCQFormState, value: unknown) => {
    const updated = [...mcqFormState];
    updated[index] = { ...updated[index], [field]: value };
    onMcqsChange(updated);
  };
  
  const handleUpdateOption = (mcqIndex: number, optionIndex: number, value: string) => {
    const updated = [...mcqFormState];
    const options = [...(updated[mcqIndex].options || [])];
    options[optionIndex] = value;
    updated[mcqIndex] = { ...updated[mcqIndex], options };
    onMcqsChange(updated);
  };
  
  const handleAddOption = (mcqIndex: number) => {
    const updated = [...mcqFormState];
    const options = [...(updated[mcqIndex].options || []), ''];
    updated[mcqIndex] = { ...updated[mcqIndex], options };
    onMcqsChange(updated);
  };
  
  const handleRemoveOption = (mcqIndex: number, optionIndex: number) => {
    const updated = [...mcqFormState];
    const options = (updated[mcqIndex].options || []).filter((_, i) => i !== optionIndex);
    // Adjust correct_option_index if needed
    let correctIndex = updated[mcqIndex].correct_option_index;
    if (optionIndex < correctIndex) {
      correctIndex--;
    } else if (optionIndex === correctIndex) {
      correctIndex = 0;
    }
    updated[mcqIndex] = { ...updated[mcqIndex], options, correct_option_index: correctIndex };
    onMcqsChange(updated);
  };
  
  const handleDeleteMcq = (index: number) => {
    const updated = [...mcqFormState];
    if (updated[index].id) {
      // Mark existing MCQ as deleted
      updated[index] = { ...updated[index], _isDeleted: true };
    } else {
      // Remove new MCQ entirely
      updated.splice(index, 1);
    }
    onMcqsChange(updated);
    setExpandedMcq(null);
  };
  
  const toggleExpand = (id: string) => {
    setExpandedMcq(expandedMcq === id ? null : id);
  };
  
  const visibleMcqs = mcqFormState.filter((m) => !m._isDeleted);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading MCQs from chapter_mcqs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Multiple Choice Questions</h2>
            <p className="text-sm text-slate-400 mt-1">
              {visibleMcqs.length} {selectedLanguage === 'en' ? 'English' : 'Hindi'} question{visibleMcqs.length !== 1 ? 's' : ''} 
              <span className="text-cyan-400/60 ml-1">(from chapter_mcqs)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Language:</span>
              <LanguageToggle
                value={selectedLanguage}
                onChange={handleLanguageChange}
                size="sm"
                showFlags={true}
              />
            </div>
            {chapterId && topicId && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white
                         bg-slate-800/50 hover:bg-slate-700/50
                         rounded-lg border border-slate-600/50
                         transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={handleAddMcq}
              disabled={isReadOnly}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-gradient-to-r from-cyan-500 to-blue-600
                       hover:from-cyan-400 hover:to-blue-500
                       rounded-lg shadow-lg shadow-cyan-500/25
                       transition-all duration-200 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        </div>
        
        {/* Flattened MCQ Warning */}
        {flattenedMcqInfo.hasFlattened && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-400">
                  Legacy MCQ Format Detected
                </h3>
                <p className="text-xs text-amber-300/70 mt-1">
                  Found {flattenedMcqInfo.count} MCQs in flattened format. 
                  Click normalize to convert them to the new structure.
                </p>
                <button
                  onClick={onNormalizeMCQs}
                  disabled={isReadOnly}
                  className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                           text-amber-400 bg-amber-500/20 hover:bg-amber-500/30
                           rounded-lg border border-amber-500/30
                           transition-all duration-200 disabled:opacity-50"
                >
                  <Wand2 className="w-3 h-3" />
                  Normalize MCQs
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* MCQ List */}
        {visibleMcqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 
                        bg-slate-800/20 rounded-xl border border-slate-700/30">
            <HelpCircle className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400">No questions yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Click "Add Question" to create the first MCQ
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMcqs.map((mcq, index) => {
              const mcqId = mcq.id || `new-${index}`;
              const isExpanded = expandedMcq === mcqId;
              const difficultyConfig = difficultyOptions.find((d) => d.value === mcq.difficulty) 
                || difficultyOptions[1];
              
              return (
                <div
                  key={mcqId}
                  className={`bg-slate-800/30 rounded-xl border transition-all duration-200
                            ${isExpanded 
                              ? 'border-cyan-500/30 shadow-lg shadow-cyan-500/5' 
                              : 'border-slate-700/30 hover:border-slate-600/50'
                            }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => toggleExpand(mcqId)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <GripVertical className="w-4 h-4 text-slate-600" />
                    <span className="w-8 h-8 flex items-center justify-center 
                                   text-sm font-semibold text-cyan-400 
                                   bg-cyan-500/10 rounded-lg">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {mcq.question || 'Untitled Question'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded border
                                       ${difficultyConfig.color}`}>
                          {difficultyConfig.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {mcq.options?.length || 0} options
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-4 border-t border-slate-700/30 mt-0">
                      <div className="pt-4" />
                      
                      {/* Question */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">Question</label>
                        <textarea
                          value={mcq.question}
                          onChange={(e) => handleUpdateMcq(index, 'question', e.target.value)}
                          disabled={isReadOnly}
                          placeholder="Enter the question..."
                          rows={2}
                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg
                                   px-3 py-2.5 text-sm text-white placeholder:text-slate-500
                                   focus:outline-none focus:ring-2 focus:ring-cyan-500/50 
                                   disabled:opacity-50 resize-none"
                        />
                      </div>
                      
                      {/* Options */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-400">Options</label>
                          <button
                            onClick={() => handleAddOption(index)}
                            disabled={isReadOnly || (mcq.options?.length || 0) >= 6}
                            className="text-xs text-cyan-400 hover:text-cyan-300 
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            + Add Option
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            // Ensure options array exists and has at least 4 items for display
                            const options = mcq.options || [];
                            const displayOptions = options.length >= 4 
                              ? options 
                              : [...options, ...Array(4 - options.length).fill('')];
                            
                            return displayOptions.map((option, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateMcq(index, 'correct_option_index', optIndex)}
                                disabled={isReadOnly}
                                className={`w-6 h-6 rounded-full flex items-center justify-center
                                         transition-all duration-200 flex-shrink-0
                                         ${mcq.correct_option_index === optIndex
                                           ? 'bg-emerald-500 text-white'
                                           : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                         }`}
                              >
                                {mcq.correct_option_index === optIndex && (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                              <input
                                type="text"
                                value={option || ''}
                                onChange={(e) => handleUpdateOption(index, optIndex, e.target.value)}
                                disabled={isReadOnly}
                                placeholder={`Option ${optIndex + 1}`}
                                className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-lg
                                         px-3 py-2 text-sm text-white placeholder:text-slate-500
                                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 
                                         disabled:opacity-50"
                              />
                              {(displayOptions.length > 2 && optIndex < options.length) && (
                                <button
                                  onClick={() => handleRemoveOption(index, optIndex)}
                                  disabled={isReadOnly}
                                  className="p-1.5 text-slate-400 hover:text-red-400 
                                           rounded transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            ));
                          })()}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Click the circle to mark the correct answer
                        </p>
                      </div>
                      
                      {/* Explanation */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">Explanation</label>
                        <textarea
                          value={mcq.explanation}
                          onChange={(e) => handleUpdateMcq(index, 'explanation', e.target.value)}
                          disabled={isReadOnly}
                          placeholder="Explain why this is the correct answer..."
                          rows={2}
                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg
                                   px-3 py-2.5 text-sm text-white placeholder:text-slate-500
                                   focus:outline-none focus:ring-2 focus:ring-cyan-500/50 
                                   disabled:opacity-50 resize-none"
                        />
                      </div>
                      
                      {/* Difficulty */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">Difficulty</label>
                        <div className="flex gap-2">
                          {difficultyOptions.map((diff) => (
                            <button
                              key={diff.value}
                              onClick={() => handleUpdateMcq(index, 'difficulty', diff.value)}
                              disabled={isReadOnly}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border
                                       transition-all duration-200 disabled:opacity-50
                                       ${mcq.difficulty === diff.value
                                         ? diff.color
                                         : 'text-slate-400 bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50'
                                       }`}
                            >
                              {diff.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Delete Button */}
                      <div className="pt-2 border-t border-slate-700/30">
                        <button
                          onClick={() => handleDeleteMcq(index)}
                          disabled={isReadOnly}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                                   text-red-400 hover:text-red-300 hover:bg-red-500/10
                                   rounded-lg transition-all duration-200 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
