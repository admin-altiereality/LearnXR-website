import React from 'react';
import { FaServer } from 'react-icons/fa';

export const ServiceStatusPanel = () => (
  <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 max-w-4xl mx-auto mt-12">
    <h4 className="text-white font-semibold mb-3 flex items-center">
      <FaServer className="w-4 h-4 text-cyan-400 mr-2" />
      System Status
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="flex items-center space-x-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        <div>
          <p className="text-white text-sm font-medium">API Status</p>
          <p className="text-green-400 text-xs">Operational</p>
        </div>
      </div>
      <div className="flex items-center space-x-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        <div>
          <p className="text-white text-sm font-medium">Database</p>
          <p className="text-green-400 text-xs">Connected</p>
        </div>
      </div>
      <div className="flex items-center space-x-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        <div>
          <p className="text-white text-sm font-medium">Storage</p>
          <p className="text-green-400 text-xs">Available</p>
        </div>
      </div>
      <div className="flex items-center space-x-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        <div>
          <p className="text-white text-sm font-medium">3D Engine</p>
          <p className="text-green-400 text-xs">Ready</p>
        </div>
      </div>
    </div>
  </div>
);

export default ServiceStatusPanel; 