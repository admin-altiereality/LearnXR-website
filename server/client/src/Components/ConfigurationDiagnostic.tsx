import React, { useState, useEffect } from 'react';

interface DiagnosticResult {
  meshyConfigured: boolean;
  firebaseConfigured: boolean;
  apiBaseUrl: string;
  environment: string;
  errors: string[];
  warnings: string[];
}

const ConfigurationDiagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnosticResult: DiagnosticResult = {
      meshyConfigured: false,
      firebaseConfigured: false,
      apiBaseUrl: '',
      environment: '',
      errors: [],
      warnings: []
    };

    try {
      // Check Meshy configuration
      const meshyKey = import.meta.env.VITE_MESHY_API_KEY;
      diagnosticResult.meshyConfigured = !!meshyKey && meshyKey.length > 0;
      if (!diagnosticResult.meshyConfigured) {
        diagnosticResult.errors.push('Meshy API key not configured (VITE_MESHY_API_KEY)');
      }

      // Check Firebase configuration
      const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const firebaseAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
      const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      
      diagnosticResult.firebaseConfigured = !!(firebaseApiKey && firebaseAuthDomain && firebaseProjectId);
      if (!diagnosticResult.firebaseConfigured) {
        diagnosticResult.errors.push('Firebase configuration incomplete');
      }

      // Check API base URL
      diagnosticResult.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'Not configured';
      if (!diagnosticResult.apiBaseUrl || diagnosticResult.apiBaseUrl === 'Not configured') {
        diagnosticResult.errors.push('API base URL not configured (VITE_API_BASE_URL)');
      }

      // Check environment
      diagnosticResult.environment = import.meta.env.MODE || 'unknown';

      // Test API connectivity
      if (diagnosticResult.apiBaseUrl && diagnosticResult.apiBaseUrl !== 'Not configured') {
        try {
          const response = await fetch(`${diagnosticResult.apiBaseUrl}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!response.ok) {
            diagnosticResult.warnings.push('API server may not be running or accessible');
          }
        } catch (error) {
          diagnosticResult.warnings.push('Cannot connect to API server');
        }
      }

    } catch (error) {
      diagnosticResult.errors.push(`Diagnostic error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setResults(diagnosticResult);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  if (!results) {
    return (
      <div className="fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Running diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md">
      <div className="font-bold mb-3">🔧 Configuration Diagnostic</div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2">
          <span>Meshy API:</span>
          <span className={results.meshyConfigured ? 'text-green-400' : 'text-red-400'}>
            {results.meshyConfigured ? '✅ Configured' : '❌ Not configured'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>Firebase:</span>
          <span className={results.firebaseConfigured ? 'text-green-400' : 'text-red-400'}>
            {results.firebaseConfigured ? '✅ Configured' : '❌ Not configured'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>API URL:</span>
          <span className="text-blue-400">{results.apiBaseUrl}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>Environment:</span>
          <span className="text-purple-400">{results.environment}</span>
        </div>
      </div>

      {results.errors.length > 0 && (
        <div className="mt-3">
          <div className="font-semibold text-red-400 mb-1">Errors:</div>
          <ul className="text-xs text-red-300 space-y-1">
            {results.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {results.warnings.length > 0 && (
        <div className="mt-3">
          <div className="font-semibold text-yellow-400 mb-1">Warnings:</div>
          <ul className="text-xs text-yellow-300 space-y-1">
            {results.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex space-x-2">
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Running...' : 'Re-run'}
        </button>
        <button
          onClick={() => window.open('MESHY_SETUP_GUIDE.md', '_blank')}
          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
        >
          Setup Guide
        </button>
      </div>
    </div>
  );
};

export default ConfigurationDiagnostic; 