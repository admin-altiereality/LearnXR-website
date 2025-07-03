import axios from 'axios';
import React from 'react';

const DownloadPopup = ({ isOpen, onClose, imageUrl, title }) => {
  const handleDownload = async (format) => {
    try {
      if (!imageUrl) {
        throw new Error('No image URL provided');
      }

      // For different formats, we'll use the same image URL but change the extension
      // In a real implementation, you might want to call different API endpoints for different formats
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([imageResponse.data]));
      const link = document.createElement('a');
      link.href = url;
              link.setAttribute('download', `${title || 'In3D.Ai environment'}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1C1C1C] rounded-lg w-[600px] shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-xl text-white">Download</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white">Select the formats you would like to download</span>
            <button className="text-[#00FF94] hover:text-[#00CC77] text-sm">
              Copy Embed Code
            </button>
          </div>

          {/* Download Options */}
          <div className="space-y-6">
            {/* Equirectangular */}
            <div>
              <h4 className="text-white mb-2">Equirectangular</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload('jpg')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  JPG
                </button>
                <button
                  onClick={() => handleDownload('png')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </button>
              </div>
            </div>

            {/* Cube Map */}
            <div>
              <h4 className="text-white mb-2">Cube Map</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload('default')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Default
                </button>
                <button
                  onClick={() => handleDownload('roblox')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Roblox
                </button>
              </div>
            </div>

            {/* NEW 32-BIT HDRI */}
            <div className="bg-gradient-to-r from-[#00FFB2] to-[#FF8A00] bg-opacity-10 p-4 rounded-lg">
              <h4 className="text-white mb-2">NEW 32-BIT HDRI</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload('hdr')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .HDR
                </button>
                <button
                  onClick={() => handleDownload('exr')}
                  className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333333] text-white px-4 py-2 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .EXR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPopup; 