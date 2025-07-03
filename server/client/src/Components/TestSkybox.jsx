import React, { useEffect, useState } from 'react';
import api from '../config/axios';

const TestSkybox = () => {
  const [skyboxStyles, setSkyboxStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    const fetchSkyboxStyles = async () => {
      try {
        // Debug environment variables
        const envInfo = {
          VITE_API_URL: import.meta.env.VITE_API_URL,
          PROD: import.meta.env.PROD,
          MODE: import.meta.env.MODE,
          BASE_URL: import.meta.env.BASE_URL,
          hostname: window.location.hostname,
          origin: window.location.origin
        };
        setDebugInfo(envInfo);
        
        console.log("=== TEST SKYBOX DEBUG ===");
        console.log("Environment Info:", envInfo);
        console.log("Fetching skybox styles...");
        
        // Test direct fetch first
        console.log("Testing direct fetch...");
        const directResponse = await fetch('http://localhost:5002/api/skybox/styles');
        console.log("Direct fetch status:", directResponse.status);
        const directData = await directResponse.json();
        console.log("Direct fetch data:", directData);
        
        // Test axios
        console.log("Testing axios...");
        const response = await api.get('/api/skybox/styles');
        console.log("Axios Response:", response.data);
        
        const styles = response.data.data?.styles || [];
        console.log("Extracted styles:", styles);
        console.log("Number of styles:", styles.length);
        
        setSkyboxStyles(styles);
        setLoading(false);
      } catch (error) {
        console.error("=== TEST SKYBOX ERROR ===");
        console.error("Error fetching skybox styles:", error);
        console.error("Error details:", error.response?.data || error.message);
        console.error("Error status:", error.response?.status);
        console.error("Error headers:", error.response?.headers);
        setError({
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        setLoading(false);
      }
    };

    fetchSkyboxStyles();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading skybox styles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <div className="bg-red-900/50 p-4 rounded-lg mb-4 text-left">
            <p className="text-red-300 mb-2"><strong>Message:</strong> {error.message}</p>
            <p className="text-red-300 mb-2"><strong>Status:</strong> {error.status}</p>
            <p className="text-red-300"><strong>Data:</strong> {JSON.stringify(error.data, null, 2)}</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg mb-4 text-left">
            <h3 className="font-semibold mb-2">Environment Info:</h3>
            <pre className="text-xs text-gray-300">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-8">In3D.Ai API Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">API Status</h2>
          <p className="text-green-400 mb-2">✅ API call successful!</p>
          <p className="text-gray-300">Found {skyboxStyles.length} In3D.Ai styles</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Environment Debug</h2>
          <pre className="text-xs text-gray-300 bg-gray-900 p-4 rounded overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">In3D.Ai Styles Dropdown</h2>
          <select className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white">
                          <option value="">-- Choose an In3D.Ai Style --</option>
            {skyboxStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name} (Model: {style.model})
              </option>
            ))}
          </select>
          <p className="text-gray-400 mt-2">Dropdown populated with {skyboxStyles.length} In3D.Ai styles</p>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">First 5 Styles Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skyboxStyles.slice(0, 5).map((style) => (
              <div key={style.id} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400">{style.name}</h3>
                <p className="text-gray-300 text-sm mt-1">{style.description}</p>
                <p className="text-gray-400 text-xs mt-2">Model: {style.model}</p>
                {style.image_jpg && (
                  <img 
                    src={style.image_jpg} 
                    alt={style.name}
                    className="w-full h-32 object-cover rounded mt-2"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestSkybox; 