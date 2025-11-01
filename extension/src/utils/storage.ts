import { Note, Settings } from '../types';

export class StorageService {
  // Notes storage
  static async getNotes(): Promise<Note[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['notes'], (result) => {
        resolve(result.notes || []);
      });
    });
  }

  static async saveNotes(notes: Note[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ notes }, () => resolve());
    });
  }

  static async addNote(note: Note): Promise<void> {
    const notes = await this.getNotes();
    notes.push(note);
    await this.saveNotes(notes);
  }

  static async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    const notes = await this.getNotes();
    const index = notes.findIndex(note => note.id === id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updates, updated_at: new Date().toISOString() };
      await this.saveNotes(notes);
    }
  }

  static async deleteNote(id: string): Promise<void> {
    const notes = await this.getNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    await this.saveNotes(filteredNotes);
  }

  // Settings storage
  static async getSettings(): Promise<Settings> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        resolve(result.settings || {
          autoSync: true,
          syncInterval: 30,
          theme: 'light'
        });
      });
    });
  }

  static async saveSettings(settings: Settings): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings }, () => resolve());
    });
  }

  // Clear all data
  static async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        chrome.storage.sync.clear(() => resolve());
      });
    });
  }
}