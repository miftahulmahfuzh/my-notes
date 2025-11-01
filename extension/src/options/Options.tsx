import React, { useState, useEffect } from 'react';

export const Options: React.FC = () => {
  const [settings, setSettings] = useState({
    autoSync: true,
    syncInterval: 30, // minutes
    theme: 'light'
  });

  useEffect(() => {
    // Load settings from Chrome storage
    chrome.storage.sync.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  }, []);

  const handleSettingChange = (key: string, value: any) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    // Save to Chrome storage
    chrome.storage.sync.set({ settings: updatedSettings });
  };

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>Silence Notes Options</h1>
      </header>

      <main className="options-main">
        <div className="settings-section">
          <h2>Synchronization</h2>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
              />
              Auto-sync notes
            </label>
          </div>

          <div className="setting-item">
            <label>
              Sync interval (minutes):
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.syncInterval}
                onChange={(e) => handleSettingChange('syncInterval', parseInt(e.target.value))}
                disabled={!settings.autoSync}
              />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h2>Appearance</h2>

          <div className="setting-item">
            <label>
              Theme:
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
};