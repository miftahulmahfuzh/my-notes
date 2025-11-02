import React from 'react';
import { createRoot } from 'react-dom/client';

const OptionsApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Silence Notes Settings</h1>

        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3">General Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label>Enable notifications</label>
                <input type="checkbox" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <label>Auto-sync notes</label>
                <input type="checkbox" defaultChecked />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3">About</h2>
            <p className="text-gray-600">
              Silence Notes v1.0.0<br />
              A brutalist note-taking Chrome extension
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Initialize the options page
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<OptionsApp />);
  }
});