import { useState, useRef, useCallback } from 'react';
import { api, ApiClientError, NetworkError } from '../lib/apiClient';
import { toast } from '../lib/toast.js';

interface IngestResult {
  totalRows: number;
  inserted: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

export function IngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setUploadError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.csv')) {
      handleFile(f);
    } else if (f) {
      setUploadError('Only .csv files are accepted.');
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setUploadError(null);
    try {
      const text = await file.text();
      // Async ingest: POST returns a jobId; poll until the worker completes it.
      const { jobId } = await api.ingestGrants(text);
      let job = await api.getIngestJob(jobId);
      const deadline = Date.now() + 120_000;
      while (job.status !== 'completed' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1000));
        job = await api.getIngestJob(jobId);
      }
      if (job.status !== 'completed') {
        throw new Error('Ingest timed out — the worker may be down. Check job status later.');
      }
      setResult({
        totalRows: job.totalRows,
        inserted: job.inserted,
        updated: job.updated,
        errors: job.errors,
      });
      toast.success(`Ingested ${job.inserted} new grants${job.updated ? `, updated ${job.updated}` : ''}`);
    } catch (err) {
      if (err instanceof NetworkError) {
        setUploadError(err.message);
      } else if (err instanceof ApiClientError) {
        setUploadError(err.message);
      } else {
        setUploadError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem', color: '#1a1a1a' }}>
        CSV Ingest
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Upload a CSV file to ingest grant records. Existing grants with matching title and PI will be updated; new records will be inserted.
      </p>

      <div
        style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          marginBottom: '2rem',
        }}
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#4a9eff' : file ? '#28a745' : '#ccc'}`,
            borderRadius: '8px',
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragging ? '#f0f7ff' : file ? '#f6fff8' : '#fafafa',
            transition: 'all 0.2s ease',
            marginBottom: '1.5rem',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {file ? '📄' : '⬆️'}
          </div>
          {file ? (
            <>
              <p style={{ fontWeight: '600', color: '#1a1a1a', margin: '0 0 0.25rem' }}>
                {file.name}
              </p>
              <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
                {(file.size / 1024).toFixed(1)} KB — click to replace
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: '600', color: '#333', margin: '0 0 0.25rem' }}>
                Drag and drop a CSV file here, or click to browse
              </p>
              <p style={{ color: '#999', fontSize: '0.875rem', margin: 0 }}>
                Only .csv files are accepted
              </p>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            style={{
              backgroundColor: !file || loading ? '#ccc' : '#1a1a1a',
              color: '#fff',
              border: 'none',
              padding: '0.625rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: !file || loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }}
          >
            {loading ? 'Uploading...' : 'Upload'}
          </button>
          {(file || result || uploadError) && (
            <button
              onClick={handleReset}
              disabled={loading}
              style={{
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ccc',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div
          style={{
            backgroundColor: '#fff5f5',
            border: '1px solid #f5c6cb',
            borderRadius: '8px',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            color: '#721c24',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Upload failed</strong>
          {uploadError}
        </div>
      )}

      {result && (
        <div>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
              marginBottom: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '1.25rem' }}>
              Upload Summary
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
              }}
            >
              {[
                { label: 'Total Rows', value: result.totalRows, color: '#1a1a1a' },
                { label: 'Inserted', value: result.inserted, color: '#28a745' },
                { label: 'Updated', value: result.updated, color: '#4a9eff' },
                { label: 'Errors', value: result.errors.length, color: result.errors.length > 0 ? '#dc3545' : '#999' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    padding: '1rem',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '500',
                      margin: '0 0 0.5rem',
                    }}
                  >
                    {label}
                  </p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color, margin: 0 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #f5c6cb',
                marginBottom: '2rem',
              }}
            >
              <h2
                style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#721c24',
                  marginBottom: '1rem',
                }}
              >
                Row Errors ({result.errors.length})
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '0.625rem 1rem',
                          fontWeight: '600',
                          color: '#333',
                          borderBottom: '2px solid #dee2e6',
                          whiteSpace: 'nowrap',
                          width: '80px',
                        }}
                      >
                        Row
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '0.625rem 1rem',
                          fontWeight: '600',
                          color: '#333',
                          borderBottom: '2px solid #dee2e6',
                        }}
                      >
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map(({ row, error }, idx) => (
                      <tr
                        key={idx}
                        style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fdf2f2' }}
                      >
                        <td
                          style={{
                            padding: '0.625rem 1rem',
                            color: '#dc3545',
                            fontWeight: '600',
                            borderBottom: '1px solid #f1f1f1',
                          }}
                        >
                          {row}
                        </td>
                        <td
                          style={{
                            padding: '0.625rem 1rem',
                            color: '#555',
                            borderBottom: '1px solid #f1f1f1',
                          }}
                        >
                          {error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length === 0 && (
            <div
              style={{
                backgroundColor: '#f6fff8',
                border: '1px solid #c3e6cb',
                borderRadius: '8px',
                padding: '1rem 1.5rem',
                color: '#155724',
                fontWeight: '500',
              }}
            >
              All rows processed successfully with no errors.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
