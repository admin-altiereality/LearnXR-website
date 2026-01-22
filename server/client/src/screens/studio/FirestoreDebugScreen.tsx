/**
 * Firestore Explorer Debug Screen
 * 
 * Internal debug tool to inspect Firestore collections, verify data structure,
 * check language fields, and test lesson bundle fetching.
 * 
 * Access: /studio/firestore-debug
 */

import { useState, useCallback } from 'react';
import {
  fetchSampleCurriculumChapters,
  fetchSampleMcqs,
  fetchSampleTts,
  fetchSampleAvatarScripts,
  fetchSampleSkyboxes,
  fetchSamplePdfs,
  fetchSample3dAssets,
  analyzeLanguageFields,
  analyzeAllCollections,
  type LanguageFieldAnalysis,
} from '../../debug/firestoreDebugFetch';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import type { LanguageCode } from '../../types/curriculum';
import {
  Database,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  FileText,
  Code,
  Globe,
} from 'lucide-react';

const FirestoreDebugScreen = () => {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<Array<{ id: string; data: any }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageAnalysis, setLanguageAnalysis] = useState<Record<string, LanguageFieldAnalysis>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  
  // Lesson bundle testing
  const [chapterId, setChapterId] = useState('');
  const [bundleLang, setBundleLang] = useState<LanguageCode>('en');
  const [bundleData, setBundleData] = useState<any>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [availableChapters, setAvailableChapters] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch collection data
  const handleFetchCollection = useCallback(async (collectionName: string) => {
    setLoading(true);
    setError(null);
    setSelectedCollection(collectionName);
    
    try {
      let data: Array<{ id: string; data: any }> = [];
      
      switch (collectionName) {
        case 'curriculum_chapters':
          data = await fetchSampleCurriculumChapters(10);
          break;
        case 'chapter_mcqs':
          data = await fetchSampleMcqs(10);
          break;
        case 'chapter_tts':
          data = await fetchSampleTts(10);
          break;
        case 'chapter_avatar_scripts':
          data = await fetchSampleAvatarScripts(10);
          break;
        case 'skyboxes':
          data = await fetchSampleSkyboxes(10);
          break;
        case 'pdfs':
          data = await fetchSamplePdfs(10);
          break;
        case 'text_to_3d_assets':
          data = await fetchSample3dAssets(10);
          break;
        default:
          throw new Error(`Unknown collection: ${collectionName}`);
      }
      
      setCollectionData(data);
      
      // Analyze language fields
      const analysis = analyzeLanguageFields(data, collectionName);
      setLanguageAnalysis(prev => ({
        ...prev,
        [collectionName]: analysis,
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch collection');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze all collections
  const handleAnalyzeAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const analysis = await analyzeAllCollections();
      setLanguageAnalysis(analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze collections');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load available chapters for bundle testing
  const loadAvailableChapters = useCallback(async () => {
    try {
      const chapters = await fetchSampleCurriculumChapters(50);
      setAvailableChapters(
        chapters.map(ch => ({
          id: ch.id,
          name: ch.data.chapter_name || ch.data.name || ch.id,
        }))
      );
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }, []);

  // Build lesson bundle
  const handleBuildBundle = useCallback(async () => {
    if (!chapterId) {
      setBundleError('Please enter a chapter ID');
      return;
    }
    
    setBundleLoading(true);
    setBundleError(null);
    setBundleData(null);
    
    try {
      const bundle = await getLessonBundle({
        chapterId,
        lang: bundleLang,
      });
      
      setBundleData(bundle);
      console.log('[DEBUG] Lesson bundle built:', bundle);
    } catch (err: any) {
      setBundleError(err.message || 'Failed to build lesson bundle');
      console.error('Bundle error:', err);
    } finally {
      setBundleLoading(false);
    }
  }, [chapterId, bundleLang]);

  // Filter collection data by language
  const filteredData = collectionData.filter(doc => {
    if (selectedLanguage === 'en') {
      // Show English content or content without language field
      return !doc.data.language || doc.data.language === 'en' || doc.data.lang === 'en';
    } else {
      // Show Hindi content
      return doc.data.language === 'hi' || doc.data.lang === 'hi';
    }
  });

  const collections = [
    { name: 'curriculum_chapters', label: 'Curriculum Chapters' },
    { name: 'chapter_mcqs', label: 'Chapter MCQs' },
    { name: 'chapter_tts', label: 'Chapter TTS' },
    { name: 'chapter_avatar_scripts', label: 'Avatar Scripts' },
    { name: 'skyboxes', label: 'Skyboxes' },
    { name: 'pdfs', label: 'PDFs' },
    { name: 'text_to_3d_assets', label: '3D Assets' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Database className="w-8 h-8" />
            Firestore Explorer Debug Screen
          </h1>
          <p className="text-gray-400">
            Inspect Firestore collections, verify data structure, and test lesson bundle fetching
          </p>
        </div>

        {/* Language Toggle */}
        <div className="mb-6 flex items-center gap-4">
          <label className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <span>Language Filter:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as LanguageCode)}
              className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700"
            >
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
            </select>
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Collection Fetch Buttons */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Fetch Collections</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {collections.map((col) => (
              <button
                key={col.name}
                onClick={() => handleFetchCollection(col.name)}
                disabled={loading}
                className={`p-3 rounded-lg border transition-colors ${
                  selectedCollection === col.name
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading && selectedCollection === col.name ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <span className="text-sm">{col.label}</span>
                )}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleAnalyzeAll}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Analyze All Collections
          </button>
        </div>

        {/* Language Analysis Results */}
        {Object.keys(languageAnalysis).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Language Field Analysis</h2>
            <div className="space-y-4">
              {Object.entries(languageAnalysis).map(([collection, analysis]) => (
                <div key={collection} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <h3 className="font-semibold mb-2">{collection}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Total Docs:</span>
                      <span className="ml-2">{analysis.totalDocs}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">With EN:</span>
                      <span className="ml-2">{analysis.docsWithEn}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">With HI:</span>
                      <span className="ml-2">{analysis.docsWithHi}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Structure:</span>
                      <span className="ml-2">{analysis.languageStructure}</span>
                    </div>
                  </div>
                  {analysis.languageFieldNames.length > 0 && (
                    <div className="mt-2">
                      <span className="text-gray-400">Language Fields: </span>
                      <span className="text-blue-400">{analysis.languageFieldNames.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collection Data Display */}
        {selectedCollection && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {collections.find(c => c.name === selectedCollection)?.label} Data
              <span className="ml-2 text-sm text-gray-400">
                ({filteredData.length} of {collectionData.length} docs for {selectedLanguage})
              </span>
            </h2>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 overflow-auto max-h-96">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(filteredData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Lesson Bundle Testing */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Lesson Bundle Testing
          </h2>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm mb-2">Chapter ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    placeholder="Enter chapter ID"
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  />
                  <button
                    onClick={loadAvailableChapters}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    Load Chapters
                  </button>
                </div>
                {availableChapters.length > 0 && (
                  <select
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    className="mt-2 w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  >
                    <option value="">Select a chapter...</option>
                    {availableChapters.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm mb-2">Language</label>
                <select
                  value={bundleLang}
                  onChange={(e) => setBundleLang(e.target.value as LanguageCode)}
                  className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                >
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={handleBuildBundle}
                  disabled={bundleLoading || !chapterId}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {bundleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Build Bundle
                    </>
                  )}
                </button>
              </div>
            </div>

            {bundleError && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>{bundleError}</span>
              </div>
            )}

            {bundleData && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>Bundle built successfully!</span>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(bundleData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirestoreDebugScreen;
