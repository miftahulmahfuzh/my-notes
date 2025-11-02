/**
 * Storage migration utilities for data versioning and upgrades
 */

import { DataMigration } from '../types/storage';
import { storageService } from '../services/storage';

export class StorageMigrationManager {
  private migrations: DataMigration[] = [];
  private currentVersion: string = '1.0.0';

  constructor() {
    this.registerMigrations();
  }

  /**
   * Register all data migrations
   */
  private registerMigrations(): void {
    // Migration 1.0.0 -> 1.0.1: Add metadata fields
    this.addMigration({
      version: '1.0.1',
      description: 'Add enhanced metadata and conflict tracking',
      migrate: async (data) => {
        // Add new metadata fields if they don't exist
        if (!data.metadata) {
          data.metadata = {
            version: '1.0.1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            storageSize: 0
          };
        }

        // Initialize sync data if it doesn't exist
        if (!data.sync) {
          data.sync = {
            lastSyncAt: null,
            pendingChanges: [],
            conflicts: []
          };
        }

        // Add missing fields to existing notes
        data.notes = data.notes.map(note => ({
          ...note,
          version: note.version || 1,
          user_id: note.user_id || ''
        }));

        return data;
      },
      rollback: async (data) => {
        // Remove new metadata fields
        if (data.metadata) {
          delete data.metadata.storageSize;
        }
        return data;
      }
    });

    // Migration 1.0.1 -> 1.0.2: Add settings structure
    this.addMigration({
      version: '1.0.2',
      description: 'Add user settings and preferences',
      migrate: async (data) => {
        if (!data.settings) {
          data.settings = {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          };
        }

        // Update metadata version
        data.metadata.version = '1.0.2';
        data.metadata.updatedAt = new Date().toISOString();

        return data;
      },
      rollback: async (data) => {
        delete data.settings;
        if (data.metadata) {
          data.metadata.version = '1.0.1';
        }
        return data;
      }
    });

    // Migration 1.0.2 -> 1.0.3: Add note tags array
    this.addMigration({
      version: '1.0.3',
      description: 'Add tags array for better organization',
      migrate: async (data) => {
        if (!data.tags) {
          data.tags = [];

          // Extract existing hashtags from notes
          const extractedTags = new Set<string>();
          data.notes.forEach(note => {
            const hashtags = note.content.match(/#\w+/g) || [];
            hashtags.forEach(tag => extractedTags.add(tag));
          });

          data.tags = Array.from(extractedTags);
        }

        data.metadata.version = '1.0.3';
        data.metadata.updatedAt = new Date().toISOString();

        return data;
      },
      rollback: async (data) => {
        delete data.tags;
        if (data.metadata) {
          data.metadata.version = '1.0.2';
        }
        return data;
      }
    });
  }

  /**
   * Add a migration to the registry
   */
  public addMigration(migration: DataMigration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Get current storage version
   */
  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Check if migration is needed
   */
  public async needsMigration(): Promise<boolean> {
    try {
      const data = await storageService.getData();
      const currentDataVersion = data.metadata.version;

      if (currentDataVersion === this.currentVersion) {
        return false;
      }

      // Check if there are migrations to run
      const pendingMigrations = this.migrations.filter(
        migration => migration.version > currentDataVersion
      );

      return pendingMigrations.length > 0;
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return false;
    }
  }

  /**
   * Run all pending migrations
   */
  public async migrate(): Promise<boolean> {
    try {
      const data = await storageService.getData();
      const currentDataVersion = data.metadata.version;
      const pendingMigrations = this.migrations.filter(
        migration => migration.version > currentDataVersion
      );

      console.log(`Running ${pendingMigrations.length} migrations from ${currentDataVersion} to ${this.currentVersion}`);

      let migratedData = data;

      for (const migration of pendingMigrations) {
        console.log(`Running migration ${migration.version}: ${migration.description}`);

        try {
          migratedData = await migration.migrate(migratedData);
          console.log(`Migration ${migration.version} completed successfully`);
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);

          // Try to rollback if rollback function is available
          if (migration.rollback) {
            try {
              console.log(`Attempting to rollback migration ${migration.version}`);
              migratedData = await migration.rollback(migratedData);
              console.log(`Rollback of migration ${migration.version} completed`);
            } catch (rollbackError) {
              console.error(`Rollback of migration ${migration.version} failed:`, rollbackError);
            }
          }

          throw error;
        }
      }

      // Update to latest version
      migratedData.metadata.version = this.currentVersion;
      migratedData.metadata.updatedAt = new Date().toISOString();

      // Save migrated data
      await storageService['setRawData'](migratedData);

      console.log(`All migrations completed successfully. Now at version ${this.currentVersion}`);
      return true;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Validate data integrity
   */
  public async validateData(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const data = await storageService.getData();

      // Check required fields
      if (!data.metadata) {
        errors.push('Missing metadata object');
      } else {
        if (!data.metadata.version) {
          errors.push('Missing version in metadata');
        }
        if (!data.metadata.createdAt) {
          warnings.push('Missing creation date in metadata');
        }
      }

      if (!Array.isArray(data.notes)) {
        errors.push('Notes must be an array');
      } else {
        // Validate each note
        data.notes.forEach((note, index) => {
          if (!note.id) {
            errors.push(`Note ${index} missing id`);
          }
          if (!note.content) {
            warnings.push(`Note ${index} missing content`);
          }
          if (!note.created_at) {
            warnings.push(`Note ${index} missing created_at`);
          }
          if (!note.updated_at) {
            warnings.push(`Note ${index} missing updated_at`);
          }
        });
      }

      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      }

      if (!data.settings) {
        errors.push('Missing settings object');
      }

      if (!data.sync) {
        errors.push('Missing sync object');
      }

      // Check storage quota
      const quotaInfo = await storageService.getQuotaInfo();
      if (quotaInfo.isOverLimit) {
        errors.push('Storage quota exceeded');
      } else if (quotaInfo.isNearLimit) {
        warnings.push('Storage quota nearly full');
      }

    } catch (error) {
      errors.push(`Failed to validate data: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Repair common data issues
   */
  public async repairData(): Promise<boolean> {
    try {
      const data = await storageService.getData();
      let repaired = false;

      // Fix missing metadata
      if (!data.metadata) {
        data.metadata = {
          version: this.currentVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storageSize: 0
        };
        repaired = true;
      }

      // Fix missing sync data
      if (!data.sync) {
        data.sync = {
          lastSyncAt: null,
          pendingChanges: [],
          conflicts: []
        };
        repaired = true;
      }

      // Fix missing settings
      if (!data.settings) {
        data.settings = {
          theme: 'light',
          language: 'en',
          autoSave: true,
          syncEnabled: true
        };
        repaired = true;
      }

      // Fix missing tags array
      if (!Array.isArray(data.tags)) {
        data.tags = [];
        repaired = true;
      }

      // Fix notes array issues
      if (Array.isArray(data.notes)) {
        data.notes = data.notes.map(note => {
          // Fix missing required fields
          if (!note.id) {
            note.id = `repaired_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            repaired = true;
          }

          if (!note.created_at) {
            note.created_at = new Date().toISOString();
            repaired = true;
          }

          if (!note.updated_at) {
            note.updated_at = new Date().toISOString();
            repaired = true;
          }

          if (!note.version) {
            note.version = 1;
            repaired = true;
          }

          if (!note.user_id) {
            note.user_id = '';
            repaired = true;
          }

          return note;
        });
      }

      // Remove duplicate notes
      if (Array.isArray(data.notes)) {
        const noteIds = new Set();
        const uniqueNotes = data.notes.filter(note => {
          if (noteIds.has(note.id)) {
            repaired = true;
            return false;
          }
          noteIds.add(note.id);
          return true;
        });
        data.notes = uniqueNotes;
      }

      if (repaired) {
        data.metadata.updatedAt = new Date().toISOString();
        await storageService['setRawData'](data);
        console.log('Data repair completed');
      }

      return true;

    } catch (error) {
      console.error('Failed to repair data:', error);
      return false;
    }
  }

  /**
   * Export data for backup
   */
  public async exportData(): Promise<string> {
    try {
      const data = await storageService.getData();
      const exportData = {
        ...data,
        exportedAt: new Date().toISOString(),
        exportVersion: this.currentVersion
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import data from backup
   */
  public async importData(jsonData: string, options: {
    merge?: boolean;
    overwrite?: boolean;
  } = {}): Promise<boolean> {
    try {
      const importData = JSON.parse(jsonData);
      const { merge = false, overwrite = false } = options;

      if (!merge && !overwrite) {
        throw new Error('Either merge or overwrite must be specified');
      }

      if (overwrite) {
        // Replace all data
        importData.metadata.updatedAt = new Date().toISOString();
        importData.metadata.version = this.currentVersion;
        await storageService['setRawData'](importData);
      } else {
        // Merge with existing data
        const existingData = await storageService.getData();

        // Merge notes, avoiding duplicates
        const existingNoteIds = new Set(existingData.notes.map(n => n.id));
        const newNotes = importData.notes?.filter((note: any) => !existingNoteIds.has(note.id)) || [];
        existingData.notes.push(...newNotes);

        // Merge tags
        const existingTags = new Set(existingData.tags);
        const newTags = importData.tags?.filter((tag: string) => !existingTags.has(tag)) || [];
        existingData.tags.push(...newTags);

        // Update metadata
        existingData.metadata.updatedAt = new Date().toISOString();
        existingData.metadata.version = this.currentVersion;

        await storageService['setRawData'](existingData);
      }

      console.log('Data import completed successfully');
      return true;

    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const storageMigrationManager = new StorageMigrationManager();