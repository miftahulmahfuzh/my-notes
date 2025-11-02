import React, { useState, useEffect } from 'react';
import Settings from '../components/Settings';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const Popup: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Load notes from Chrome storage
    chrome.storage.local.get(['notes'], (result) => {
      if (result.notes) {
        setNotes(result.notes);
      }
      setIsLoading(false);
    });
  }, []);

  const handleCreateNote = () => {
    if (!newNote.trim()) return;

    const note: Note = {
      id: Date.now().toString(),
      title: newNote.split('\n')[0].substring(0, 50),
      content: newNote,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNewNote('');

    // Save to Chrome storage
    chrome.storage.local.set({ notes: updatedNotes });
  };

  const handleDeleteNote = (id: string) => {
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);

    // Save to Chrome storage
    chrome.storage.local.set({ notes: updatedNotes });
  };

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Silence Notes</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="settings-btn"
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m11-7l4.24 4.24M12 17l-4.24 4.24M20.24 4.76L16 9M8 15l-4.24 4.24"></path>
          </svg>
        </button>
      </header>

      <main className="main">
        <div className="note-creator">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Create a new note..."
            className="note-input"
          />
          <button
            onClick={handleCreateNote}
            className="create-btn"
            disabled={!newNote.trim()}
          >
            Create Note
          </button>
        </div>

        <div className="notes-list">
          {notes.map(note => (
            <div key={note.id} className="note-item">
              <h3 className="note-title">{note.title}</h3>
              <p className="note-content">{note.content}</p>
              <div className="note-actions">
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};