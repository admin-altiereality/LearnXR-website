import React, { useState, useEffect } from 'react';
import { meshyApiService } from '../services/meshyApiService';

interface DiagnosticResult {
  timestamp: string;
  environment: {
    apiKeyConfigured: boolean;
    apiKeyLength: number;
    apiKeyPrefix: string;
    baseUrl: string;
    nodeEnv: string;
  };
  connectivity: {
    success: boolean;
    message: string;
    details?: any;
  };
  endpoints: {
    [key: string]: {
      success: boolean;
      message: string;
      responseTime?: number;
      details?: any;
    };
  };
  recommendations: string[];
}

export const MeshyDiagnosticPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    const diagnosticResult: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      environment: {
        apiKeyConfigured: false,
        apiKeyLength: 0,
        apiKeyPrefix: '',
        baseUrl: '',
        nodeEnv: ''
      },
      connectivity: {
        success: false,
        message: ''
      },
      endpoints: {},
      recommendations: []
    };

    try {
      // Environment check
      const apiKey = import.meta.env.VITE_MESHY_API_KEY;
      const baseUrl = import.meta.env.VITE_MESHY_API_BASE_URL;
      
      diagnosticResult.environment = {
        apiKeyConfigured: !!apiKey && apiKey.length > 0,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : '',
        baseUrl: baseUrl || 'Not configured',
        nodeEnv: import.meta.env.MODE || 'unknown'
      };

      if (!diagnosticResult.environment.apiKeyConfigured) {
        diagnosticResult.recommendations.push('Add VITE_MESHY_API_KEY to your environment variables');
        setResults(diagnosticResult);
        setIsRunning(false);
        return;
      }

      // Test basic connectivity
      const startTime = Date.now();
      const connectionTest = await meshyApiService.testConnection();
      const responseTime = Date.now() - startTime;

      diagnosticResult.connectivity = {
        success: connectionTest.success,
        message: connectionTest.message,
        responseTime,
        details: connectionTest.details
      };

      if (!connectionTest.success) {
        diagnosticResult.recommendations.push('Check your API key validity and network connectivity');
        diagnosticResult.recommendations.push('Verify the API key format starts with "msy_"');
        diagnosticResult.recommendations.push('Check if your API key has sufficient credits/quota');
      }

      // Test specific endpoints
      const endpoints = [
        { name: 'text-to-3d', url: '/text-to-3d', method: 'GET' },
        { name: 'styles', url: '/text-to-3d/styles', method: 'GET' },
        { name: 'usage', url: '/text-to-3d/usage', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await fetch(`${diagnosticResult.environment.baseUrl}${endpoint.url}`, {
            method: endpoint.method,
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          const responseTime = Date.now() - startTime;

          if (response.ok) {
            const data = await response.json();
            diagnosticResult.endpoints[endpoint.name] = {
              success: true,
              message: `✅ ${endpoint.name} endpoint working`,
              responseTime,
              details: {
                status: response.status,
                dataType: Array.isArray(data) ? 'array' : 'object',
                dataLength: Array.isArray(data) ? data.length : Object.keys(data).length
              }
            };
          } else {
            const errorText = await response.text().catch(() => 'Unable to read error');
            diagnosticResult.endpoints[endpoint.name] = {
              success: false,
              message: `❌ ${endpoint.name} endpoint failed: ${response.status} ${response.statusText}`,
              responseTime,
              details: {
                status: response.status,
                statusText: response.statusText,
                error: errorText
              }
            };
          }
        } catch (error) {
          diagnosticResult.endpoints[endpoint.name] = {
            success: false,
            message: `❌ ${endpoint.name} endpoint error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error }
          };
        }
      }

      // Generate recommendations based on results
      const failedEndpoints = Object.values(diagnosticResult.endpoints).filter(ep => !ep.success);
      if (failedEndpoints.length > 0) {
        diagnosticResult.recommendations.push('Some API endpoints are failing - check Meshy service status');
      }

      if (diagnosticResult.connectivity.responseTime && diagnosticResult.connectivity.responseTime > 5000) {
        diagnosticResult.recommendations.push('API response time is slow - check network connection');
      }

      // Check for common issues
      if (apiKey && !apiKey.startsWith('msy_')) {
        diagnosticResult.recommendations.push('API key format appears incorrect - should start with "msy_"');
      }

      if (baseUrl && !baseUrl.includes('api.meshy.ai')) {
        diagnosticResult.recommendations.push('Base URL appears incorrect - should be https://api.meshy.ai/openapi/v2');
      }

      setResults(diagnosticResult);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (success: boolean) => success ? '✅' : '❌';
  const getStatusColor = (success: boolean) => success ? 'text-green-500' : 'text-red-500';

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-400">🔧 Meshy API Diagnostic Panel</h2>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
        >
          {isRunning ? '🔄 Running...' : '🔄 Run Diagnostics'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <h3 className="text-red-400 font-semibold">Error</h3>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Environment Information */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">Environment Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">API Key:</span>
                <span className={`ml-2 ${getStatusColor(results.environment.apiKeyConfigured)}`}>
                  {getStatusIcon(results.environment.apiKeyConfigured)} {results.environment.apiKeyPrefix}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Base URL:</span>
                <span className="ml-2 text-gray-300">{results.environment.baseUrl}</span>
              </div>
              <div>
                <span className="text-gray-400">Environment:</span>
                <span className="ml-2 text-gray-300">{results.environment.nodeEnv}</span>
              </div>
              <div>
                <span className="text-gray-400">Timestamp:</span>
                <span className="ml-2 text-gray-300">{new Date(results.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Connectivity Test */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">API Connectivity</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={getStatusColor(results.connectivity.success)}>
                  {getStatusIcon(results.connectivity.success)} {results.connectivity.message}
                </span>
              </div>
              {results.connectivity.responseTime && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Response Time:</span>
                  <span className={`text-gray-300 ${results.connectivity.responseTime > 5000 ? 'text-yellow-400' : ''}`}>
                    {results.connectivity.responseTime}ms
                  </span>
                </div>
              )}
              {results.connectivity.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-400 text-sm">View Details</summary>
                  <pre className="mt-2 text-xs bg-gray-900 p-3 rounded overflow-auto">
                    {JSON.stringify(results.connectivity.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>

          {/* Endpoint Tests */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">Endpoint Tests</h3>
            <div className="space-y-3">
              {Object.entries(results.endpoints).map(([name, endpoint]) => (
                <div key={name} className="border-b border-gray-700 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 capitalize">{name}:</span>
                    <span className={getStatusColor(endpoint.success)}>
                      {getStatusIcon(endpoint.success)} {endpoint.message}
                    </span>
                  </div>
                  {endpoint.responseTime && (
                    <div className="text-xs text-gray-500 mt-1">
                      Response time: {endpoint.responseTime}ms
                    </div>
                  )}
                  {endpoint.details && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-blue-400 text-xs">Details</summary>
                      <pre className="mt-1 text-xs bg-gray-900 p-2 rounded overflow-auto">
                        {JSON.stringify(endpoint.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-600 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-yellow-300 mb-3">💡 Recommendations</h3>
              <ul className="space-y-2">
                {results.recommendations.map((rec, index) => (
                  <li key={index} className="text-yellow-200 text-sm flex items-start">
                    <span className="mr-2">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.open('https://console.meshy.ai/', '_blank')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                🔗 Meshy Console
              </button>
              <button
                onClick={() => window.open('https://docs.meshy.ai/', '_blank')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
              >
                📚 Documentation
              </button>
              <button
                onClick={() => window.open('https://status.meshy.ai/', '_blank')}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm"
              >
                📊 Service Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 