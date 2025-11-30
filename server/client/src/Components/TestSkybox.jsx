import React, { useState, useEffect } from 'react';
import { skyboxApiService } from '../services/skyboxApiService';

const TestSkybox = () => {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  const testHealthCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      const healthData = await skyboxApiService.healthCheck();
      setHealth(healthData);
      console.log('Health check successful:', healthData);
    } catch (err) {
      setError(err.message);
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const testGetStyles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await skyboxApiService.getStyles(1, 10);
      // Handle nested response structure: { success, data: { styles: [...] } }
      const rawStyles = response?.data?.styles || response?.styles || response?.data || [];
      const stylesArr = Array.isArray(rawStyles) ? rawStyles : [];
      setStyles(stylesArr);
      console.log('Styles fetched successfully:', stylesArr);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch styles:', err);
    } finally {
      setLoading(false);
    }
  };

  const testGenerateSkybox = async () => {
    try {
      setLoading(true);
      setError(null);
      const generationRequest = {
        prompt: "A beautiful fantasy landscape with mountains and a castle",
        style_id: 2, // Fantasy style
        negative_prompt: "dark, scary, ugly"
      };
      
      const response = await skyboxApiService.generateSkybox(generationRequest);
      console.log('Skybox generation started:', response.data);
      
      // Check status after a few seconds
      setTimeout(async () => {
        try {
          const statusResponse = await skyboxApiService.getSkyboxStatus(response.data.id);
          console.log('Skybox status:', statusResponse.data);
        } catch (statusErr) {
          console.error('Failed to check status:', statusErr);
        }
      }, 3000);
      
    } catch (err) {
      setError(err.message);
      console.error('Failed to generate skybox:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Skybox API Test</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testHealthCheck}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-4"
        >
          Test Health Check
        </button>
        
        <button
          onClick={testGetStyles}
          disabled={loading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-4"
        >
          Test Get Styles
        </button>
        
        <button
          onClick={testGenerateSkybox}
          disabled={loading}
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          Test Generate Skybox
        </button>
      </div>

      {loading && (
        <div className="text-blue-600 font-semibold">Loading...</div>
      )}

      {error && (
        <div className="text-red-600 font-semibold mb-4">
          Error: {error}
        </div>
      )}

      {health && (
        <div className="bg-gray-100 p-4 rounded mb-4">
          <h2 className="text-xl font-semibold mb-2">Health Check Results:</h2>
          <pre className="text-sm">{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}

      {styles.length > 0 && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Available Styles ({styles.length}):</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {styles.map((style) => (
              <div key={style.id} className="bg-white p-3 rounded shadow">
                <h3 className="font-semibold">{style.name}</h3>
                <p className="text-sm text-gray-600">{style.description}</p>
                <p className="text-xs text-gray-500">Model: {style.model} v{style.model_version}</p>
                {style.image && (
                  <img 
                    src={style.image} 
                    alt={style.name}
                    className="w-full h-32 object-cover rounded mt-2"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSkybox; 