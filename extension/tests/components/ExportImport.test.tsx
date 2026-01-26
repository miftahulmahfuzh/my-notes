/**
 * ExportImport component tests for Silence Notes Chrome Extension
 * Tests export and import functionality for various file formats
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ExportImport from '../../src/components/ExportImport';

// Mock file helper functions
const createMockFile = (filename: string, content: string, type: string): File => {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
};

describe('ExportImport Component', () => {
  let mockAuthToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthToken = 'test-auth-token';
    localStorage.setItem('authToken', mockAuthToken);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock document.createElement for download link (only for 'a' tags)
    const originalCreateElement = document.createElement.bind(document);
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
      style: {},
    };
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockLink as any;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render export/import tabs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
          requirements: ['Valid JSON or ZIP file'],
          security_notes: ['Files are validated before import'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export & Import')).toBeInTheDocument();
        expect(screen.getAllByText('Export Data')).toHaveLength(2);
        expect(screen.getByText('Import Data')).toBeInTheDocument();
      });
    });

    it('should start on export tab', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
          requirements: ['Valid JSON or ZIP file'],
          security_notes: ['Files are validated before import'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        const exportTabs = screen.getAllByText('Export Data');
        const exportTab = exportTabs.find(el => el.classList.contains('tab-button'));
        expect(exportTab).toHaveClass('active');
      });
    });

    it('should switch to import tab when clicked', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
          requirements: ['Valid JSON or ZIP file'],
          security_notes: ['Files are validated before import'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        const importTab = screen.getByText('Import Data');
        expect(importTab).toBeInTheDocument();
      });

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(importTab).toHaveClass('active');
      });
    });
  });

  describe('Export Functionality', () => {
    const mockExportFormats = [
      {
        format: 'json',
        name: 'JSON',
        description: 'Complete data export in structured format',
        content_type: 'application/json',
        file_extension: '.json',
      },
      {
        format: 'markdown',
        name: 'Markdown',
        description: 'Individual files for each note',
        content_type: 'text/markdown',
        file_extension: '.md.zip',
      },
      {
        format: 'html',
        name: 'HTML',
        description: 'Web-friendly format for viewing',
        content_type: 'text/html',
        file_extension: '.html',
      },
      {
        format: 'zip',
        name: 'ZIP Archive',
        description: 'Multiple formats in one archive',
        content_type: 'application/zip',
        file_extension: '.zip',
      },
    ];

    beforeEach(() => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: mockExportFormats }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: {
            get: (name: string) => {
              if (name === 'content-disposition') {
                return `attachment; filename="silence-notes-export-2024-01-15.json"`;
              }
              return null;
            },
          },
          blob: () => Promise.resolve(new Blob(['{"notes":[]}'], { type: 'application/json' })),
        });
      });
    });

    it('should load and display export formats', async () => {
      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/JSON - Complete data export/)).toBeInTheDocument();
        expect(screen.getByText(/Markdown - Individual files/)).toBeInTheDocument();
        expect(screen.getByText(/HTML - Web-friendly format/)).toBeInTheDocument();
        expect(screen.getByText(/ZIP Archive - Multiple formats/)).toBeInTheDocument();
      });
    });

    it('should export to JSON format', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [
            { id: 'json', name: 'JSON', description: 'Complete data export' },
            { id: 'markdown', name: 'Markdown', description: 'Individual files' },
            { id: 'html', name: 'HTML', description: 'Web-friendly format' },
            { id: 'zip', name: 'ZIP Archive', description: 'Multiple formats' },
          ],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Export Format');
      await userEvent.selectOptions(formatSelect, 'json');

      const exportButtons = screen.getAllByText('Export Data');
      const exportButton = exportButtons.find(el => el.classList.contains('export-btn'));
      await userEvent.click(exportButton!);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/export?format=json',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
          })
        );
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should export to Markdown format', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [
            { id: 'json', name: 'JSON', description: 'Complete data export' },
            { id: 'markdown', name: 'Markdown', description: 'Individual files' },
            { id: 'html', name: 'HTML', description: 'Web-friendly format' },
            { id: 'zip', name: 'ZIP Archive', description: 'Multiple formats' },
          ],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Export Format');
      await userEvent.selectOptions(formatSelect, 'markdown');

      const exportButtons = screen.getAllByText('Export Data');
      const exportButton = exportButtons.find(el => el.classList.contains('export-btn'));
      await userEvent.click(exportButton!);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/export?format=markdown',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
          })
        );
      });
    });

    it('should export to HTML format', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [
            { id: 'json', name: 'JSON', description: 'Complete data export' },
            { id: 'markdown', name: 'Markdown', description: 'Individual files' },
            { id: 'html', name: 'HTML', description: 'Web-friendly format' },
            { id: 'zip', name: 'ZIP Archive', description: 'Multiple formats' },
          ],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Export Format');
      await userEvent.selectOptions(formatSelect, 'html');

      const exportButtons = screen.getAllByText('Export Data');
      const exportButton = exportButtons.find(el => el.classList.contains('export-btn'));
      await userEvent.click(exportButton!);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/export?format=html',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
          })
        );
      });
    });

    it('should export to ZIP format', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [
            { id: 'json', name: 'JSON', description: 'Complete data export' },
            { id: 'markdown', name: 'Markdown', description: 'Individual files' },
            { id: 'html', name: 'HTML', description: 'Web-friendly format' },
            { id: 'zip', name: 'ZIP Archive', description: 'Multiple formats' },
          ],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Export Format');
      await userEvent.selectOptions(formatSelect, 'zip');

      const exportButtons = screen.getAllByText('Export Data');
      const exportButton = exportButtons.find(el => el.classList.contains('export-btn'));
      await userEvent.click(exportButton!);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/export?format=zip',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
          })
        );
      });
    });

    it('should show loading state while exporting', async () => {
      let exportResolver: (value: any) => void;
      const exportPromise = new Promise((resolve) => {
        exportResolver = resolve;
      });

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: mockExportFormats }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        return exportPromise;
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export Data');
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
        expect(exportButton).toBeDisabled();
      });

      exportResolver!({
        ok: true,
        headers: {
          get: () => `attachment; filename="export.json"`,
        },
        blob: () => Promise.resolve(new Blob(['{}'])),
      });

      await waitFor(() => {
        expect(screen.getByText('Export Data')).toBeInTheDocument();
      });
    });

    it('should handle export failure', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: mockExportFormats }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          statusText: 'Internal Server Error',
        });
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export Data');
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Export failed. Please try again.');
      });

      alertSpy.mockRestore();
    });

    it('should not export when not authenticated', async () => {
      localStorage.removeItem('authToken');
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: mockExportFormats,
          supported_formats: ['json', 'zip'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export Data');
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please log in to export data');
      });

      alertSpy.mockRestore();
    });
  });

  describe('Import Functionality', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: {
                note_count: 5,
                version: '1.0',
                exported_at: '2024-01-15T10:30:00Z',
              },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import successful',
              imported_notes: 5,
              imported_tags: 3,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('should display file input on import tab', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
        expect(screen.getByText(/Supported formats:/)).toBeInTheDocument();
      });
    });

    it('should validate selected JSON file', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [], version: '1.0' }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/import/validate',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should validate selected ZIP file', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.zip',
        'mock-zip-content',
        'application/zip'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/import/validate',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should show validation result with preview', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('File Validation')).toBeInTheDocument();
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
        expect(screen.getByText(/Notes: 5/)).toBeInTheDocument();
        expect(screen.getByText(/Version: 1.0/)).toBeInTheDocument();
        expect(screen.getByText(/Exported: 2024-01-15T10:30:00Z/)).toBeInTheDocument();
      });
    });

    it('should show validation errors for invalid file', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: false,
              errors: ['Invalid file format', 'Missing required fields'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'invalid.json',
        'invalid content',
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✗ File validation failed:')).toBeInTheDocument();
        expect(screen.getByText('Invalid file format')).toBeInTheDocument();
        expect(screen.getByText('Missing required fields')).toBeInTheDocument();
      });
    });

    it('should show validation warnings', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
              warnings: ['Some tags may be duplicated', 'Old format detected'],
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import successful',
              imported_notes: 5,
              imported_tags: 3,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('Warnings:')).toBeInTheDocument();
        expect(screen.getByText('Some tags may be duplicated')).toBeInTheDocument();
        expect(screen.getByText('Old format detected')).toBeInTheDocument();
      });
    });

    it('should import from JSON file', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/import',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockAuthToken}`,
            }),
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should import from ZIP file', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.zip',
        'mock-zip-content',
        'application/zip'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/import',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should show import results', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import completed successfully',
              imported_notes: 10,
              imported_tags: 5,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Result')).toBeInTheDocument();
        expect(screen.getByText('Import completed successfully')).toBeInTheDocument();
        expect(screen.getByText('Notes imported: 10')).toBeInTheDocument();
        expect(screen.getByText('Tags imported: 5')).toBeInTheDocument();
      });
    });

    it('should show import result with success class', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import successful',
              imported_notes: 5,
              imported_tags: 3,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        const resultDiv = screen.getByText('Import Result').closest('.import-result');
        expect(resultDiv).toHaveClass('success');
      });
    });

    it('should show import errors', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import completed with warnings',
              imported_notes: 8,
              imported_tags: 4,
              errors: ['Note 3 has invalid content', 'Tag "test" is duplicate'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Errors:')).toBeInTheDocument();
        expect(screen.getByText('Note 3 has invalid content')).toBeInTheDocument();
        expect(screen.getByText('Tag "test" is duplicate')).toBeInTheDocument();
      });
    });

    it('should show skipped items', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Import completed',
              imported_notes: 3,
              imported_tags: 2,
              skipped_items: ['Note "duplicate" already exists', 'Tag "old" is outdated'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Skipped Items:')).toBeInTheDocument();
        expect(screen.getByText('Note "duplicate" already exists')).toBeInTheDocument();
        expect(screen.getByText('Tag "old" is outdated')).toBeInTheDocument();
      });
    });

    it('should disable import button when no file selected', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      expect(importButton).toBeDisabled();
    });

    it('should show loading state while importing', async () => {
      let importResolver: (value: any) => void;
      const importPromise = new Promise((resolve) => {
        importResolver = resolve;
      });

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return importPromise;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Importing...')).toBeInTheDocument();
        expect(importButton).toBeDisabled();
      });

      importResolver!({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Import successful',
          imported_notes: 5,
          imported_tags: 3,
        }),
      });

      await waitFor(() => {
        expect(screen.getByText('Import Data')).toBeInTheDocument();
      });
    });

    it('should handle import failure', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              valid: true,
              preview: { note_count: 5 },
            }),
          });
        }
        if (url.includes('/api/v1/import')) {
          return Promise.resolve({
            ok: false,
            statusText: 'Bad Request',
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Import failed. Please try again.');
      });

      alertSpy.mockRestore();
    });

    it('should not import when no file selected', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json', 'zip'],
              requirements: ['Valid JSON or ZIP file'],
              security_notes: ['Files are validated before import'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByText('Import Data')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please select a file to import');
      });

      alertSpy.mockRestore();
    });

    it('should not import when not authenticated', async () => {
      localStorage.removeItem('authToken');
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
        }),
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please log in to import data');
      });

      alertSpy.mockRestore();
    });

    it('should clear file input after successful import', async () => {
      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('✓ File is valid and ready for import')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Data');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import successful')).toBeInTheDocument();
      });

      expect(screen.getByText('Import Data')).toBeDisabled();
    });
  });

  describe('Import Help Information', () => {
    it('should display supported formats', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['JSON', 'ZIP'],
              requirements: ['Valid file format', 'Proper structure'],
              security_notes: ['Files are validated', 'Malicious files rejected'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByText('Import Information')).toBeInTheDocument();
        expect(screen.getByText('Supported Formats:')).toBeInTheDocument();
        expect(screen.getByText('JSON')).toBeInTheDocument();
        expect(screen.getByText('ZIP')).toBeInTheDocument();
      });
    });

    it('should display requirements', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['JSON'],
              requirements: [
                'File must be valid JSON',
                'Must contain notes array',
                'Version field required',
              ],
              security_notes: ['Files are validated'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByText('Requirements:')).toBeInTheDocument();
        expect(screen.getByText('File must be valid JSON')).toBeInTheDocument();
        expect(screen.getByText('Must contain notes array')).toBeInTheDocument();
        expect(screen.getByText('Version field required')).toBeInTheDocument();
      });
    });

    it('should display security notes', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['JSON'],
              requirements: ['Valid JSON'],
              security_notes: [
                'All files are validated before import',
                'Malicious content is rejected',
                'Import does not overwrite existing data',
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByText('Security Notes:')).toBeInTheDocument();
        expect(screen.getByText('All files are validated before import')).toBeInTheDocument();
        expect(screen.getByText('Malicious content is rejected')).toBeInTheDocument();
        expect(screen.getByText('Import does not overwrite existing data')).toBeInTheDocument();
      });
    });
  });

  describe('Export Help Information', () => {
    it('should display export information', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
          requirements: ['Valid file'],
          security_notes: ['Files validated'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Information')).toBeInTheDocument();
      });
    });

    it('should list export format descriptions', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          formats: [],
          supported_formats: ['json', 'zip'],
          requirements: ['Valid file'],
          security_notes: ['Files validated'],
        }),
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText(/JSON: Complete data export/)).toBeInTheDocument();
        expect(screen.getByText(/Markdown: Individual files/)).toBeInTheDocument();
        expect(screen.getByText(/HTML: Web-friendly format/)).toBeInTheDocument();
        expect(screen.getByText(/ZIP: Multiple formats/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Switching', () => {
    it('should maintain state when switching tabs', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              formats: [
                {
                  format: 'json',
                  name: 'JSON',
                  description: 'Complete data export',
                  content_type: 'application/json',
                  file_extension: '.json',
                },
              ],
            }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json'],
              requirements: ['Valid JSON'],
              security_notes: ['Validated'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      await waitFor(() => {
        expect(screen.getByText('Export Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Export Format');
      await userEvent.selectOptions(formatSelect, 'json');

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const exportTab = screen.getByText('Export Data');
      await userEvent.click(exportTab);

      await waitFor(() => {
        expect(screen.getByDisplayValue('json')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<ExportImport />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle validation errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/export/formats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ formats: [] }),
          });
        }
        if (url.includes('/api/v1/import/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              supported_formats: ['json'],
              requirements: ['Valid JSON'],
              security_notes: ['Validated'],
            }),
          });
        }
        if (url.includes('/api/v1/import/validate')) {
          return Promise.reject(new Error('Validation failed'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ExportImport />);

      const importTab = screen.getByText('Import Data');
      await userEvent.click(importTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText('Select File');
      const mockFile = createMockFile(
        'notes-export.json',
        JSON.stringify({ notes: [] }),
        'application/json'
      );

      await userEvent.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
