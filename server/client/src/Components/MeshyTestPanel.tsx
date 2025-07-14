import React, { useState, useEffect } from 'react';
import { assetGenerationService } from '../services/assetGenerationService';
import { meshyApiService } from '../services/meshyApiService';
import { keywordExtractionService } from '../services/keywordExtractionService';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  data?: any;
}

export const MeshyTestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testPrompt, setTestPrompt] = useState('A sci-fi jungle with alien structures and a crashed spaceship');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const results: TestResult[] = [];

    // Test 1: Check Meshy API key
    try {
      const isConfigured = meshyApiService.isConfigured();
      results.push({
        test: 'Meshy API Configuration',
        status: isConfigured ? 'success' : 'error',
        message: isConfigured ? 'API key is configured' : 'API key is missing',
        data: { configured: isConfigured }
      });
    } catch (error) {
      results.push({
        test: 'Meshy API Configuration',
        status: 'error',
        message: `Configuration check failed: ${error}`,
        data: { error }
      });
    }

    // Test 2: Keyword extraction
    try {
      const extraction = keywordExtractionService.extractObjects(testPrompt);
      results.push({
        test: 'Keyword Extraction',
        status: 'success',
        message: `Found ${extraction.length} objects in prompt`,
        data: { objects: extraction, prompt: testPrompt }
      });
    } catch (error) {
      results.push({
        test: 'Keyword Extraction',
        status: 'error',
        message: `Extraction failed: ${error}`,
        data: { error }
      });
    }

    // Test 3: Cost estimation
    try {
      const costEstimate = assetGenerationService.estimateCost(testPrompt, 'medium');
      results.push({
        test: 'Cost Estimation',
        status: 'success',
        message: `Estimated cost: $${costEstimate.totalCost.toFixed(2)} for ${costEstimate.assetCount} assets`,
        data: costEstimate
      });
    } catch (error) {
      results.push({
        test: 'Cost Estimation',
        status: 'error',
        message: `Cost estimation failed: ${error}`,
        data: { error }
      });
    }

    // Test 4: Preview extraction
    try {
      const preview = assetGenerationService.previewExtraction(testPrompt);
      results.push({
        test: 'Preview Extraction',
        status: 'success',
        message: `Preview shows ${preview.count} objects detected`,
        data: preview
      });
    } catch (error) {
      results.push({
        test: 'Preview Extraction',
        status: 'error',
        message: `Preview failed: ${error}`,
        data: { error }
      });
    }

    // Test 5: Available styles (if configured)
    if (meshyApiService.isConfigured()) {
      try {
        const styles = await meshyApiService.getAvailableStyles();
        results.push({
          test: 'Available Styles',
          status: 'success',
          message: `Found ${styles.length} available styles`,
          data: { styles }
        });
      } catch (error) {
        results.push({
          test: 'Available Styles',
          status: 'error',
          message: `Style fetch failed: ${error}`,
          data: { error }
        });
      }
    }

    // Test 6: API Connection Test
    if (meshyApiService.isConfigured()) {
      try {
        const connectionTest = await meshyApiService.testConnection();
        results.push({
          test: 'API Connection Test',
          status: connectionTest.success ? 'success' : 'error',
          message: connectionTest.message,
          data: connectionTest.details
        });
      } catch (error) {
        results.push({
          test: 'API Connection Test',
          status: 'error',
          message: `Connection test failed: ${error}`,
          data: { error }
        });
      }
    }

    // Test 7: Usage Information (if configured)
    if (meshyApiService.isConfigured()) {
      try {
        const usage = await meshyApiService.getUsage();
        results.push({
          test: 'Usage Information',
          status: 'success',
          message: `Quota: ${usage.quota_remaining}/${usage.quota_limit} remaining`,
          data: { usage }
        });
      } catch (error) {
        results.push({
          test: 'Usage Information',
          status: 'error',
          message: `Usage fetch failed: ${error}`,
          data: { error }
        });
      }
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const testGeneration = async () => {
    if (!meshyApiService.isConfigured()) {
      alert('Meshy API not configured');
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      console.log('🧪 Starting test generation...');
      
      const request = {
        prompt: testPrompt,
        quality: 'low' as const, // Use low quality for faster testing
        output_format: 'glb' as const,
        style: 'realistic'
      };

      console.log('📤 Test generation request:', request);
      
      const generation = await meshyApiService.generateAsset(request);
      console.log('✅ Generation initiated:', generation);
      
      setGenerationResult({
        success: true,
        generationId: generation.id,
        status: generation.status,
        message: 'Generation started successfully'
      });

      // Don't poll for completion in test mode to avoid long waits
      console.log('⏹️ Test generation completed (not polling for completion)');
      
    } catch (error) {
      console.error('❌ Test generation failed:', error);
      setGenerationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Generation failed'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white mb-4">🧪 Meshy.ai Integration Test</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Test Prompt:
        </label>
        <input
          type="text"
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a prompt to test..."
        />
      </div>

      <button
        onClick={runTests}
        disabled={isRunning}
        className="w-full py-2 px-4 bg-gradient-to-r from-blue-500/50 to-purple-600/50 hover:from-blue-600/60 hover:to-purple-700/60 disabled:opacity-50 text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50"
      >
        {isRunning ? 'Running Tests...' : 'Run Integration Tests'}
      </button>

      <button
        onClick={testGeneration}
        disabled={isGenerating || !meshyApiService.isConfigured()}
        className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-green-500/50 to-emerald-600/50 hover:from-green-600/60 hover:to-emerald-700/60 disabled:opacity-50 text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500/50"
      >
        {isGenerating ? 'Testing Generation...' : 'Test Generation (Low Quality)'}
      </button>

      {generationResult && (
        <div className="mt-4 p-4 bg-gray-800/30 rounded-md border border-gray-700/30">
          <h4 className="text-sm font-medium text-white mb-2">Generation Test Result:</h4>
          <div className={`text-sm ${generationResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {generationResult.success ? '✅' : '❌'} {generationResult.message}
          </div>
          {generationResult.generationId && (
            <div className="text-xs text-gray-300 mt-1">
              Generation ID: {generationResult.generationId}
            </div>
          )}
          {generationResult.error && (
            <div className="text-xs text-red-300 mt-1">
              Error: {generationResult.error}
            </div>
          )}
        </div>
      )}

      {testResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="text-md font-medium text-white">Test Results:</h4>
          {testResults.map((result, index) => (
            <div key={index} className="bg-gray-800/30 rounded-md p-3 border border-gray-700/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{result.test}</span>
                <span className={`text-sm font-medium ${getStatusColor(result.status)}`}>
                  {getStatusIcon(result.status)} {result.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-300 mb-2">{result.message}</p>
              {result.data && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                    View Details
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-900/50 rounded text-gray-300 overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-md">
        <h4 className="text-sm font-medium text-blue-300 mb-2">💡 How to Verify Meshy is Working:</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Check if "Meshy API Configuration" shows ✅ SUCCESS</li>
          <li>• Verify "Keyword Extraction" finds objects in your prompt</li>
          <li>• Confirm "Cost Estimation" calculates costs correctly</li>
          <li>• Look for "Available Styles" to show available Meshy styles</li>
          <li>• Check browser console for detailed debug information</li>
        </ul>
      </div>
    </div>
  );
}; 