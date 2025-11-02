import React from 'react';
import { createRoot } from 'react-dom/client';

const PopupApp: React.FC = () => {
  return (
    <div className="w-96 h-screen bg-white text-black font-sans">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Silence Notes</h1>
        <p className="text-gray-600 mb-4">Extension loaded successfully!</p>
        <div className="space-y-2">
          <button className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Create Note
          </button>
          <button className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
            View All Notes
          </button>
        </div>
      </div>
    </div>
  );
};

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<PopupApp />);
  }
});