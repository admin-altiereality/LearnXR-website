import React, { useState, useEffect } from 'react';
import { meshyApiService } from '../services/meshyApiService';

export const MeshyDebugPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Get current environment variables
    setApiKey(import.meta.env.VITE_MESHY_API_KEY || '');
    setBaseUrl(import.meta.env.VITE_MESHY_API_BASE_URL || '');
  }, []);

  const runTests = async () => {
    setIsLoading(true);
    setError(null);
    setTestResults(null);

    try {
      const results = {
        environment: {
          apiKey: apiKey ? 'Configured' : 'Missing',
          baseUrl: baseUrl || 'Not set',
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 4) + '...'
        },
        configuration: {
          isConfigured: meshyApiService.isConfigured(),
          serviceInstance: !!meshyApiService
        },
        connectivity: null as any,
        styles: null as any,
        usage: null as any
      };

      // Test API connectivity
      try {
        const connectionTest = await meshyApiService.testConnection();
        results.connectivity = connectionTest;
      } catch (err) {
        results.connectivity = {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
          error: err
        };
      }

      // Test styles endpoint
      try {
        const styles = await meshyApiService.getAvailableStyles();
        results.styles = {
          success: true,
          count: styles.length,
          styles: styles.slice(0, 3) // Show first 3 styles
        };
      } catch (err) {
        results.styles = {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
          error: err
        };
      }

      // Test usage endpoint
      try {
        const usage = await meshyApiService.getUsage();
        results.usage = {
          success: true,
          data: usage
        };
      } catch (err) {
        results.usage = {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
          error: err
        };
      }

      setTestResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const testGeneration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const request = {
        prompt: 'A simple red cube',
        quality: 'low' as const,
        output_format: 'glb' as const
      };

      console.log('Testing generation with request:', request);
      
      const generation = await meshyApiService.generateAsset(request);
      console.log('Generation initiated:', generation);
      
      setTestResults((prev: typeof testResults) => ({
        ...prev,
        generation: {
          success: true,
          generationId: generation.result, // 'result' contains the task ID
          status: 'pending'
        }
      }));
    } catch (err) {
      console.error('Generation test failed:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">🔧 Meshy API Debug Panel</h2>
      
      {/* Environment Info */}
      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Environment Variables</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">API Key:</span>
            <span className={`ml-2 ${apiKey ? 'text-green-400' : 'text-red-400'}`}>
              {apiKey ? 'Configured' : 'Missing'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Base URL:</span>
            <span className="ml-2 text-white">{baseUrl || 'Not set'}</span>
          </div>
          <div>
            <span className="text-gray-400">API Key Length:</span>
            <span className="ml-2 text-white">{apiKey.length}</span>
          </div>
          <div>
            <span className="text-gray-400">API Key Prefix:</span>
            <span className="ml-2 text-white">{apiKey.substring(0, 4)}...</span>
          </div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={runTests}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Running Tests...' : 'Run All Tests'}
        </button>
        <button
          onClick={testGeneration}
          disabled={isLoading || !apiKey}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Test Generation
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg">
          <div className="text-red-400 font-semibold mb-2">Error:</div>
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Test Results</h3>
          
          {/* Configuration */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-2">Configuration</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Service Configured:</span>
                <span className={testResults.configuration.isConfigured ? 'text-green-400' : 'text-red-400'}>
                  {testResults.configuration.isConfigured ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Service Instance:</span>
                <span className={testResults.configuration.serviceInstance ? 'text-green-400' : 'text-red-400'}>
                  {testResults.configuration.serviceInstance ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Connectivity */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-2">API Connectivity</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={testResults.connectivity?.success ? 'text-green-400' : 'text-red-400'}>
                  {testResults.connectivity?.success ? 'Connected' : 'Failed'}
                </span>
              </div>
              <div className="text-gray-300 mt-1">
                {testResults.connectivity?.message}
              </div>
              {testResults.connectivity?.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-400">Details</summary>
                  <pre className="mt-1 text-xs bg-gray-900 p-2 rounded overflow-auto">
                    {JSON.stringify(testResults.connectivity.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>

          {/* Styles */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-2">Available Styles</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={testResults.styles?.success ? 'text-green-400' : 'text-red-400'}>
                  {testResults.styles?.success ? 'Loaded' : 'Failed'}
                </span>
              </div>
              {testResults.styles?.success && (
                <div className="text-gray-300 mt-1">
                  Found {testResults.styles.count} styles
                </div>
              )}
              {testResults.styles?.message && (
                <div className="text-red-300 mt-1">
                  {testResults.styles.message}
                </div>
              )}
            </div>
          </div>

          {/* Usage */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-2">Usage Statistics</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={testResults.usage?.success ? 'text-green-400' : 'text-red-400'}>
                  {testResults.usage?.success ? 'Loaded' : 'Failed'}
                </span>
              </div>
              {testResults.usage?.success && (
                <div className="text-gray-300 mt-1">
                  <div>Quota: {testResults.usage.data.quota_remaining} / {testResults.usage.data.quota_limit}</div>
                  <div>Total Generations: {testResults.usage.data.total_generations}</div>
                  <div>Total Cost: ${testResults.usage.data.total_cost.toFixed(2)}</div>
                </div>
              )}
              {testResults.usage?.message && (
                <div className="text-red-300 mt-1">
                  {testResults.usage.message}
                </div>
              )}
            </div>
          </div>

          {/* Generation Test */}
          {testResults.generation && (
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <h4 className="text-md font-semibold text-white mb-2">Generation Test</h4>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={testResults.generation.success ? 'text-green-400' : 'text-red-400'}>
                    {testResults.generation.success ? 'Initiated' : 'Failed'}
                  </span>
                </div>
                {testResults.generation.success && (
                  <div className="text-gray-300 mt-1">
                    <div>Generation ID: {testResults.generation.generationId}</div>
                    <div>Status: {testResults.generation.status}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 