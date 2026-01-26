import React, { useState, useRef } from 'react';

interface ExportFormat {
  format: string;
  name: string;
  description: string;
  content_type: string;
  file_extension: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported_notes: number;
  imported_tags: number;
  skipped_items?: string[];
  errors?: string[];
}

const ExportImport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importInfo, setImportInfo] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load export formats on mount
  React.useEffect(() => {
    loadExportFormats();
    loadImportInfo();
  }, []);

  const loadExportFormats = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch('/api/v1/export/formats', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExportFormats(data.formats || []);
      }
    } catch (error) {
      console.error('Failed to load export formats:', error);
    }
  };

  const loadImportInfo = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch('/api/v1/import/info', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setImportInfo(data);
      }
    } catch (error) {
      console.error('Failed to load import info:', error);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('Please log in to export data');
        return;
      }

      const url = `/api/v1/export?format=${selectedFormat}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from content-disposition or generate one
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `silence-notes-export-${new Date().toISOString().split('T')[0]}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Add appropriate extension if not present
      const format = exportFormats.find(f => f.format === selectedFormat);
      if (format && !filename.endsWith(format.file_extension)) {
        filename += format.file_extension;
      }

      // Create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateFile(file);
    }
  };

  const validateFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('Please log in to import data');
        return;
      }

      const response = await fetch('/api/v1/import/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Please select a file to import');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('Please log in to import data');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result: ImportResult = await response.json();
        setImportResult(result);

        if (result.success) {
          // Clear file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setValidationResult(null);
        }
      } else {
        throw new Error('Import failed');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="export-import">
      <div className="export-import-header">
        <h2>Export & Import</h2>
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Export Data
          </button>
          <button
            className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Data
          </button>
        </div>
      </div>

      {activeTab === 'export' && (
        <div className="export-section">
          <div className="form-group">
            <label htmlFor="export-format">Export Format</label>
            <select
              id="export-format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="form-select"
            >
              {exportFormats.map((format) => (
                <option key={format.format} value={format.format}>
                  {format.name} - {format.description}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="export-btn"
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>

          <div className="export-help">
            <h4>Export Information</h4>
            <ul>
              <li>JSON: Complete data export in structured format</li>
              <li>Markdown: Individual files for each note (zipped)</li>
              <li>HTML: Web-friendly format for viewing</li>
              <li>ZIP: Multiple formats in one archive</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="import-section">
          <div className="form-group">
            <label htmlFor="import-file">Select File</label>
            <input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".json,.zip"
              onChange={handleFileSelect}
              className="file-input"
            />
            <p className="file-help">
              Supported formats: JSON files exported from Silence Notes, ZIP archives containing export files
            </p>
          </div>

          {validationResult && (
            <div className={`validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
              <h4>File Validation</h4>
              {validationResult.valid ? (
                <p className="validation-success">✓ File is valid and ready for import</p>
              ) : (
                <div className="validation-errors">
                  <p className="validation-error">✗ File validation failed:</p>
                  <ul>
                    {validationResult.errors?.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.preview && (
                <div className="validation-preview">
                  <p>Preview:</p>
                  <ul>
                    {validationResult.preview.note_count !== undefined && (
                      <li>Notes: {validationResult.preview.note_count}</li>
                    )}
                    {validationResult.preview.version && (
                      <li>Version: {validationResult.preview.version}</li>
                    )}
                    {validationResult.preview.exported_at && (
                      <li>Exported: {validationResult.preview.exported_at}</li>
                    )}
                  </ul>
                </div>
              )}

              {validationResult.warnings?.length > 0 && (
                <div className="validation-warnings">
                  <p>Warnings:</p>
                  <ul>
                    {validationResult.warnings.map((warning: string, index: number) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={isImporting || !fileInputRef.current?.files?.length}
            className="import-btn"
          >
            {isImporting ? 'Importing...' : 'Import Data'}
          </button>

          {importResult && (
            <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
              <h4>Import Result</h4>
              <p>{importResult.message}</p>

              {importResult.success && (
                <div className="import-stats">
                  <p>Notes imported: {importResult.imported_notes}</p>
                  <p>Tags imported: {importResult.imported_tags}</p>
                </div>
              )}

              {importResult.skipped_items?.length > 0 && (
                <div className="skipped-items">
                  <h5>Skipped Items:</h5>
                  <ul>
                    {importResult.skipped_items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.errors?.length > 0 && (
                <div className="import-errors">
                  <h5>Errors:</h5>
                  <ul>
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {importInfo && (
            <div className="import-help">
              <h4>Import Information</h4>

              <div className="supported-formats">
                <h5>Supported Formats:</h5>
                <ul>
                  {importInfo.supported_formats?.map((format: string, index: number) => (
                    <li key={index}>{format}</li>
                  ))}
                </ul>
              </div>

              <div className="requirements">
                <h5>Requirements:</h5>
                <ul>
                  {importInfo.requirements?.map((req: string, index: number) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>

              <div className="security-notes">
                <h5>Security Notes:</h5>
                <ul>
                  {importInfo.security_notes?.map((note: string, index: number) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExportImport;