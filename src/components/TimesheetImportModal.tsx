import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { parseTimesheetText, type ImportedTimesheetRow } from '../timesheetImport';

interface TimesheetImportModalProps {
  title?: string;
  targetLabel?: string;
  onClose: () => void;
  onApply: (rows: ImportedTimesheetRow[]) => void;
}

export const TimesheetImportModal: React.FC<TimesheetImportModalProps> = ({
  title = 'Import Timesheet From File',
  targetLabel,
  onClose,
  onApply
}) => {
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ImportedTimesheetRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file) return;

    setFileName(file.name);
    setError('');
    setRows([]);
    setProcessing(true);

    try {
      let text = '';
      if (file.type.startsWith('image/')) {
        const { recognize } = await import('tesseract.js');
        const result = await recognize(file, 'eng');
        text = result.data.text;
      } else {
        text = await file.text();
      }

      const parsedRows = parseTimesheetText(text);
      setRawText(text);
      setRows(parsedRows);
      if (parsedRows.length === 0) {
        setError('No complete shifts were found. Try a clearer image or paste text with date, start time, and end time.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not read this file. Use a clear image, .txt, .csv, or pasted timesheet text.');
    } finally {
      setProcessing(false);
    }
  };

  const handleParseText = () => {
    const parsedRows = parseTimesheetText(rawText);
    setRows(parsedRows);
    setError(parsedRows.length === 0 ? 'No complete shifts were found in the pasted text.' : '');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '860px' }}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {targetLabel && (
              <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem', marginTop: '2px' }}>{targetLabel}</p>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Upload Image, Text, CSV, or TSV</label>
            <input
              type="file"
              className="form-control"
              accept="image/*,.txt,.csv,.tsv,text/plain,text/csv"
              onChange={event => handleFile(event.target.files?.[0] || null)}
            />
            {fileName && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: '8px' }}>
                Selected: {fileName}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Extracted / Pasted Timesheet Text</label>
            <textarea
              className="form-control"
              value={rawText}
              onChange={event => setRawText(event.target.value)}
              placeholder="Paste timesheet text here, or upload a clear photo. Example: Tasal Ashna 2026-07-07 08:00 17:00 break 30"
              rows={6}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleParseText} disabled={!rawText.trim() || processing}>
              <FileText size={16} /> Extract Fields
            </button>
            {processing && (
              <span style={{ color: 'var(--color-info)', fontSize: '0.85rem', fontWeight: 600 }}>
                Reading file and extracting text...
              </span>
            )}
          </div>

          {error && (
            <div style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: 'var(--color-warning)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Detected Shifts</h4>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              No shifts detected yet.
            </div>
          ) : (
            <div className="table-container" style={{ marginTop: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Break</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td>{row.workerName || 'Not found'}</td>
                      <td>{row.date}</td>
                      <td>{row.startTime}</td>
                      <td>{row.endTime}</td>
                      <td>{row.breakMinutes}m</td>
                      <td>
                        <span className={`badge ${row.confidence === 'high' ? 'badge-approved' : row.confidence === 'medium' ? 'badge-pending' : 'badge-draft'}`}>
                          {row.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={rows.length === 0 || processing} onClick={() => onApply(rows)}>
            Add {rows.length || ''} Shift{rows.length === 1 ? '' : 's'} to Timesheet
          </button>
        </div>
      </div>
    </div>
  );
};
