import React from 'react';

interface SettingsProps {
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h3>Settings</h3>
          <button
            onClick={onClose}
            className="close-btn"
            title="Close settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <div className="general-settings">
              <h4>General Settings</h4>
              <div className="setting-item">
                <label>Auto-save</label>
                <div className="setting-description">
                  Notes are automatically saved every 2 seconds
                </div>
              </div>
              <div className="setting-item">
                <label>Theme</label>
                <div className="setting-description">
                  Uses system preference (light/dark mode)
                </div>
              </div>
              <div className="setting-item">
                <label>Sync Status</label>
                <div className="setting-description">
                  Notes are synced with the server automatically
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;