import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const History = ({ setBackgroundSkybox }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const skyboxesRef = collection(db, 'skyboxes');
    const skyboxQuery = query(
      skyboxesRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      skyboxQuery,
      (snapshot) => {
        try {
          const skyboxes = snapshot.docs.flatMap(doc => {
            const data = doc.data();
            const baseSkybox = {
              id: doc.id,
              file_url: data.imageUrl,
              title: data.title || data.promptUsed || 'Untitled Generation',
              prompt: data.promptUsed,
              created_at: data.createdAt,
              status: data.status,
              metadata: data.metadata,
              isVariation: false
            };

            // If there are variations, create entries for each one
            if (data.variations && Array.isArray(data.variations)) {
              return [
                baseSkybox,
                ...data.variations.map((variation, index) => ({
                  id: `${doc.id}_variation_${index}`,
                  file_url: variation.image,
                  title: `${baseSkybox.title} (Variation ${index + 1})`,
                  prompt: variation.prompt || baseSkybox.prompt,
                  created_at: data.createdAt,
                  status: data.status,
                  metadata: data.metadata,
                  isVariation: true,
                  parentId: doc.id
                }))
              ];
            }

            return [baseSkybox];
          });

          setHistory(skyboxes);
          setLoading(false);
        } catch (err) {
          console.error("Error processing skybox data:", err);
          setError("Error processing skybox data");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error in real-time listener:", err);
        setError(`Failed to load generation history: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSkyboxClick = (item) => {
    if (!item.file_url) {
      console.warn("No file URL available for this skybox");
      return;
    }

    setSelectedSkybox(item);
    const skyboxData = {
      image: item.file_url,
      image_jpg: item.file_url,
      title: formatTitle(item.title),
      prompt: item.prompt,
      metadata: item.metadata
    };
    setBackgroundSkybox(skyboxData);

    console.log('Skybox applied:', skyboxData);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    const date = new Date(timestamp);
    return isNaN(date.getTime()) 
      ? 'Invalid Date'
      : date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
  };

  const formatTitle = (title) => {
    if (!title) return 'Untitled Generation';
    return title.replace(/^World #\d+ /, '').trim();
  };

  return (
    <div className="flex-1 bg-transparent min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white/90">Generation History</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500/10 hover:bg-blue-600/20 text-blue-300 rounded-lg transition-all duration-200 backdrop-blur-sm border border-blue-500/20"
          >
            Back to Generator
          </button>
        </div>
        
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 backdrop-blur-sm rounded-lg border border-red-500/20">
            <p className="text-red-300">{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-t-2 border-b-2 border-blue-400 rounded-full animate-spin"></div>
              <p className="text-blue-300">Loading your generations...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-gray-900/20 backdrop-blur-sm rounded-lg p-8 text-center border border-gray-700/20">
            <p className="text-gray-300 text-lg">No generations found in history</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 bg-blue-500/10 hover:bg-blue-600/20 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/20"
            >
              Create Your First Skybox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSkyboxClick(item)}
                className={`
                  relative group bg-gray-900/20 backdrop-blur-sm rounded-lg overflow-hidden
                  transform transition-all duration-300 hover:scale-[1.02] cursor-pointer
                  border border-gray-700/20 hover:border-blue-500/30 active:scale-95
                  ${selectedSkybox?.id === item.id ? 'ring-2 ring-blue-500/50' : ''}
                  ${item.isVariation ? 'border-l-4 border-l-purple-500/50' : ''}
                `}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSkyboxClick(item);
                  }
                }}
              >
                <div className="aspect-w-16 aspect-h-9 relative">
                  {item.file_url ? (
                    <img
                      src={item.file_url}
                      alt={formatTitle(item.title)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800/30 flex items-center justify-center">
                      <span className="text-gray-400">No image available</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent 
                                opacity-0 group-hover:opacity-100 transition-opacity duration-300 
                                flex items-center justify-center">
                    <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-white 
                                     rounded-lg transform translate-y-2 group-hover:translate-y-0 
                                     transition-transform duration-300 backdrop-blur-md 
                                     border border-blue-500/30">
                      Apply Skybox
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/10 backdrop-blur-sm">
                  <h2 className="text-white/90 text-lg font-medium mb-2 line-clamp-1">
                    {formatTitle(item.title)}
                  </h2>
                  <p className="text-gray-300/90 text-sm line-clamp-2 mb-3">
                    {item.prompt || 'No prompt available'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400/90 text-xs">
                      {formatDate(item.created_at)}
                    </span>
                    <div className="flex items-center space-x-2">
                      {item.isVariation && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          Variation
                        </span>
                      )}
                      <span className={`
                        px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm
                        ${item.status === 'complete' 
                          ? 'bg-green-500/10 text-green-300 border border-green-500/20' 
                          : item.status === 'pending' 
                          ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20' 
                          : 'bg-red-500/10 text-red-300 border border-red-500/20'}
                      `}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`
                  absolute inset-0 bg-blue-500/10 pointer-events-none
                  transition-opacity duration-200
                  ${selectedSkybox?.id === item.id ? 'opacity-100' : 'opacity-0'}
                `} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
