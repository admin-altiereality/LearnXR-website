import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ServiceStatusPanel } from '../Components/ServiceStatusPanel';
import { MeshyTestPanel } from '../Components/MeshyTestPanel';
import { MeshyDebugPanel } from '../Components/MeshyDebugPanel';
import { FaServer, FaWifi, FaCog } from 'react-icons/fa';

const SystemStatus = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('system-status');

  // Get the initial tab from URL params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'system-status';
    // Validate the tab parameter
    const validTabs = ['system-status', 'test-panel', 'debug-panel'];
    if (!validTabs.includes(tab)) {
      // Redirect to default tab if invalid
      navigate('/system-status?tab=system-status', { replace: true });
      return;
    }
    setActiveTab(tab);
  }, [searchParams, navigate]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'system-status',
      name: 'System Status',
      icon: FaServer,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    {
      id: 'test-panel',
      name: 'Test Panel',
      icon: FaWifi,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    {
      id: 'debug-panel',
      name: 'Debug Panel',
      icon: FaCog,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'system-status':
        return <ServiceStatusPanel />;
      case 'test-panel':
        return <MeshyTestPanel />;
      case 'debug-panel':
        return <MeshyDebugPanel />;
      default:
        return <ServiceStatusPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🛠️ System Status Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Monitor system health, test integrations, and debug services
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-center mb-8">
          <nav className="flex space-x-1 rounded-lg backdrop-blur-md bg-white/5 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id
                    ? `${tab.bgColor} ${tab.color} border ${tab.borderColor}`
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div key={activeTab} className="animate-fadeIn">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SystemStatus; 